import { z } from 'zod';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';

/**
 * Tokenizes "AI" unique airspace identifier string.
 */
export class AiToken extends AbstractLineToken {
    static type: TokenType = 'AI';

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is AI line e.g. "AI f012e054-e9a4-43dd-87be-eb88b3088439"
        return /^AI\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AiToken({ tokenTypes: this._tokenTypes });

        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AI\s+/, '');

        token._tokenized = { line, lineNumber, metadata: { identifier: linePartName } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        // no extended format option handling, AG token only in extended format
        return ['COMMENT', 'AN', 'AY', 'AF', 'AG', 'AL', 'AH', 'SKIPPED', 'TP'];
    }
}
