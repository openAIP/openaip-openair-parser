import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { type TokenType, TokenTypeEnum } from './token-type.enum.js';

type Metadata = { x: number; y: number; azimuth: number };

/**
 * Tokenizes "DE" airspace ellipse definition.
 */
export class DeToken extends AbstractLineToken<Metadata> {
    public static TYPE: TokenType = TokenTypeEnum.DE;

    canHandle(line: string): boolean {
        // is DE line e.g. "DE 43.2,21.6,53", ellipse: axis dimension NM, axis dimension NM, azimuth of the major (longest) axis in degrees (0-359)
        return /^DE\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new DeToken({ tokenTypes: this.tokenTypes, version: this.version });
        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const ellipseParts = line.replace(/^DE\s+/, '');
        // endpoints are defined as comma separated coordinate pairs
        const parts = ellipseParts.split(',').map((value) => value.trim());
        // line contains both axis dimensions in NM (in any order) and the azimuth of the major (longest) axis in degrees (0-359)
        const [x, y, azimuth] = parts;
        // transform each endpoint coordinate string into coordinate object
        const metadata: Partial<Metadata> = {};
        const isValidX = /^\d+(\.\d+)?$/.test(x);
        if (isValidX === false) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown DE x axis definition '${line}'` });
        }
        const isValidY = /^\d+(\.\d+)?$/.test(y);
        if (isValidY === false) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown DE y axis definition '${line}'` });
        }
        const isValidAzimuth = /^\d+(\.\d+)?$/.test(azimuth);
        if (isValidAzimuth === false) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown DE azimuth definition '${line}'` });
        }

        metadata.x = parseFloat(x);
        metadata.y = parseFloat(y);
        metadata.azimuth = parseFloat(azimuth);

        // check that x/y are positive numbers - a zero axis dimension would create a degenerate geometry
        if (metadata.x <= 0) {
            throw new ParserError({ lineNumber, errorMessage: `DE x must be a positive number, got ${metadata.x}` });
        }
        if (metadata.y <= 0) {
            throw new ParserError({ lineNumber, errorMessage: `DE y must be a positive number, got ${metadata.y}` });
        }

        token.tokenized = { line, lineNumber, metadata: metadata as Metadata };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [TokenTypeEnum.BLANK, TokenTypeEnum.COMMENT, TokenTypeEnum.EOF, TokenTypeEnum.SKIPPED];
    }
}
