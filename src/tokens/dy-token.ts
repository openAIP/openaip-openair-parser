import { Parser as CoordinateParser } from '@openaip/coordinate-parser';
import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Tokenizes "DY" airway segment coordinate definition.
 */
export class DyToken extends AbstractLineToken {
    static type: TokenType = TokenTypeEnum.DY;

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is DY line e.g. "DY 54:25:00 N 010:40:00 E"
        return /^DY\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new DyToken({ tokenTypes: this._tokenTypes, extendedFormat: this._extendedFormat });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        // extract coordinate pair
        const linePartCoordinate = line.replace(/^DY\s+/, '');
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
        return [TokenTypeEnum.COMMENT, TokenTypeEnum.DY, TokenTypeEnum.BLANK, TokenTypeEnum.EOF, TokenTypeEnum.SKIPPED];
    }
}
