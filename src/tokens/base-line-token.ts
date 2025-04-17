import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';

export type Config = {
    // list of all known token types
    tokenTypes: string[],
    // If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
    extendedFormat?: boolean,
}

export const ConfigSchema = z.object({
    tokenTypes: z.array(z.string().nonempty()),
    extendedFormat: z.boolean().optional(),
})

export abstract class BaseLineToken {
    static type = '';
    protected _tokenTypes: string[];
    protected _extendedFormat: boolean;
    protected _tokenized: { line: string, lineNumber: number, [metadata: string]: any } | null;
    protected _line: string | null;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const defaultConfig = { extendedFormat: false };
        const { tokenTypes, extendedFormat } = Object.assign(defaultConfig, config);

        this._tokenTypes = tokenTypes;
        this._extendedFormat = extendedFormat;
        this._tokenized = null;
        this._line = null;
    }

    /**
     * Returns true if the token can handle the string. False if not.
     */
    abstract canHandle(line: string): boolean;
    /**
     * Factory methods that returns a new token of the corresponding type that contains the tokenized
     * representation of the parsed OpenAIR line.
     */
    abstract tokenize(line: string, lineNumber: number): { line: string, lineNumber: number, [metadata: string]: any };
    abstract getAllowedNextTokens(): string[];

    get line(): string | null {
        return this._line;
    }

    get tokenized(): { line: string, lineNumber: number, [metadata: string]: any } | null {
        return this._tokenized;
    }

    /**
     * Most tokens are considered to be not ignored tokens. Blank, comment and other
     * specific tokens that are not handled are considered to be "ignored" tokens.
     */
    isIgnoredToken(): boolean {
        return false;
    }

    // TODO add explicit type
    isAllowedNextToken(token: any): boolean {
        return this.getAllowedNextTokens().includes(token.constructor.type);
    }
}
