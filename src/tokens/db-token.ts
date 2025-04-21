import { Parser as CoordinateParser } from '@openaip/coordinate-parser';
import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Tokenizes "DB" airspace arc endpoints definition.
 */
export class DbToken extends AbstractLineToken {
    static type: TokenType = TokenTypeEnum.DB;

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is DB line e.g. "DB 52:22:39 N 013:08:15 E , 52:24:33 N 013:11:02 E"
        return /^DB\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new DbToken({ tokenTypes: this._tokenTypes, extendedFormat: this._extendedFormat });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartEndpoints = line.replace(/^DB\s+/, '');
        // endpoints are defined as comma separated coordinate pairs
        const endpoints = linePartEndpoints.split(',');
        endpoints.map((value) => value.trim());
        // transform each endpoint coordinate string into coordinate object
        const coord = [];
        for (const coordinate of endpoints) {
            try {
                const parser = new CoordinateParser();
                const parsedCoordinate = parser.parse(coordinate.trim());
                coord.push(parsedCoordinate);
            } catch (e) {
                throw new ParserError({ lineNumber, errorMessage: `Unknown coordinate definition '${line}'` });
            }
        }
        token._tokenized = { line, lineNumber, metadata: { coordinates: coord } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            TokenTypeEnum.BLANK,
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.DP,
            TokenTypeEnum.VD,
            TokenTypeEnum.VX,
            TokenTypeEnum.SKIPPED,
        ];
    }
}
