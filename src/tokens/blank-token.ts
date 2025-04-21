import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import {AbstractLineToken, type IToken} from './abstract-line-token.js';
import type { TokenType } from '../types.js';

/**
 * Handles blank lines. Each blank line is considered to separate each airspace definition block.
 */
export class BlankToken extends AbstractLineToken {
    static type: TokenType = 'BLANK_TOKEN';

    isIgnoredToken(): boolean {
        return true;
    }

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line'});

        return line.length === 0;
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(),  {assert: true, name: 'line'});
        validateSchema(lineNumber, z.number(), {assert: true, name: 'lineNumber'});

        const token = new BlankToken({ tokenTypes: this._tokenTypes });
        token._tokenized = { line, lineNumber };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return ['BLANK', 'AC', 'COMMENT', 'EOF', 'SKIPPED'];
    }
}
