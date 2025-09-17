import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import type { IToken } from './abstract-line-token.js';
import { AbstractLineToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Handles comments, e.g. lines starting with "*".
 */
export class CommentToken extends AbstractLineToken<undefined> {
    static TYPE: TokenType = TokenTypeEnum.COMMENT;

    isIgnoredToken(): boolean {
        return true;
    }

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is comment line starting with "* this is a comment"
        return /^\*.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new CommentToken({ tokenTypes: this.tokenTypes, version: this.version });
        // keep original line
        token.line = line;
        token.tokenized = { line, lineNumber };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.BLANK,
            TokenTypeEnum.AC,
            TokenTypeEnum.AN,
            TokenTypeEnum.AL,
            TokenTypeEnum.AH,
            TokenTypeEnum.DP,
            TokenTypeEnum.VX,
            TokenTypeEnum.VD,
            TokenTypeEnum.DB,
            TokenTypeEnum.DC,
            TokenTypeEnum.AX,
            TokenTypeEnum.AA,
            TokenTypeEnum.AY,
            TokenTypeEnum.AF,
            TokenTypeEnum.AG,
            TokenTypeEnum.EOF,
            TokenTypeEnum.SKIPPED,
        ];
    }
}
