import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import { type TokenType } from './token-type.enum.js';

export type Tokenized<M = undefined> = {
    line: string;
    lineNumber: number;
} & (M extends undefined ? { metadata?: M } : { metadata: M });

export interface IToken {
    type: TokenType;
    line: string | undefined;
    tokenized: {
        line: string;
        lineNumber: number;
        metadata?: unknown;
    };
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

export abstract class AbstractLineToken<M> implements IToken {
    static type: TokenType = 'BASE_LINE';
    protected _tokenTypes: TokenType[];
    protected _extendedFormat: boolean;
    protected _tokenized: Tokenized<M> | undefined;
    protected _line: string | undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { tokenTypes, extendedFormat } = config;

        this._tokenTypes = tokenTypes;
        this._extendedFormat = extendedFormat;
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
        // this is required to get the static type of the concrete class later
        return (this.constructor as typeof AbstractLineToken).type;
    }

    get line(): string | undefined {
        return this._line;
    }

    get tokenized(): Tokenized<M> {
        if (this._tokenized == null) {
            throw new Error('Tokenized representation is not available. Tokenize the line first.');
        }
        return this._tokenized as Tokenized<M>;
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
