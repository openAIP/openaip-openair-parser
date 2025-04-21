import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type Config as BaseLineConfig, type IToken } from './abstract-line-token.js';

export type Config = BaseLineConfig & {
    extendedFormat?: boolean;
    // Defines a set of allowed "AY" values if the extended format is used.
    extendedFormatTypes: string[];
};

export const ConfigSchema = z
    .object({
        extendedFormat: z.boolean().optional(),
        extendedFormatTypes: z.array(z.string().nonempty()),
    })
    .strict()
    // enforce that both extended types are defined if extended format should be parsed
    .refine((data) => {
        if (data.extendedFormat && data.extendedFormatTypes == null) {
            throw new Error('Extended format requires accepted types to be defined.');
        }
        return true;
    })
    .describe('ConfigSchema');

/**
 * Tokenizes "AY" airspace type definitions.
 */
export class AyToken extends AbstractLineToken {
    static type: TokenType = 'AY';
    protected _extendedFormatTypes: string[] = [];

    constructor(config: Config) {
        const { tokenTypes, extendedFormatTypes } = config;

        super({ tokenTypes });

        this._extendedFormatTypes = extendedFormatTypes;
    }

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is AC line e.g. "AC D"
        return /^AY\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AyToken({ extendedFormatTypes: this._extendedFormatTypes, tokenTypes: this._tokenTypes });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartType = line.replace(/^AY\s+/, '');
        // if config defines a list of allowed types, verify that used type is in this list
        if (this._extendedFormatTypes?.length > 0 && this._extendedFormatTypes.includes(linePartType) === false) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown extended airspace type '${line}'` });
        }
        token._tokenized = { line, lineNumber, metadata: { type: linePartType } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        // no extended format option handling, AY token only in extended format
        return ['COMMENT', 'AI', 'AN', 'SKIPPED'];
    }
}
