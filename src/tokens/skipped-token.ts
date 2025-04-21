import { z } from 'zod';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import type { IToken } from './abstract-line-token.js';
import {CommentToken} from './comment-token';

/**
 * Handles skipped tokens.
 */
export class SkippedToken extends CommentToken {
    static type: TokenType = 'SKIPPED';

    isIgnoredToken() {
        return true;
    }

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // line contains a skipped token
        return /^(AT|TO|TC|SP|SB|V Z=\d).*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(),  {assert: true, name: 'line'});
        validateSchema(lineNumber, z.number(), {assert: true, name: 'lineNumber'});

        const token = new SkippedToken({ tokenTypes: this._tokenTypes });
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
            'AI',
            'AY',
            'AF',
            'AG',
        ];
    }
}
