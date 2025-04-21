import { Parser as CoordinateParser } from '@openaip/coordinate-parser';
import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';

/**
 * Tokenizes "DP" airspace polygon coordinate definition.
 */
export class DpToken extends AbstractLineToken {
    static type: TokenType = 'DP';

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is DP line e.g. "DP 54:25:00 N 010:40:00 E"
        return /^DP\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new DpToken({ tokenTypes: this._tokenTypes });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        // extract coordinate pair
        const linePartCoordinate = line.replace(/^DP\s+/, '');
        let coordinate;
        try {
            const parser = new CoordinateParser();
            coordinate = parser.parse(linePartCoordinate.trim());
        } catch (e) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown coordinate definition '${line}'` });
        }
        token._tokenized = { line, lineNumber, metadata: { coordinate } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return ['COMMENT', 'DP', 'DA', 'BLANK', 'EOF', 'VD', 'VX', 'SKIPPED'];
    }
}
