import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';

/**
 * Tokenizes "V W=" airway width in nautical miles.
 */
export class VwToken extends AbstractLineToken {
    static type: TokenType = 'VW';

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is W line e.g. "V W=2.5"
        return /^V\s+W=.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new VwToken({ tokenTypes: this._tokenTypes });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartWidth = line.replace(/^V\s+[W]=/, '');
        const isWidth = /^\d+(\.\d+)?$/.test(linePartWidth);
        if (!isWidth) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown airway width definition '${line}'` });
        }
        token._tokenized = { line, lineNumber, metadata: { width: parseFloat(linePartWidth) } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return ['COMMENT', 'DY', 'BLANK', 'EOF', 'SKIPPED'];
    }
}
