import { feature as createFeature, lineString as createLinestring, polygon as createPolygon } from '@turf/turf';
import type { Feature, LineString, Polygon, Position } from 'geojson';
import * as uuid from 'uuid';
import { z } from 'zod';
import type { AltitudeReferenceDatum } from './altitude-reference-datum.enum.js';
import type { AltitudeUnit } from './altitude-unit.enum.js';
import * as geojsonPolygon from './geojson-polygon.js';
import { type OutputGeometry, OutputGeometryEnum } from './output-geometry.enum.js';
import { ParserError } from './parser-error.js';
import type { IToken } from './tokens/abstract-line-token.js';
import type { AcToken } from './tokens/ac-token.js';
import { validateSchema } from './validate-schema.js';

export type AsGeojsonConfig = {
    validateGeometry: boolean;
    fixGeometry: boolean;
    includeOpenair: boolean;
    outputGeometry: OutputGeometry;
    consumeDuplicateBuffer: number;
};

export const AsGeojsonConfigSchema = z
    .object({
        validateGeometry: z.boolean(),
        fixGeometry: z.boolean(),
        includeOpenair: z.boolean(),
        outputGeometry: z.enum(['POLYGON', 'LINESTRING']),
        consumeDuplicateBuffer: z.number().min(0),
    })
    .strict()
    .describe('AsGeojsonConfigSchema');

export type Altitude = { value: number; unit: AltitudeUnit; referenceDatum: AltitudeReferenceDatum };

export type Frequency = { value: string; name?: string };

export type Activation = {
    start?: string;
    end?: string;
};

export type AirspaceProperties = {
    id: string;
    name: string;
    type?: string;
    class: string;
    upperCeiling: Altitude;
    lowerCeiling: Altitude;
    frequency?: Partial<Frequency>;
    transponderCode?: number;
    byNotam?: boolean;
    activationTimes?: Activation[];
    openair?: string;
};

export type AirspaceFeature = Feature<Polygon | LineString, AirspaceProperties>;

/**
 * Result of a parsed airspace definition block. Can be output as GeoJSON.
 */
export class Airspace {
    public consumedTokens: IToken[] = [];
    public name: string | undefined = undefined;
    // use "airspaceClass" instead of "class" to avoid conflicts with the "class" keyword
    public airspaceClass: string | undefined = undefined;
    public upperCeiling: Altitude | undefined = undefined;
    public lowerCeiling: Altitude | undefined = undefined;
    public readonly identifier: string | undefined = undefined;
    public type: string | undefined = undefined;
    public frequency: Partial<Frequency> | undefined = undefined;
    public transponderCode: number | undefined = undefined;
    public activationTimes: Activation[] | undefined;
    public byNotam: boolean | undefined = undefined;
    public coordinates: Position[] = [];

    constructor() {
        this.identifier = uuid.v4();
    }

    addCoordinates(coordinates: Position[]): void {
        // only use 6 decimal places for coordinates -actuall
        coordinates = coordinates.map((coordinate) => {
            return [parseFloat(coordinate[0].toFixed(6)), parseFloat(coordinate[1].toFixed(6))];
        });
        // check if coordinates are already in the list
        this.coordinates.push(...coordinates);
    }

