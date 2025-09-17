import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { code: number };

/**
 * Tokenizes "AX" token value which is a transponder code string "7000"
 */
export class AxToken extends AbstractLineToken<Metadata> {
    static TYPE: TokenType = TokenTypeEnum.AX;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AX line e.g. "AX 7000"
        return /^AX\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AxToken({ tokenTypes: this.tokenTypes, version: this.version });
        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartCode = line.replace(/^AX\s+/, '');
        // validate transponder code string
        const isValidCode = /^[0-7]{4}$/.test(linePartCode);
        if (isValidCode === false) {
            throw new ParserError({ lineNumber, errorMessage: `Invalid transponder code string '${line}'` });
        }
        token.tokenized = { line, lineNumber, metadata: { code: parseInt(linePartCode) } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
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
            TokenTypeEnum.AA,
        ];
    }
}
