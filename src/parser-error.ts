import { z } from 'zod';
import { Geometry } from './types.js';
import { validateSchema } from './validate-schema.js';

export type Config = {
    lineNumber?: number;
    errorMessage: string;
    geometry?: object;
}

export const ConfigSchema =  z.object({
    lineNumber: z.number().optional(),
    errorMessage: z.string().nonempty(),
    geometry: Geometry.PolygonSchema.optional(),
}).strict().describe('ConfigSchema');

export class ParserError extends Error {
    protected _name: string;
    protected _lineNumber?: number;
    protected _errorMessage: string;
    protected _geometry?: Geometry.Polygon;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config'});

        const { lineNumber, errorMessage, geometry } = config;

        const message = lineNumber == null ? errorMessage : `Error found at line ${lineNumber}: ${errorMessage}`;
        super(message);

        this._name = 'ParserError';
        this._lineNumber = lineNumber;
        this._errorMessage = message;
        this._geometry = geometry;
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

    get geometry(): Geometry.Polygon | undefined {
        return this._geometry;
    }

    toString(): string {
        return `${this.name}: ${this.errorMessage}`;
    }
}
