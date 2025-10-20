import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { type TokenType, TokenTypeEnum } from './token-type.enum.js';

type Metadata = { width: number };

/**
 * Tokenizes "V W=" airway width in nautical miles.
 */
export class VwToken extends AbstractLineToken<Metadata> {
    public static TYPE: TokenType = TokenTypeEnum.VW;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is W line e.g. "V W=2.5"
        return /^V\s+W=.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new VwToken({ tokenTypes: this.tokenTypes, version: this.version });
        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartWidth = line.replace(/^V\s+[W]=/, '');
        const isWidth = /^\d+(\.\d+)?$/.test(linePartWidth);
        if (!isWidth) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown airway width definition '${line}'` });
        }
        token.tokenized = { line, lineNumber, metadata: { width: parseFloat(linePartWidth) } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [TokenTypeEnum.COMMENT, TokenTypeEnum.DY, TokenTypeEnum.BLANK, TokenTypeEnum.EOF, TokenTypeEnum.SKIPPED];
    }
}
