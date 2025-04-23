import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { code: number };

/**
 * Tokenizes "TP" token value which is a transponder code string "7000"
 */
export class TpToken extends AbstractLineToken<Metadata> {
    static type: TokenType = TokenTypeEnum.TP;

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is TP line e.g. "TP 7000"
        return /^TP\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new TpToken({ tokenTypes: this._tokenTypes, extendedFormat: this._extendedFormat });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartCode = line.replace(/^TP\s+/, '');
        // validate transponder code string
        const isValidCode = /^[0-7]{4}$/.test(linePartCode);
        if (isValidCode === false) {
            throw new ParserError({ lineNumber, errorMessage: `Invalid transponder code string '${line}'` });
        }
        token._tokenized = { line, lineNumber, metadata: { code: parseInt(linePartCode) } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        // no extended format option handling, TP token only in extended format
        return [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.AG,
            TokenTypeEnum.AL,
            TokenTypeEnum.AH,
            TokenTypeEnum.SKIPPED,
            TokenTypeEnum.DP,
            TokenTypeEnum.VW,
            TokenTypeEnum.VX,
            TokenTypeEnum.VD,
            TokenTypeEnum.AN,
            TokenTypeEnum.AF,
        ];
    }
}
