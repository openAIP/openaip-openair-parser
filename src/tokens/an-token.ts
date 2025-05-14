import { z } from 'zod';
import { ParserVersionEnum } from '../parser-version.enum.js';
import { validateSchema } from '../validate-schema.js';
import type { IToken } from './abstract-line-token.js';
import { AbstractLineToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = { name: string };

/**
 * Tokenizes "AN" airspace name definitions.
 */
export class AnToken extends AbstractLineToken<Metadata> {
    static type: TokenType = TokenTypeEnum.AN;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AN line e.g. "AN ED-R10B Todendorf-Putlos MON-SAT+"
        return /^AN\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AnToken({ tokenTypes: this._tokenTypes, version: this._version });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AN\s+/, '');
        token._tokenized = { line, lineNumber, metadata: { name: linePartName } };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        // defines allowed tokens in the original format
        let allowedNextTokens: TokenType[] = [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.AL,
            TokenTypeEnum.AH,
            TokenTypeEnum.SKIPPED,
        ];
        // inject version 2 tokens if required
        if (this._version === ParserVersionEnum.VERSION_2) {
            allowedNextTokens = allowedNextTokens.concat([
                TokenTypeEnum.AF,
                TokenTypeEnum.AG,
                TokenTypeEnum.AX,
                TokenTypeEnum.AA,
            ] as TokenType[]);
        }

        return allowedNextTokens;
    }
}
