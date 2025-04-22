import { z } from 'zod';
import { validateSchema } from './validate-schema.js';

const ConfigSchema = z
    .object({
        keepEmptyStrings: z.boolean().optional(),
        keepEmptyArrays: z.boolean().optional(),
        keepEmptyObjects: z.boolean().optional(),
        keepNull: z.boolean().optional(),
        keepUndefined: z.boolean().optional(),
    })
    .strict()
    .optional()
    .describe('Config');

/**
 * Cleans an object by removing empty strings, empty arrays, empty objects, null values, and undefined values.
 */
export function cleanObject<T>(
    obj: T,
    config?: {
        keepEmptyStrings?: boolean;
        keepEmptyArrays?: boolean;
        keepEmptyObjects?: boolean;
        keepNull?: boolean;
        keepUndefined?: boolean;
    }
): T {
    // make sure to only operate on objects
    if (Array.isArray(obj)) {
        return obj as T;
    }
    validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

    const keepEmptyStrings = config?.keepEmptyStrings ?? false;
    const keepEmptyArrays = config?.keepEmptyArrays ?? false;
    const keepEmptyObjects = config?.keepEmptyObjects ?? false;
    const keepNull = config?.keepNull ?? false;
    const keepUndefined = config?.keepUndefined ?? false;
    const cleanValue = (value: any): any => {
        if (value instanceof Date) {
            return value;
        }
        if (
            (keepNull === false && value === null) ||
            (keepUndefined === false && value === undefined) ||
            (keepEmptyStrings === false && isEmptyString(value)) ||
            (keepEmptyArrays === false && isEmptyArray(value)) ||
            (keepEmptyObjects === false && isEmptyObject(value))
        ) {
            return 'CLEAN';
        }
        if (isSimpleObject(value) && isEmptyObject(value) === false) {
            return cleanObject(value, config);
        }

        return value;
    };

    // Return undefined if the top-level object becomes empty
    if (obj == null || typeof obj !== 'object') {
        return obj;
    }
    // handle edge-case "empty root object"
    if (isEmptyObject(obj)) {
        return obj as T;
    }

    const newObj: any = {};
    for (const key in obj) {
        const value = obj[key];
        // clean the value
        const cleanedValue = cleanValue(value);
        if (cleanedValue !== 'CLEAN') {
            // handle collapsed empty object
            if (isSimpleObject(cleanedValue) && isEmptyObject(cleanedValue) === true && keepEmptyObjects === false) {
                continue;
            }
            // handle collapsed empty array
            if (Array.isArray(cleanedValue) && cleanedValue.length === 0 && keepEmptyArrays === false) {
                continue;
            }
            newObj[key] = cleanedValue;
        }
    }

    return newObj as T;
}

function isEmptyString(value: any): boolean {
    return typeof value === 'string' && value.trim() === '';
}

function isEmptyArray(value: any): boolean {
    return Array.isArray(value) && value.length === 0;
}

function isEmptyObject(value: any): boolean {
    return isSimpleObject(value) && Object.keys(value).length === 0;
}

function isSimpleObject(value: any): boolean {
    return Object.prototype.toString.call(value) === '[object Object]';
}
