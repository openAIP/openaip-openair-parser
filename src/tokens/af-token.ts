import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { frequency: string };

/**
 * Tokenizes "AF" token value which is a frequency string "123.456"
 */
export class AfToken extends AbstractLineToken<Metadata> {
    public static TYPE: TokenType = TokenTypeEnum.AF;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AF line e.g. "AF 123.456"
        return /^AF\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AfToken({ tokenTypes: this.tokenTypes, version: this.version });
        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartFrequency = line.replace(/^AF\s+/, '');
        // validate frequency string
        const isValidFrequency = /^\d{3}\.\d{3}$/.test(linePartFrequency);
        if (isValidFrequency === false) {
            throw new ParserError({ lineNumber, errorMessage: `Invalid frequency string '${line}'` });
        }
        token.tokenized = { line, lineNumber, metadata: { frequency: linePartFrequency } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.AG,
            TokenTypeEnum.AL,
            TokenTypeEnum.AH,
            TokenTypeEnum.SKIPPED,
            TokenTypeEnum.DP,
            TokenTypeEnum.VW,
            TokenTypeEnum.VX,
            TokenTypeEnum.VD,
            TokenTypeEnum.AX,
            TokenTypeEnum.AA,
        ];
    }
}
