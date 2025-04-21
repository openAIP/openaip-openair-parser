import { z } from 'zod';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import type { IToken } from './abstract-line-token.js';
import { AbstractLineToken } from './abstract-line-token.js';

/**
 * Tokenizes "AN" airspace name definitions.
 */
export class AnToken extends AbstractLineToken {
    static type: TokenType = 'AN';

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is AN line e.g. "AN ED-R10B Todendorf-Putlos MON-SAT+"
        return /^AN\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AnToken({ tokenTypes: this._tokenTypes, extendedFormat: this._extendedFormat });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AN\s+/, '');
        token._tokenized = { line, lineNumber, metadata: { name: linePartName } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        // defines allowed tokens in the original format
        let allowedNextTokens: TokenType[] = ['COMMENT', 'AL', 'AH', 'SKIPPED'];
        // inject extended format tokens if required
        if (this._extendedFormat === true) {
            allowedNextTokens = allowedNextTokens.concat(['AI', 'AF', 'AG', 'TP'] as TokenType[]);
        }

        return allowedNextTokens;
    }
}
