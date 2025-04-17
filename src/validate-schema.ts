import { z } from 'zod';

/**
 * Validates a value against a Zod schema. If the value does not match the schema, an error is thrown.
 * Mainly a wrapper around the Zod schema validation with a standardized error output that is used
 * throughout the application.
 */
export function validateSchema(
    value: unknown,
    schema: z.ZodType<any, any>,
    options: { assert?: boolean; name?: string; expectedType?: string } = {}
): boolean {
    const defaultValues = { assert: false };
    const opts = { ...defaultValues, ...options };

    if (typeof opts?.assert !== 'boolean') {
        throw new TypeError(buildErrorMessage({ schema, name: 'opts.assert', value: opts.assert }));
    }
    if (opts?.name != null && (typeof opts.name !== 'string' || opts.name === '')) {
        throw new TypeError(buildErrorMessage({ schema, name: 'opts.name', value: opts.name }));
    }
    if (opts?.expectedType != null && (typeof opts.expectedType !== 'string' || opts.expectedType === '')) {
        throw new TypeError(
            buildErrorMessage({
                schema,
                name: 'opts.expectedType',
                value: opts.expectedType,
            })
        );
    }

    const { success, error } = schema.safeParse(value);
    // return early if the check passes and we don't need to assert
    if (opts.assert === false) {
        return success;
    }
    // throw an error if the check fails
    if (success === false) {
        // build a custom error message if a schema validation fails
        throw new TypeError(buildErrorMessage({ schema, error, name: opts.name, value }));
    }

    return true;
}

function isNonEmpty(schema: z.ZodType<any, any>): boolean {
    if (schema instanceof z.ZodArray) {
        // Access the underlying ZodArray instance
        const arraySchema = schema as z.ZodArray<any>;
        // arraySchema._def is an object which contains property with object literal config for "minLength"
        // find this property and check if the 'value' property configured is greater than 0
        return arraySchema._def?.minLength?.value != null && arraySchema._def?.minLength?.value > 0;
    }
    if (schema instanceof z.ZodString) {
        // Access the underlying ZodString instance
        const stringSchema = schema as z.ZodString;
        // Check for the presence of the `min` property and its value
        return stringSchema.minLength === 1;
    }
    if (schema instanceof z.ZodObject) {
        // Access the underlying ZodObject instance
        const objectSchema = schema as z.ZodObject<any>;
        // Check for the presence of the `strict` property and its value
        return Object.values(objectSchema._def).some((check) => {
            return check === 'strict';
        });
    }

    return false;
}

function buildErrorMessage(config: {
    schema: z.ZodType<any, any>;
    error?: z.ZodError<any>;
    name?: string;
    value?: unknown;
}): string {
    let message = 'Schema validation failed';
    if (config.name) {
        message += ` for parameter '${config.name}`;
    }
    message += `. Expected to match schema${isNonEmpty(config.schema) ? ' non-empty' : ''} '${config.schema.description || config.schema._def.typeName.replace(/Zod/, '') || 'UNKNOWN'}'.`;
    // add more error details for path
    for (const e of config?.error?.errors || []) {
        const prop = e?.path == null ? '' : e?.path[0];
        message += ` [${prop}]: ${e.message}.`;
    }
    if (config.value != null) {
        message += ` Received: ${JSON.stringify(config.value)}.`;
    }
    // handle null and undefined values
    if (config.value === null) {
        message += ' Received: null.';
    }
    if (config.value === undefined) {
        message += ' Received: undefined.';
    }

    return message;
}
