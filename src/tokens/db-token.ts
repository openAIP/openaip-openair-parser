import { Parser as CoordinateParser } from '@openaip/coordinate-parser';
import type { Coordinate } from '@openaip/coordinate-parser/types';
import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { startCoordinate: Coordinate; endCoordinate: Coordinate };

/**
 * Tokenizes "DB" airspace arc endpoints definition.
 */
export class DbToken extends AbstractLineToken<Metadata> {
    static TYPE: TokenType = TokenTypeEnum.DB;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is DB line e.g. "DB 52:22:39 N 013:08:15 E , 52:24:33 N 013:11:02 E"
        return /^DB\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new DbToken({ tokenTypes: this.tokenTypes, version: this.version });
        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartEndpoints = line.replace(/^DB\s+/, '');
        // endpoints are defined as comma separated coordinate pairs
        const endpoints = linePartEndpoints.split(',');
        endpoints.map((value) => value.trim());
        // transform each endpoint coordinate string into coordinate object
        const metadata: Partial<Metadata> = {};
        try {
            const [startCoordinateString, endCoordinateString] = endpoints;
            metadata.startCoordinate = this.getCoordinate(startCoordinateString);
            metadata.endCoordinate = this.getCoordinate(endCoordinateString);
        } catch (err) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown coordinate definition '${line}'` });
        }
        token.tokenized = { line, lineNumber, metadata: metadata as Metadata };

        return token;
    }

    getCoordinate(coordinateString: string): Coordinate {
        const parser = new CoordinateParser();
        const parsedCoordinate: Coordinate = parser.parse(coordinateString.trim());

        return parsedCoordinate;
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
