import { z } from 'zod';
import { type ParserVersion, ParserVersionEnum } from '../parser-version.enum.js';
import { validateSchema } from '../validate-schema.js';
import type { TokenType } from './token-type.enum.js';

export type Tokenized<M = undefined> = {
    line: string;
    lineNumber: number;
} & (M extends undefined ? { metadata?: M } : { metadata: M });

export interface IToken {
    type: TokenType;
    line: string | undefined;
    toTokenized(): {
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
    version: ParserVersion;
};

export const ConfigSchema = z
    .object({
        tokenTypes: z.array(z.string().nonempty()),
        version: z.nativeEnum(ParserVersionEnum),
    })
    .strict()
    .describe('ConfigSchema');

export abstract class AbstractLineToken<M> implements IToken {
    // this is defined in each class but to retrieve the actual value later, use the getter "type"
    public static TYPE: TokenType = 'BASE_LINE';
    public tokenTypes: TokenType[];
    public line: string | undefined;
    protected version: ParserVersion;
    protected tokenized?: Tokenized<M> | undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { tokenTypes, version } = config;

        this.tokenTypes = tokenTypes;
        this.version = version;
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
        return (this.constructor as typeof AbstractLineToken).TYPE;
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

    toTokenized(): Tokenized<M> {
        if (this.tokenized == null) {
            throw new Error('Tokenized representation is not available. Tokenize the line first.');
        }
        return this.tokenized;
    }
}
