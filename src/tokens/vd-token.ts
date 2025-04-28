import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { clockwise: boolean };

/**
 * Handles the D token which is part of an arc definition and declares turn-direction, e.g. clockwise or counter-clockwise.
 * Since the the DB token will get the center point AND start and end coordinates, this token can be omitted.
 */
export class VdToken extends AbstractLineToken<Metadata> {
    static type: TokenType = TokenTypeEnum.VD;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is VD line e.g. "V D=-"
        return /^V\s+D=[+-]$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new VdToken({ tokenTypes: this._tokenTypes, version: this._version });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        // canHandle function already validated correct clockwise/counter-clockwise definition => only get +/-
        const linePartClockwise = line.replace(/^V\s+D=/, '');
        token._tokenized = { line, lineNumber, metadata: { clockwise: linePartClockwise === '+' } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [TokenTypeEnum.COMMENT, TokenTypeEnum.VX, TokenTypeEnum.DA, TokenTypeEnum.DB, TokenTypeEnum.SKIPPED];
    }
}
