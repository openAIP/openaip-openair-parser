import { Parser as CoordinateParser } from '@openaip/coordinate-parser';
import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import type { TokenType } from '../types.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';

/**
 * Tokenizes "V X=" airspace circle center coordinate definition.
 */
export class VxToken extends AbstractLineToken {
    static type: TokenType = 'VX';

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is V line e.g. "V X=53:24:25 N 010:25:10 E"
        return /^V\s+X=.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new VxToken({ tokenTypes: this._tokenTypes });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartCoordinate = line.replace(/^V\s+[X]=/, '');
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
        return ['COMMENT', 'DC', 'DB', 'DA', 'VD', 'SKIPPED'];
    }
}
