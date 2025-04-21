import {AbstractLineToken, type IToken} from './abstract-line-token';
import {ParserError} from '../parser-error';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import { z } from 'zod';

/**
 * Tokenizes "AF" token value which is a frequency string "123.456"
 */
export class AfToken extends AbstractLineToken {
    static type: TokenType = 'AF';

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), {assert: true, name: 'line'});

        // is AF line e.g. "AF 123.456"
        return /^AF\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(),  {assert: true, name: 'line'});
        validateSchema(lineNumber, z.number(), {assert: true, name: 'lineNumber'});

        const token = new AfToken({ tokenTypes: this._tokenTypes });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartFrequency = line.replace(/^AF\s+/, '');
        // validate frequency string
        const isValidFrequency = /^\d{3}\.\d{3}$/.test(linePartFrequency);
        if (isValidFrequency === false) {
            throw new ParserError({ lineNumber, errorMessage: `Invalid frequency string '${line}'` });
        }
        token._tokenized = { line, lineNumber, metadata: { frequency: linePartFrequency } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            'COMMENT',
            'AG',
            'AL',
            'AH',
            'SKIPPED',
            'DP',
            'VW',
            'VX',
            'VD',
            'TP',
        ];
    }
}
