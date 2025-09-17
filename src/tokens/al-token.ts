import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractAltitudeToken } from './abstract-altitude-token.js';
import type { IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Tokenizes "AL" airspace lower ceiling definitions.
 */
export class AlToken extends AbstractAltitudeToken {
    static TYPE: TokenType = TokenTypeEnum.AL;

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
            tokenTypes: this.tokenTypes,
            unlimited: this.unlimited,
            targetAltUnit: this.targetAltUnit,
            roundAltValues: this.roundAltValues,
            version: this.version,
        });

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartAltitude = line.replace(/^AL\s+/, '');
        let altitude;
        try {
            altitude = this.getAltitude(linePartAltitude);
        } catch (err) {
            if (err instanceof SyntaxError) {
                throw new ParserError({ lineNumber, errorMessage: err.message });
            } else {
                throw err;
            }
        }
        token.tokenized = { line, lineNumber, metadata: { altitude } };

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
            TokenTypeEnum.AX,
        ];
    }
}
