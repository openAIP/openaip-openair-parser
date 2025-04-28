import { z } from 'zod';
import { validateSchema } from './validate-schema.js';

export function metersToFeet(meters: number): number {
    validateSchema(meters, z.number(), { assert: true, name: 'meters' });

    return meters * 3.28084;
}

export function feetToMeters(feet: number): number {
    validateSchema(feet, z.number(), { assert: true, name: 'feet' });

    return feet / 3.28084;
}
