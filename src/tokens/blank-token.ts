import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Handles blank lines. Each blank line is considered to separate each airspace definition block.
 */
export class BlankToken extends AbstractLineToken<undefined> {
    static type: TokenType = TokenTypeEnum.BLANK;

    isIgnoredToken(): boolean {
        return true;
    }

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        return line.length === 0;
    }

    tokenize(line: string, lineNumber: number): IToken {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new BlankToken({ tokenTypes: this._tokenTypes, extendedFormat: this._extendedFormat });
        token._tokenized = { line, lineNumber };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [TokenTypeEnum.BLANK, TokenTypeEnum.AC, TokenTypeEnum.COMMENT, TokenTypeEnum.EOF, TokenTypeEnum.SKIPPED];
    }
}
