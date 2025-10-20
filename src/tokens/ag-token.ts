import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import type { IToken } from './abstract-line-token.js';
import { AbstractLineToken } from './abstract-line-token.js';
import { type TokenType, TokenTypeEnum } from './token-type.enum.js';

type Metadata = { name: string };

/**
 * Tokenizes "AG" ground station call-sign for given AF frequency.
 */
export class AgToken extends AbstractLineToken<Metadata> {
    public static TYPE: TokenType = TokenTypeEnum.AG;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AG line e.g. "AG INNSBRUCK RADAR"
        return /^AG\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AgToken({ tokenTypes: this.tokenTypes, version: this.version });
        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AG\s+/, '');
        token.tokenized = { line, lineNumber, metadata: { name: linePartName } };

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
            TokenTypeEnum.AA,
            TokenTypeEnum.AX,
        ];
    }
}
