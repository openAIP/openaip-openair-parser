import {
    feature as createFeature,
    lineString as createLinestring,
    polygon as createPolygon,
    lineToPolygon,
} from '@turf/turf';
import type { Feature, LineString, Polygon, Position } from 'geojson';
import uuid from 'uuid';
import { z } from 'zod';
import { cleanObject } from './clean-object.js';
import { GeojsonPolygonValidator } from './geojson-polygon-validator.js';
import { OutputGeometryEnum, type OutputGeometry } from './output-geometry.enum.js';
import { ParserError } from './parser-error.js';
import type { IToken, Tokenized } from './tokens/abstract-line-token.js';
import { AcToken } from './tokens/ac-token.js';
import { validateSchema } from './validate-schema.js';

export type Config = {
    validateGeometry: boolean;
    fixGeometry: boolean;
    includeOpenair: boolean;
    outputGeometry: OutputGeometry;
};

export const ConfigSchema = z
    .object({
        validateGeometry: z.boolean().optional(),
        fixGeometry: z.boolean().optional(),
        includeOpenair: z.boolean().optional(),
        outputGeometry: z.enum(['POLYGON', 'LINESTRING']).optional(),
    })
    .strict()
    .describe('ConfigSchema');

export type Altitude = { value: number; unit: string; referenceDatum: string };

export type Frequency = { value: string; name?: string };

export type AirspaceProperties = {
    identifier: string;
    name: string;
    type: string | undefined;
    airspaceClass: string;
    upperCeiling: Altitude;
    lowerCeiling: Altitude;
    frequency: Partial<Frequency> | undefined;
    transponderCode: number | undefined;
    openair?: string | undefined;
};

export type AirspaceFeature = Feature<Polygon | LineString, AirspaceProperties>;

/**
 * Result of a parsed airspace definition block. Can be output as GeoJSON.
 */
export class Airspace {
    protected _consumedTokens: IToken[] = [];
    protected _name: string | undefined = undefined;
    protected _airspaceClass: string | undefined = undefined;
    protected _upperCeiling: Altitude | undefined = undefined;
    protected _lowerCeiling: Altitude | undefined = undefined;
    protected _coordinates: Position[] = [];
    protected _identifier: string | undefined = undefined;
    protected _type: string | undefined = undefined;
    protected _frequency: Partial<Frequency> | undefined = undefined;
    protected _transponderCode: number | undefined = undefined;

    get consumedTokens(): IToken[] {
        return this._consumedTokens;
    }

    set consumedTokens(value: IToken[]) {
        this._consumedTokens = value;
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

    get identifier(): string | undefined {
        return this._identifier;
    }

    set identifier(value: string | undefined) {
        this._identifier = value;
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

    asGeoJson(config: Config): AirspaceFeature {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const defaultConfig = {
            validateGeometry: false,
            fixGeometry: false,
            includeOpenair: false,
            outputGeometry: OutputGeometryEnum.POLYGON,
        };
        const { validateGeometry, fixGeometry, includeOpenair, outputGeometry } = {
            ...defaultConfig,
            ...config,
        };
        // first token is always an AcToken
        const acToken: AcToken = this._consumedTokens.shift() as AcToken;
        const { lineNumber } = acToken.tokenized as Tokenized;

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
        const properties = cleanObject<AirspaceProperties>({
            id: this._identifier as string,
            name: this._name as string,
            airspaceClass: this._airspaceClass as string,
            type: this._type as string,
            frequency: this._frequency,
            transponderCode: this._transponderCode,
            upperCeiling: this._upperCeiling as Altitude,
            lowerCeiling: this._lowerCeiling as Altitude,
        });
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
                ? this.buildPolygonGeometry({ validateGeometry, fixGeometry, outputGeometry })
                : createLinestring(this._coordinates).geometry;
        // create a GeoJSON feature from the geometry
        const feature = createFeature<Polygon | LineString, AirspaceProperties>(airspaceGeometry, properties, {
            id: uuid.v4(),
        });

        return feature;
    }

    protected buildPolygonGeometry(config: {
        validateGeometry: boolean;
        fixGeometry: boolean;
        outputGeometry: OutputGeometry;
    }): Polygon {
        const { validateGeometry, fixGeometry } = config;
        // get the current AcToken and line number
        const token: IToken = this._consumedTokens[0] as IToken;
        const lineNumber: number = token.tokenized?.lineNumber as number;
        let airspacePolygon: Polygon;
        // build airspace from current coordinates => this variable may be updated with an updated/fixed geometry if required
        try {
            airspacePolygon = createPolygon([this._coordinates]).geometry;
        } catch (e) {
            // Geometry creation errors may happen here already as it is NOT possible to create certain invalid
            //  polygon geometries, i.e. too few points, start and end points do not match - if "fix geometry" flag
            // is active catch build errors and directly create a fixed polygon. In the main "fix" step below, the
            // geometry is checked for other issues like self-intersections etc and other fixes are applied.
            if (fixGeometry === true) {
                try {
                    const geojsonValidator = new GeojsonPolygonValidator();
                    airspacePolygon = geojsonValidator.createFixedPolygon(this._coordinates);
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
        // only try to fix if not valid or has self-intersection
        if (fixGeometry === true) {
            const { isValid, selfIntersections } = this.validateAirspaceGeometry(airspacePolygon);
            // IMPORTANT only run if required since process will slightly change the original airspace by creating a buffer
            //  which will lead to an increase of polygon coordinates
            if (isValid === false || (selfIntersections != null && selfIntersections.length > 0)) {
                try {
                    const geojsonValidator = new GeojsonPolygonValidator();
                    airspacePolygon = geojsonValidator.createFixedPolygon(this._coordinates);
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
        } else {
            try {
                // create a linestring first, then polygonize it => suppresses errors where first coordinate does not equal last coordinate when creating polygon
                const linestring = createLinestring(this._coordinates);
                const castGeom = lineToPolygon(linestring).geometry;
                if (castGeom.type !== 'Polygon') {
                    throw new Error('Failed to create polygon from linestring. Invalid geometry.');
                }
                airspacePolygon = castGeom;
            } catch (e) {
                throw new ParserError({
                    lineNumber,
                    errorMessage: e.message,
                    geometry: this.asLineStringGeometry(),
                });
            }
        }
        // validation logic comes AFTER the geometry has been fixed
        if (validateGeometry === true) {
            // IMPORTANT work on "airspacePolygon" variable as it may contain either the original or fixed geometry
            const { isValid, selfIntersections } = this.validateAirspaceGeometry(airspacePolygon);
            if (isValid === false || (selfIntersections != null && selfIntersections?.length > 0)) {
                if (selfIntersections != null) {
                    // build the self-intersection error message
                    const intersectionPoints = selfIntersections.map((value) => `${value[1]},${value[0]}`);
                    throw new ParserError({
                        lineNumber,
                        errorMessage: `Geometry of airspace '${this._name}' starting on line ${lineNumber} is invalid due to a self intersection at '${intersectionPoints.join(' and ')}.`,
                        geometry: this.asLineStringGeometry(),
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

    protected validateAirspaceGeometry(geometry: Polygon) {
        const geojsonValidator = new GeojsonPolygonValidator();
        let selfIntersections = undefined;
        let isValid: boolean = false;
        try {
            geojsonValidator.validate(geometry);
            isValid = true;
        } catch (err) {
            const message = err?.message || 'Unknown geometry error.';
            if (message.includes('Geometry is invalid due to a self intersection') === true) {
                selfIntersections = geojsonValidator.getSelfIntersections(geometry as Polygon);
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