    asGeoJson(config: AsGeojsonConfig): AirspaceFeature {
        validateSchema(config, AsGeojsonConfigSchema, { assert: true, name: 'config' });

        const { validateGeometry, fixGeometry, includeOpenair, outputGeometry, consumeDuplicateBuffer } = config;
        // first token is always an AcToken
        const acToken: AcToken = this.consumedTokens[0] as AcToken;
        const { lineNumber } = acToken.toTokenized();

        if (
            // directly error out on definitions with only 2 points or less
            this.coordinates.length <= 2 ||
            // if 3 points are given and the last point does NOT equal first point, a polygon geometry could be
            // created if "fix geometry" is true, otherwise error out
            (this.coordinates.length === 3 && this.coordinates[0].join(', ') === this.coordinates[2].join(', '))
        ) {
            throw new ParserError({
                lineNumber,
                errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} has insufficient number of coordinates: ${this.coordinates.length}`,
                geometry: this.asLineStringGeometry(),
            });
        }
        // check if all required properties are set
        if (this.isCompleteProperties() === false) {
            throw new ParserError({
                lineNumber,
                errorMessage: `Airspace '${this.name}' starting on line ${lineNumber} is missing required properties`,
                geometry: this.asLineStringGeometry(),
            });
        }

        // set feature properties
        const properties: Partial<AirspaceProperties> = {};
        // base properts for both version 1 and 2
        properties.id = this.identifier as string;
        properties.name = this.name as string;
        properties.class = this.airspaceClass as string;
        properties.upperCeiling = this.upperCeiling as Altitude;
        properties.lowerCeiling = this.lowerCeiling as Altitude;
        // properties for version 2
        if (this.type != null) properties.type = this.type as string;
        if (this.frequency != null) properties.frequency = this.frequency;
        if (this.transponderCode != null) properties.transponderCode = this.transponderCode;
        if (this.activationTimes != null) properties.activationTimes = this.activationTimes;
        if (this.byNotam != null) properties.byNotam = this.byNotam;
        // include original OpenAIR airspace definition block
        if (includeOpenair) {
            properties.openair = '';
            for (const token of this.consumedTokens) {
                const { line } = token.toTokenized();
                properties.openair += `${line}\n`;
            }
        }
        // build the GeoJSON geometry object
        const airspaceGeometry =
            outputGeometry === OutputGeometryEnum.POLYGON
                ? this.buildPolygonGeometry({ validateGeometry, fixGeometry, consumeDuplicateBuffer })
                : createLinestring(this.coordinates).geometry;
        // create a GeoJSON feature from the geometry
        const feature = createFeature<Polygon | LineString, AirspaceProperties>(
            airspaceGeometry,
            properties as AirspaceProperties,
            {
                id: uuid.v4(),
            }
        );

        return feature;
    }

    protected buildPolygonGeometry(config: {
        validateGeometry: boolean;
        fixGeometry: boolean;
        consumeDuplicateBuffer: number;
    }): Polygon {
        const defaultConfig = { consumeDuplicateBuffer: 0 };
        const { validateGeometry, fixGeometry, consumeDuplicateBuffer } = {
            ...defaultConfig,
            ...config,
        };
        // get the current AcToken and line number
        const token: IToken = this.consumedTokens[0] as IToken;
        const lineNumber: number = token.toTokenized().lineNumber as number;
        let airspacePolygon: Polygon;

        // create a polygon from the coordinates - run also geometry adjustments that do not alter the geometry
        try {
            airspacePolygon = createPolygon([this.coordinates]).geometry;
            airspacePolygon = geojsonPolygon.removeDuplicatePoints(airspacePolygon, { consumeDuplicateBuffer });
            airspacePolygon = geojsonPolygon.removeIntermediatePoints(airspacePolygon);
            airspacePolygon = geojsonPolygon.withRightHandRule(airspacePolygon);
        } catch (err) {
            let errorMessage = 'Unknown error occured.';
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            // Geometry creation errors may happen here already as it is NOT possible to create certain invalid
            //  polygon geometries, i.e. too few points, start and end points do not match - if "fix geometry" flag
            // is active catch build errors and directly create a fixed polygon. In the main "fix" step below, the
            // geometry is checked for other issues like self-intersections etc and other fixes are applied.
            if (fixGeometry === true) {
                try {
                    airspacePolygon = geojsonPolygon.createFixedPolygon(this.coordinates);
                } catch (err) {
                    if (err instanceof SyntaxError) {
                        throw new ParserError({
                            lineNumber,
                            errorMessage: err.message,
                            geometry: this.asLineStringGeometry(),
                        });
                    } else {
                        throw err;
                    }
                }
            } else {
                throw new ParserError({
                    lineNumber,
                    errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid. ${errorMessage}`,
                    geometry: this.asLineStringGeometry(),
                });
            }
        }
        // apply geometry fixes if specified and required - fix will only happen if the geometry is invalid
        if (fixGeometry === true) {
            try {
                airspacePolygon = geojsonPolygon.createFixedPolygon(airspacePolygon.coordinates[0]);
            } catch (err) {
                if (err instanceof SyntaxError) {
                    throw new ParserError({
                        lineNumber,
                        errorMessage: err.message,
                        geometry: this.asLineStringGeometry(),
                    });
                } else {
                    throw err;
                }
            }
        }
        // validation logic comes AFTER the geometry has been fixed
        if (validateGeometry === true) {
            // IMPORTANT work on "airspacePolygon" variable as it may contain either the original or fixed geometry
            const { isValid, selfIntersections } = this.validateAirspacePolygon(airspacePolygon);
            if (isValid === false || (selfIntersections != null && selfIntersections?.length > 0)) {
                if (selfIntersections != null) {
                    // build the self-intersection error message
                    throw new ParserError({
                        lineNumber,
                        errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid due to self intersection.`,
                        geometry: this.asLineStringGeometry(),
                        selfIntersections,
                    });
                } else {
                    throw new ParserError({
                        lineNumber,
                        errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid.`,
                        geometry: this.asLineStringGeometry(),
                    });
                }
            }
        }

        return airspacePolygon;
    }

    protected validateAirspacePolygon(polygon: Polygon): { isValid: boolean; selfIntersections?: Position[] } {
        let selfIntersections: Position[] = [];
        let isValid: boolean = false;
        try {
            geojsonPolygon.validate(polygon);
            isValid = true;
        } catch (err) {
            let errorMessage = 'Unknown geometry error occured.';
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            if (errorMessage.includes('Geometry is invalid due to self intersection') === true) {
                selfIntersections = geojsonPolygon.getSelfIntersections(polygon);
            }
        }

        const result: { isValid: boolean; selfIntersections?: Position[] } = {
            isValid,
        };
        if (Array.isArray(selfIntersections) && selfIntersections.length > 0) {
            result.selfIntersections = selfIntersections;
        }

        return result;
    }

    protected isCompleteProperties() {
        return (
            this.name !== undefined &&
            this.airspaceClass !== undefined &&
            this.upperCeiling !== undefined &&
            this.lowerCeiling !== undefined &&
            this.coordinates.length > 0
        );
    }

    /**
     * This method is mainly intended as utility method that returns the airspace geometry to be included
     * in a parser error object. It grafcefully handles geometry creation and returns "undefined" if it is not
     * possible to create a geometry.
     */
    protected asLineStringGeometry(): LineString | undefined {
        try {
            // return as GeoJSON line feature
            return createLinestring(this.coordinates).geometry;
        } catch (err) {
            // possible that geometry cannot be created due to too few points
            return undefined;
        }
    }
}
