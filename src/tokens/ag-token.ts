import { z } from 'zod';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken } from './abstract-line-token.js';
import type { IToken } from './abstract-line-token.js';

/**
 * Tokenizes "AG" ground station call-sign for given AF frequency.
 */
export class AgToken extends AbstractLineToken {
    static type: TokenType = 'AG';

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is AI line e.g. "AI f012e054-e9a4-43dd-87be-eb88b3088439"
        return /^AG\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AgToken({ tokenTypes: this._tokenTypes });

        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AG\s+/, '');
        token._tokenized = { line, lineNumber, metadata: { name: linePartName } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return ['COMMENT', 'AF', 'AL', 'AH', 'DP', 'VW', 'VX', 'SKIPPED', 'VD'];
    }
}
