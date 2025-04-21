import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Tokenizes "AI" unique airspace identifier string.
 */
export class AiToken extends AbstractLineToken {
    static type: TokenType = TokenTypeEnum.AI;

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is AI line e.g. "AI f012e054-e9a4-43dd-87be-eb88b3088439"
        return /^AI\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AiToken({ tokenTypes: this._tokenTypes, extendedFormat: this._extendedFormat });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AI\s+/, '');
        token._tokenized = { line, lineNumber, metadata: { identifier: linePartName } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        // no extended format option handling, AG token only in extended format
        return [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.AN,
            TokenTypeEnum.AY,
            TokenTypeEnum.AF,
            TokenTypeEnum.AG,
            TokenTypeEnum.AL,
            TokenTypeEnum.AH,
            TokenTypeEnum.SKIPPED,
            TokenTypeEnum.TP,
        ];
    }
}
