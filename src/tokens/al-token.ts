import { z } from 'zod';
import { ParserError } from '../parser-error';
import { validateSchema } from '../validate-schema.js';
import { AbstractAltitudeToken } from './abstract-altitude-token';
import type { IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Tokenizes "AL" airspace lower ceiling definitions.
 */
export class AlToken extends AbstractAltitudeToken {
    static type: TokenType = TokenTypeEnum.AL;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AL line e.g. "AL GND"
        return /^AL\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AlToken({
            tokenTypes: this._tokenTypes,
            unlimited: this._unlimited,
            defaultAltUnit: this._defaultAltUnit,
            targetAltUnit: this._targetAltUnit,
            roundAltValues: this._roundAltValues,
            extendedFormat: this._extendedFormat,
        });

        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartAltitude = line.replace(/^AL\s+/, '');
        let altitude;
        try {
            altitude = this.getAltitude(linePartAltitude);
        } catch (e) {
            if (e instanceof SyntaxError) {
                throw new ParserError({ lineNumber, errorMessage: e.message });
            } else {
                throw e;
            }
        }
        token._tokenized = { line, lineNumber, metadata: { altitude } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.AG,
            TokenTypeEnum.AF,
            TokenTypeEnum.AH,
            TokenTypeEnum.DP,
            TokenTypeEnum.VW,
            TokenTypeEnum.VX,
            TokenTypeEnum.SKIPPED,
            TokenTypeEnum.VD,
            TokenTypeEnum.TP,
        ];
    }
}
