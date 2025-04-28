import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { ParserVersionEnum, type ParserVersion } from '../parser-version.enum.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type Config as BaseLineConfig, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { type: string };

export type Config = BaseLineConfig & {
    allowedTypes: string[];
    tokenTypes: TokenType[];
    version: ParserVersion;
};

export const ConfigSchema = z
    .object({
        allowedTypes: z.array(z.string().nonempty()),
        tokenTypes: z.array(z.string().nonempty()),
        version: z.nativeEnum(ParserVersionEnum),
    })
    .strict()
    .refine((data) => {
        if (
            (data.version === ParserVersionEnum.VERSION_2 && data.allowedTypes == null) ||
            data.allowedTypes.length === 0
        ) {
            throw new Error('Version 2 format requires accepted types to be defined.');
        }
        return true;
    })
    .describe('ConfigSchema');

/**
 * Tokenizes "AY" airspace type definitions.
 */
export class AyToken extends AbstractLineToken<Metadata> {
    static type: TokenType = TokenTypeEnum.AY;
    protected _allowedTypes: string[] = [];

    constructor(config: Config) {
        const { tokenTypes, allowedTypes, version } = config;

        super({ tokenTypes, version });

        this._allowedTypes = allowedTypes;
    }

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AC line e.g. "AC D"
        return /^AY\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AyToken({
            allowedTypes: this._allowedTypes,
            tokenTypes: this._tokenTypes,
            version: this._version,
        });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartType = line.replace(/^AY\s+/, '');
        // if config defines a list of allowed types, verify that used type is in this list
        if (this._allowedTypes?.length > 0 && this._allowedTypes.includes(linePartType) === false) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown extended airspace type '${line}'` });
        }
        token._tokenized = { line, lineNumber, metadata: { type: linePartType } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [TokenTypeEnum.COMMENT, TokenTypeEnum.AN, TokenTypeEnum.SKIPPED];
    }
}
