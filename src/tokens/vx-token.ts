import { Parser as CoordinateParser } from '@openaip/coordinate-parser';
import type { Coordinate } from '@openaip/coordinate-parser/dist/types/types.js';
import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { coordinate: Coordinate };

/**
 * Tokenizes "V X=" airspace circle center coordinate definition.
 */
export class VxToken extends AbstractLineToken<Metadata> {
    static type: TokenType = TokenTypeEnum.VX;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is V line e.g. "V X=53:24:25 N 010:25:10 E"
        return /^V\s+X=.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new VxToken({ tokenTypes: this._tokenTypes, version: this._version });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartCoordinate = line.replace(/^V\s+[X]=/, '');
        let coordinate: Coordinate;
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
        return [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.DC,
            TokenTypeEnum.DB,
            TokenTypeEnum.DA,
            TokenTypeEnum.VD,
            TokenTypeEnum.SKIPPED,
        ];
    }
}
