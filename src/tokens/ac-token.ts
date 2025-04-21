import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type Config as BaseLineConfig, type IToken } from './abstract-line-token.js';

export type Config = BaseLineConfig & {
    // A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
    airspaceClasses?: string[];
    // Defines a set of allowed "AC" values if the extended format is used. Defaults to all ICAO classes.
    extendedFormatClasses?: string[];
};

export const ConfigSchema = z
    .object({
        tokenTypes: z.array(z.string().nonempty()),
        extendedFormat: z.boolean().optional(),
        airspaceClasses: z.array(z.string().nonempty()).optional(),
        extendedFormatClasses: z.array(z.string().nonempty()).optional(),
    })
    .strict()
    // enforce that both extended classes and types are defined if extended format should be parsed
    .refine((data) => {
        if (data.extendedFormat && data.extendedFormatClasses == null) {
            throw new Error('Extended format requires accepted classes to be defined.');
        }
        return true;
    })
    .describe('ConfigSchema');

/**
 * Tokenizes "AC" airspace class definitions.
 */
export class AcToken extends AbstractLineToken {
    static type: TokenType = 'AC';
    protected _airspaceClasses: string[] = [];
    protected _extendedFormatClasses: string[] = [];

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { airspaceClasses, tokenTypes, extendedFormat, extendedFormatClasses } = config;

        super({ tokenTypes, extendedFormat });

        this._airspaceClasses = airspaceClasses || [];
        this._extendedFormatClasses = extendedFormatClasses || [];
    }

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is AC line e.g. "AC D"
        return /^AC\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AcToken({
            airspaceClasses: this._airspaceClasses,
            extendedFormatClasses: this._extendedFormatClasses,
            extendedFormat: this._extendedFormat,
            tokenTypes: this._tokenTypes,
        });

        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartClass = line.replace(/^AC\s+/, '');

        if (this._extendedFormat === true) {
            // check restricted classes if using original format
            if (this._extendedFormatClasses.includes(linePartClass) === false) {
                throw new ParserError({ lineNumber, errorMessage: `Unknown extended airspace class '${line}'` });
            }
        } else {
            // check restricted classes if using original format
            if (this._airspaceClasses.includes(linePartClass) === false) {
                throw new ParserError({ lineNumber, errorMessage: `Unknown airspace class '${line}'` });
            }
        }
        token._tokenized = { line, lineNumber, metadata: { class: linePartClass } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        // defines allowed tokens in the original format
        let allowedNextTokens: TokenType[] = ['COMMENT', 'AN', 'SKIPPED'];
        // inject extended format tokens if required
        if (this._extendedFormat === true) {
            allowedNextTokens = allowedNextTokens.concat(['AI', 'AY'] as TokenType[]);
        }

        return allowedNextTokens;
    }
}
