import { z } from 'zod';
import { ParserError } from '../parser-error.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

/**
 * Tokenizes "DC" airspace circle radius definition.
 */
export class DcToken extends AbstractLineToken {
    static type: TokenType = TokenTypeEnum.DC;

    canHandle(line: string): boolean {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });

        // is DC line e.g. "DC 1.10"
        return /^DC\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new DcToken({ tokenTypes: this._tokenTypes, extendedFormat: this._extendedFormat });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartRadius = line.replace(/^DC\s+/, '');
        const isRadius = /^\d+(\.\d+)?$/.test(linePartRadius);
        if (!isRadius) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown circle radius definition '${line}'` });
        }
        token._tokenized = { line, lineNumber, metadata: { radius: parseFloat(linePartRadius) } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [TokenTypeEnum.BLANK, TokenTypeEnum.COMMENT, TokenTypeEnum.EOF, TokenTypeEnum.SKIPPED];
    }
}
