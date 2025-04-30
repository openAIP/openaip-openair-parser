import { feature as createFeature, lineString as createLinestring, polygon as createPolygon } from '@turf/turf';
import type { Feature, LineString, Polygon, Position } from 'geojson';
import * as uuid from 'uuid';
import { z } from 'zod';
import type { AltitudeReferenceDatum } from './altitude-reference-datum.enum.js';
import type { AltitudeUnit } from './altitude-unit.enum.js';
import { cleanObject } from './clean-object.js';
import * as geojsonPolygon from './geojson-polygon.js';
import { OutputGeometryEnum, type OutputGeometry } from './output-geometry.enum.js';
import { ParserError } from './parser-error.js';
import type { IToken, Tokenized } from './tokens/abstract-line-token.js';
import { AcToken } from './tokens/ac-token.js';
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
    protected _consumedTokens: IToken[] = [];
    protected _name: string | undefined = undefined;
    // use "airspaceClass" instead of "class" to avoid conflicts with the "class" keyword
    protected _airspaceClass: string | undefined = undefined;
    protected _upperCeiling: Altitude | undefined = undefined;
    protected _lowerCeiling: Altitude | undefined = undefined;
    protected _identifier: string | undefined = undefined;
    protected _type: string | undefined = undefined;
    protected _frequency: Partial<Frequency> | undefined = undefined;
    protected _transponderCode: number | undefined = undefined;
    protected _activationTimes: Activation[] | undefined;
    protected _byNotam: boolean | undefined = undefined;
    protected _coordinates: Position[] = [];

    constructor() {
        this._identifier = uuid.v4();
    }

    set consumedTokens(value: IToken[]) {
        this._consumedTokens = value;
    }

    get consumedTokens(): IToken[] {
        return this._consumedTokens;
    }

    get identifier(): string | undefined {
        return this._identifier;
    }

    set identifier(value: string | undefined) {
        this._identifier = value;
    }

    get name(): string | undefined {
        return this._name;
    }

    set name(value: string | undefined) {
        this._name = value;
    }

    get airspaceClass(): string | undefined {
        return this._airspaceClass;
    }

    set airspaceClass(value: string | undefined) {
        this._airspaceClass = value;
    }

    get upperCeiling(): Altitude | undefined {
        return this._upperCeiling;
    }

    set upperCeiling(value: Altitude | undefined) {
        this._upperCeiling = value;
    }

    get lowerCeiling(): Altitude | undefined {
        return this._lowerCeiling;
    }

    set lowerCeiling(value: Altitude | undefined) {
        this._lowerCeiling = value;
    }

    get coordinates(): Position[] {
        return this._coordinates;
    }

    set coordinates(value: Position[]) {
        this._coordinates = value;
    }

    get type(): string | undefined {
        return this._type;
    }

    set type(value: string | undefined) {
        this._type = value;
    }

    get frequency(): Partial<Frequency> | undefined {
        return this._frequency;
    }

    set frequency(value: Partial<Frequency> | undefined) {
        this._frequency = value;
    }

    get transponderCode(): number | undefined {
        return this._transponderCode;
    }

    set transponderCode(value: number | undefined) {
        this._transponderCode = value;
    }

    get activationTimes(): Activation[] | undefined {
        return this._activationTimes;
    }

    set activationTimes(value: Activation[] | undefined) {
        this._activationTimes = value;
    }

    get byNotam(): boolean | undefined {
        return this._byNotam;
    }

    set byNotam(value: boolean | undefined) {
        this._byNotam = value;
    }

    addCoordinates(coordinates: Position[]): void {
        // only use 6 decimal places for coordinates
        coordinates = coordinates.map((coordinate) => {
            return [parseFloat(coordinate[0].toFixed(7)), parseFloat(coordinate[1].toFixed(7))];
        });
        // check if coordinates are already in the list
        this._coordinates.push(...coordinates);
    }

    asGeoJson(config: AsGeojsonConfig): AirspaceFeature {
        validateSchema(config, AsGeojsonConfigSchema, { assert: true, name: 'config' });

        const { validateGeometry, fixGeometry, includeOpenair, outputGeometry, consumeDuplicateBuffer } = config;
        // first token is always an AcToken
        const acToken: AcToken = this._consumedTokens[0] as AcToken;
        const { lineNumber } = acToken.tokenized;

        if (
            // directly error out on definitions with only 2 points or less
            this._coordinates.length <= 2 ||
            // if 3 points are given and the last point does NOT equal first point, a polygon geometry could be
            // created if "fix geometry" is true, otherwise error out
            (this._coordinates.length === 3 && this._coordinates[0].join(', ') === this._coordinates[2].join(', '))
        ) {
            throw new ParserError({
                lineNumber,
                errorMessage: `Geometry of airspace '${this._name}' starting on line ${lineNumber} has insufficient number of coordinates: ${this._coordinates.length}`,
                geometry: this.asLineStringGeometry(),
            });
        }
        // check if all required properties are set
        if (this.isCompleteProperties() === false) {
            throw new ParserError({
                lineNumber,
                errorMessage: `Airspace '${this._name}' starting on line ${lineNumber} is missing required properties`,
                geometry: this.asLineStringGeometry(),
            });
        }

        // set feature properties
        const properties: Partial<AirspaceProperties> = {};
        // base properts for both version 1 and 2
        properties.id = this._identifier as string;
        properties.name = this._name as string;
        properties.class = this._airspaceClass as string;
        properties.upperCeiling = this._upperCeiling as Altitude;
        properties.lowerCeiling = this._lowerCeiling as Altitude;
        // properties for version 2
        if (this._type != null) properties.type = this._type as string;
        if (this._frequency != null) properties.frequency = this._frequency;
        if (this._transponderCode != null) properties.transponderCode = this._transponderCode;
        if (this._activationTimes != null) properties.activationTimes = this._activationTimes;
        if (this._byNotam != null) properties.byNotam = this._byNotam;
        // include original OpenAIR airspace definition block
        if (includeOpenair) {
            properties.openair = '';
            for (const token of this._consumedTokens) {
                const { line } = token.tokenized as Tokenized;
                properties.openair += line + '\n';
            }
        }
        // build the GeoJSON geometry object
        const airspaceGeometry =
            outputGeometry === OutputGeometryEnum.POLYGON
                ? this.buildPolygonGeometry({ validateGeometry, fixGeometry, consumeDuplicateBuffer })
                : createLinestring(this._coordinates).geometry;
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
        const token: IToken = this._consumedTokens[0] as IToken;
        const lineNumber: number = token.tokenized?.lineNumber as number;
        let airspacePolygon: Polygon;

        // create a polygon from the coordinates - run also geometry adjustments that do not alter the geometry
        try {
            airspacePolygon = createPolygon([this._coordinates]).geometry;
            airspacePolygon = geojsonPolygon.removeDuplicatePoints(airspacePolygon, { consumeDuplicateBuffer });
            airspacePolygon = geojsonPolygon.removeIntermediatePoints(airspacePolygon);
            airspacePolygon = geojsonPolygon.withRightHandRule(airspacePolygon);
        } catch (e) {
            // Geometry creation errors may happen here already as it is NOT possible to create certain invalid
            //  polygon geometries, i.e. too few points, start and end points do not match - if "fix geometry" flag
            // is active catch build errors and directly create a fixed polygon. In the main "fix" step below, the
            // geometry is checked for other issues like self-intersections etc and other fixes are applied.
            if (fixGeometry === true) {
                try {
                    airspacePolygon = geojsonPolygon.createFixedPolygon(this._coordinates);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        throw new ParserError({
                            lineNumber,
                            errorMessage: e.message,
                            geometry: this.asLineStringGeometry(),
                        });
                    } else {
                        throw e;
                    }
                }
            } else {
                throw new ParserError({
                    lineNumber,
                    errorMessage: `Geometry of airspace '${this._name}' starting on line ${lineNumber} is invalid. ${e.message}`,
                    geometry: this.asLineStringGeometry(),
                });
            }
        }
        // apply geometry fixes if specified and required - fix will only happen if the geometry is invalid
        if (fixGeometry === true) {
            try {
                airspacePolygon = geojsonPolygon.createFixedPolygon(airspacePolygon.coordinates[0]);
            } catch (e) {
                if (e instanceof SyntaxError) {
                    throw new ParserError({
                        lineNumber,
                        errorMessage: e.message,
                        geometry: this.asLineStringGeometry(),
                    });
                } else {
                    throw e;
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
                        errorMessage: `Geometry of airspace '${this._name}' starting on line ${lineNumber} is invalid due to self intersection.`,
                        geometry: this.asLineStringGeometry(),
                        selfIntersections,
                    });
                } else {
                    throw new ParserError({
                        lineNumber,
                        errorMessage: `Geometry of airspace '${this._name}' starting on line ${lineNumber} is invalid.`,
                        geometry: this.asLineStringGeometry(),
                    });
                }
            }
        }

        return airspacePolygon;
    }

    protected validateAirspacePolygon(polygon: Polygon) {
        let selfIntersections = undefined;
        let isValid: boolean = false;
        try {
            geojsonPolygon.validate(polygon);
            isValid = true;
        } catch (err) {
            const message = err?.message || 'Unknown geometry error.';
            if (message.includes('Geometry is invalid due to self intersection') === true) {
                selfIntersections = geojsonPolygon.getSelfIntersections(polygon);
            }
        }

        return cleanObject({ isValid, selfIntersections });
    }

    protected isCompleteProperties() {
        return (
            this._name !== undefined &&
            this._airspaceClass !== undefined &&
            this._upperCeiling !== undefined &&
            this._lowerCeiling !== undefined &&
            this._coordinates.length > 0
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
            return createLinestring(this._coordinates).geometry;
        } catch (e) {
            // possible that geometry cannot be created due to too few points
            return undefined;
        }
    }
}
