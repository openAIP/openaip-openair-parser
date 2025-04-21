import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import { type TokenType } from './token-type.enum.js';

export interface IToken {
    type: TokenType;
    line: string | undefined;
    tokenized: Tokenized | undefined;
    canHandle(line: string): boolean;
    tokenize(line: string, lineNumber: number): IToken;
    isIgnoredToken(): boolean;
    isAllowedNextToken(token: IToken): boolean;
}

export type Config = {
    // list of all known token types
    tokenTypes: TokenType[];
    // If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
    extendedFormat: boolean;
};

export const ConfigSchema = z
    .object({
        tokenTypes: z.array(z.string().nonempty()),
        extendedFormat: z.boolean(),
    })
    .strict()
    .describe('ConfigSchema');

export type Tokenized = {
    line: string;
    lineNumber: number;
    [metadata: string]: any;
};

export abstract class AbstractLineToken implements IToken {
    static type: TokenType = 'BASE_LINE';
    protected _tokenTypes: TokenType[];
    protected _extendedFormat: boolean;
    protected _tokenized: Tokenized | undefined;
    protected _line: string | undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { tokenTypes, extendedFormat } = config;

        this._tokenTypes = tokenTypes;
        this._extendedFormat = extendedFormat;
        this._tokenized = undefined;
        this._line = undefined;
    }

    /**
     * Returns true if the token can handle the string. False if not.
     */
    abstract canHandle(line: string): boolean;
    /**
     * Factory methods that returns a new token of the corresponding type that contains the tokenized
     * representation of the parsed OpenAIR line.
     */
    abstract tokenize(line: string, lineNumber: number): IToken;
    abstract getAllowedNextTokens(): TokenType[];

    get type(): TokenType {
        return AbstractLineToken.type;
    }

    get line(): string | undefined {
        return this._line;
    }

    get tokenized(): Tokenized | undefined {
        return this._tokenized;
    }

    /**
     * Most tokens are considered to be not ignored tokens. Blank, comment and other
     * specific tokens that are not handled are considered to be "ignored" tokens.
     */
    isIgnoredToken(): boolean {
        return false;
    }

    isAllowedNextToken(token: IToken): boolean {
        return this.getAllowedNextTokens().includes(token.type);
    }
}
