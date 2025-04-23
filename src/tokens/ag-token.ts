import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken } from './abstract-line-token.js';
import type { IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { name: string };

/**
 * Tokenizes "AG" ground station call-sign for given AF frequency.
 */
export class AgToken extends AbstractLineToken<Metadata> {
    static type: TokenType = TokenTypeEnum.AG;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AI line e.g. "AI f012e054-e9a4-43dd-87be-eb88b3088439"
        return /^AG\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AgToken({ tokenTypes: this._tokenTypes, extendedFormat: this._extendedFormat });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AG\s+/, '');
        token._tokenized = { line, lineNumber, metadata: { name: linePartName } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.AF,
            TokenTypeEnum.AL,
            TokenTypeEnum.AH,
            TokenTypeEnum.DP,
            TokenTypeEnum.VW,
            TokenTypeEnum.VX,
            TokenTypeEnum.SKIPPED,
            TokenTypeEnum.VD,
        ];
    }
}
