import type { LineString, Polygon, Position } from 'geojson';
import { z } from 'zod';
import { validateSchema } from './validate-schema.js';

export const GeoJsonPositionSchema = z.array(z.number());

export const GeoJsonPolygonSchema = z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(GeoJsonPositionSchema)),
    bbox: z.array(z.number()).optional(),
});

export const GeoJsonLineStringSchema = z.object({
    type: z.literal('LineString'),
    coordinates: z.array(GeoJsonPositionSchema),
    bbox: z.array(z.number()).optional(),
});

export type Config = {
    errorMessage: string;
    lineNumber?: number;
    geometry?: Polygon | LineString;
    selfIntersections?: Position[];
};

export const ConfigSchema = z
    .object({
        errorMessage: z.string().nonempty(),
        lineNumber: z.number().optional(),
        geometry: z.union([GeoJsonPolygonSchema, GeoJsonLineStringSchema]).optional(),
        selfIntersections: z.array(GeoJsonPositionSchema).optional(),
    })
    .strict()
    .describe('ConfigSchema');

export class ParserError extends Error {
    protected _name: string;
    protected _lineNumber?: number;
    protected _errorMessage: string;
    protected _geometry?: Polygon | LineString | undefined;
    protected _selfIntersections?: Position[] = undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { lineNumber, errorMessage, geometry, selfIntersections } = config;

        const message = lineNumber == null ? errorMessage : `Error found at line ${lineNumber}: ${errorMessage}`;
        super(message);

        this._name = 'ParserError';
        this._lineNumber = lineNumber;
        this._errorMessage = message;
        this._geometry = geometry;
        this._selfIntersections = selfIntersections;
    }

    get name(): string {
        return this._name;
    }

    get lineNumber(): number | undefined {
        return this._lineNumber;
    }

    get errorMessage(): string {
        return this._errorMessage;
    }

    get geometry(): Polygon | LineString | undefined {
        return this._geometry;
    }

    get selfIntersections(): Position[] | undefined {
        return this._selfIntersections;
    }

    toString(): string {
        return `${this.name}: ${this.errorMessage}`;
    }
}
