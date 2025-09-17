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
    public readonly name: string;
    public readonly lineNumber?: number;
    public readonly errorMessage: string;
    public readonly geometry?: Polygon | LineString | undefined;
    public readonly selfIntersections?: Position[] = undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { lineNumber, errorMessage, geometry, selfIntersections } = config;

        const message = lineNumber == null ? errorMessage : `Error found at line ${lineNumber}: ${errorMessage}`;
        super(message);

        this.name = 'ParserError';
        this.lineNumber = lineNumber;
        this.errorMessage = message;
        this.geometry = geometry;
        this.selfIntersections = selfIntersections;
    }

    toString(): string {
        return `${this.name}: ${this.errorMessage}`;
    }
}
