import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { ParserVersionEnum, type ParserVersion } from '../parser-version.enum.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type Config as BaseLineConfig, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { class: string };

export type Config = BaseLineConfig & {
    // Defines a set of allowed "AC" values. Defaults to all ICAO classes.
    allowedClasses?: string[];
    tokenTypes: TokenType[];
    version: ParserVersion;
};

export const ConfigSchema = z
    .object({
        airspaceClasses: z.array(z.string().nonempty()).optional(),
        allowedClasses: z.array(z.string().nonempty()).optional(),
        tokenTypes: z.array(z.string().nonempty()),
        version: z.nativeEnum(ParserVersionEnum),
    })
    .strict()
    .describe('ConfigSchema');

/**
 * Tokenizes "AC" airspace class definitions.
 */
export class AcToken extends AbstractLineToken<Metadata> {
    static type: TokenType = TokenTypeEnum.AC;
    protected _allowedClasses: string[] = [];

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { tokenTypes, version, allowedClasses } = config;

        super({ tokenTypes, version });

        this._allowedClasses = allowedClasses || [];
    }

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AC line e.g. "AC D"
        return /^AC\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AcToken({
            allowedClasses: this._allowedClasses,
            version: this._version,
            tokenTypes: this._tokenTypes,
        });

        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartClass = line.replace(/^AC\s+/, '');
        // check restricted classes if using original format
        if (this._allowedClasses.includes(linePartClass) === false) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown airspace class '${line}'` });
        }
        token._tokenized = { line, lineNumber, metadata: { class: linePartClass } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        // defines allowed tokens in the original format
        let allowedNextTokens: TokenType[] = [TokenTypeEnum.COMMENT, TokenTypeEnum.AN, TokenTypeEnum.SKIPPED];
        // inject version 2 tokens if required
        if (this._version === ParserVersionEnum.VERSION_2) {
            allowedNextTokens = allowedNextTokens.concat([TokenTypeEnum.AI, TokenTypeEnum.AY]);
        }

        return allowedNextTokens;
    }
}
