import { z } from 'zod';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import type { IToken } from './abstract-line-token.js';
import {AbstractLineToken} from './abstract-line-token.js';

/**
 * Handles comments, e.g. lines starting with "*".
 */
export class CommentToken extends AbstractLineToken {
    static type: TokenType = 'COMMENT';

    isIgnoredToken(): boolean {
        return true;
    }

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), {assert: true, name: 'line'});

        // is comment line starting with "* this is a comment"
        return /^\*.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(),  {assert: true, name: 'line'});
        validateSchema(lineNumber, z.number(), {assert: true, name: 'lineNumber'});

        const token = new CommentToken({ tokenTypes: this._tokenTypes });
        // keep original line
        token._line = line;
        token._tokenized = { line, lineNumber };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            'COMMENT',
            'BLANK',
            'AC',
            'AN',
            'AL',
            'AH',
            'DP',
            'VX',
            'VD',
            'DB',
            'DC',
            'EOF',
            'SKIPPED',
        ];
    }
}
