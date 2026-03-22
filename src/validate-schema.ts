import type { z } from 'zod';

export class ValidateSchemaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidateSchemaError';
        Object.setPrototypeOf(this, ValidateSchemaError.prototype);
    }
}

/**
 * Validates a value against a Zod schema. If the value does not match the schema, an error is thrown.
 * Mainly a wrappe around the Zod schema validation with a standardized error output that is used
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
        throw new ValidateSchemaError(buildErrorMessage({ schema, name: 'opts.assert', value: opts.assert }));
    }
    if (opts?.name != null && (typeof opts.name !== 'string' || opts.name === '')) {
        throw new ValidateSchemaError(buildErrorMessage({ schema, name: 'opts.name', value: opts.name }));
    }
    if (opts?.expectedType != null && (typeof opts.expectedType !== 'string' || opts.expectedType === '')) {
        throw new ValidateSchemaError(
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
        throw new ValidateSchemaError(buildErrorMessage({ schema, error, name: opts.name, value }));
    }

    return true;
}

export async function validateSchemaAsync(
    value: unknown,
    schema: z.ZodType<any, any>,
    options: { assert?: boolean; name?: string; expectedType?: string } = {}
): Promise<boolean> {
    const defaultValues = { assert: false };
    const opts = { ...defaultValues, ...options };

    if (typeof opts?.assert !== 'boolean') {
        throw new ValidateSchemaError(buildErrorMessage({ schema, name: 'opts.assert', value: opts.assert }));
    }
    if (opts?.name != null && (typeof opts.name !== 'string' || opts.name === '')) {
        throw new ValidateSchemaError(buildErrorMessage({ schema, name: 'opts.name', value: opts.name }));
    }
    if (opts?.expectedType != null && (typeof opts.expectedType !== 'string' || opts.expectedType === '')) {
        throw new ValidateSchemaError(
            buildErrorMessage({
                schema,
                name: 'opts.expectedType',
                value: opts.expectedType,
            })
        );
    }

    const { success, error } = await schema.safeParseAsync(value);
    // return early if the check passes and we don't need to assert
    if (opts.assert === false) {
        return success;
    }
    // throw an error if the check fails
    if (success === false) {
        // build a custom error message if a schema validation fails
        throw new ValidateSchemaError(buildErrorMessage({ schema, error, name: opts.name, value }));
    }

    return true;
}

interface ZodIssue {
    code: string;
    path: (string | number)[];
    message: string;
}

function buildErrorMessage(config: {
    schema: z.ZodType<any, any>;
    error?: z.ZodError<any>;
    name?: string;
    value?: unknown;
}): string {
    let message = 'Schema validation failed';
    if (config.name) {
        message += ` for parameter '${config.name}'`;
    }
    message += `. Expected to match schema '${(config.schema.description ?? config.schema.def.type) || 'UNKNOWN'}'.`;
    // add more error details for path
    for (const issue of config?.error?.issues ?? []) {
        const errorCode = issue.code;
        if (errorCode === 'invalid_union') {
            const unionErrors = issue.errors || [];
            // Filter out groups where all errors are "received undefined"
            const relevantErrors = unionErrors.filter(
                (group) => !group.every((err) => err.message.includes('received undefined'))
            );
            // Collect errors by property
            const errorsByProp = new Map<string, string>();
            relevantErrors.flat().forEach((err) => {
                const prop = err.path?.[0]?.toString() || 'value';
                // Only keep the most specific error for each property
                if (!err.message.includes('received undefined')) {
                    errorsByProp.set(prop, err.message);
                }
            });
            // Format the error message
            if (errorsByProp.size > 0) {
                message += ' Invalid union value:';
                for (const [prop, errMsg] of errorsByProp) {
                    message += ` [${prop}]: ${errMsg};`;
                }
                message = `${message.slice(0, -1)}.`;
            }
        } else {
            // default message generation
            const prop = issue?.path == null ? '' : String(issue?.path[0] || '');
            message += prop === '' ? ` ${issue.message}.` : ` [${prop}]: ${issue.message}.`;
        }
    }
    if (config.value != null) {
        // IMPORTANT some objects are not serializable - handle them with care
        let receivedValue = '';
        try {
            receivedValue = JSON.stringify(config.value);
        } catch (err) {
            receivedValue = 'UNSERIALIZABLE_OBJECT';
        }
        message += ` Received: ${receivedValue}.`;
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
