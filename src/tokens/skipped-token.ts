import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import type { IToken } from './abstract-line-token.js';
import { CommentToken } from './comment-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Handles skipped tokens.
 */
export class SkippedToken extends CommentToken {
    static type: TokenType = TokenTypeEnum.SKIPPED;

    isIgnoredToken() {
        return true;
    }

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // line contains a skipped token
        return /^(AT|TO|TC|SP|SB|V Z=\d).*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new SkippedToken({ tokenTypes: this._tokenTypes, version: this._version });
        // keep original line
        token._line = line;
        token._tokenized = { line, lineNumber };

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
            TokenTypeEnum.EOF,
            TokenTypeEnum.SKIPPED,
            TokenTypeEnum.AY,
            TokenTypeEnum.AF,
            TokenTypeEnum.AG,
        ];
    }
}
