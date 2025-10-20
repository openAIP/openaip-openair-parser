import fs from 'node:fs';
import LineByLine from 'n-readlines';
import { z } from 'zod';
import { type AltitudeUnit, AltitudeUnitEnum } from './altitude-unit.enum.js';
import { ParserError } from './parser-error.js';
import { type ParserVersion, ParserVersionEnum } from './parser-version.enum.js';
import { AaToken } from './tokens/aa-token.js';
import type { IToken } from './tokens/abstract-line-token.js';
import { AcToken } from './tokens/ac-token.js';
import { AfToken } from './tokens/af-token.js';
import { AgToken } from './tokens/ag-token.js';
import { AhToken } from './tokens/ah-token.js';
import { AlToken } from './tokens/al-token.js';
import { AnToken } from './tokens/an-token.js';
import { AxToken } from './tokens/ax-token.js';
import { AyToken } from './tokens/ay-token.js';
import { BlankToken } from './tokens/blank-token.js';
import { CommentToken } from './tokens/comment-token.js';
import { DaToken } from './tokens/da-token.js';
import { DbToken } from './tokens/db-token.js';
import { DcToken } from './tokens/dc-token.js';
import { DpToken } from './tokens/dp-token.js';
import { DyToken } from './tokens/dy-token.js';
import { EofToken } from './tokens/eof-token.js';
import { SkippedToken } from './tokens/skipped-token.js';
import { type TokenType, TokenTypeEnum } from './tokens/token-type.enum.js';
import { VdToken } from './tokens/vd-token.js';
import { VwToken } from './tokens/vw-token.js';
import { VxToken } from './tokens/vx-token.js';
import { validateSchema } from './validate-schema.js';

export type Config = {
    unlimited: number;
    targetAltUnit?: AltitudeUnit | undefined;
    roundAltValues: boolean;
    version: ParserVersion;
    allowedClasses: string[];
    allowedTypes: string[];
};

export const ConfigSchema = z
    .object({
        unlimited: z.number().int(),
        targetAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        roundAltValues: z.boolean(),
        version: z.nativeEnum(ParserVersionEnum),
        allowedClasses: z.array(z.string().min(1)),
        allowedTypes: z.array(z.string().min(1)),
    })
    .strict()
    .describe('ConfigSchema');

const TOKEN_TYPES = Object.values(TokenTypeEnum) as TokenType[];

/**
 * Reads the contents of a give file and tokenizes it. Each line will result in a single token.
 * Each token holds a tokenized representation of the read line. The tokenizer will return a list of all read
 * and created tokens. The tokenizer will throw a syntax error on the first error that is encountered.
 */
export class Tokenizer {
    public readonly config: Config;
    protected tokenizers: IToken[];
    // previous processed token, used to validate correct token order
    protected tokens: IToken[] = [];
    protected prevToken: IToken | undefined = undefined;
    protected currentLineNumber = 0;
    protected currentLineString: string | undefined = undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { unlimited, targetAltUnit, roundAltValues, version, allowedClasses, allowedTypes } = config;
        this.config = config;
        this.tokenizers = [
            new CommentToken({ tokenTypes: TOKEN_TYPES, version }),
            new SkippedToken({ tokenTypes: TOKEN_TYPES, version }),
            new BlankToken({ tokenTypes: TOKEN_TYPES, version }),
            new AcToken({
                tokenTypes: TOKEN_TYPES,
                version,
                allowedClasses,
            }),
            new AnToken({ tokenTypes: TOKEN_TYPES, version }),
            new AhToken({
                tokenTypes: TOKEN_TYPES,
                unlimited,
                targetAltUnit,
                roundAltValues,
                version,
            }),
            new AlToken({
                tokenTypes: TOKEN_TYPES,
                unlimited,
                targetAltUnit,
                roundAltValues,
                version,
            }),
            new DpToken({ tokenTypes: TOKEN_TYPES, version }),
            new VdToken({ tokenTypes: TOKEN_TYPES, version }),
            new VxToken({ tokenTypes: TOKEN_TYPES, version }),
            new VwToken({ tokenTypes: TOKEN_TYPES, version }),
            new DcToken({ tokenTypes: TOKEN_TYPES, version }),
            new DbToken({ tokenTypes: TOKEN_TYPES, version }),
            new DaToken({ tokenTypes: TOKEN_TYPES, version }),
            new DyToken({ tokenTypes: TOKEN_TYPES, version }),
            // version 2 tokens
            new AyToken({ tokenTypes: TOKEN_TYPES, version, allowedTypes }),
            new AfToken({ tokenTypes: TOKEN_TYPES, version }),
            new AgToken({ tokenTypes: TOKEN_TYPES, version }),
            new AxToken({ tokenTypes: TOKEN_TYPES, version }),
            new AaToken({ tokenTypes: TOKEN_TYPES, version }),
        ];
    }

    /**
     * Tokenizes the openAIR file at given path and returns the list of created tokens.
     */
    tokenize(filepath: string): IToken[] {
        validateSchema(filepath, z.string().nonempty(), { assert: true, name: 'filepath' });

        this.reset();
        this.enforceFileExists(filepath);
        const liner: LineByLine = new LineByLine(filepath);
        let line: Buffer | false;
        while ((line = liner.next()) !== false) {
            this.currentLineNumber++;
            // call trim to also remove newlines
            this.currentLineString = line.toString().trim();

            // find the tokenizer that can handle the current line
            const lineTokenizer = this.tokenizers.find((value) => value.canHandle(this.currentLineString as string));
            if (lineTokenizer == null) {
                // fail hard if unable to find a tokenizer for a specific line
                throw new ParserError({
                    lineNumber: this.currentLineNumber,
                    errorMessage: `Failed to read line ${this.currentLineNumber}. Unknown syntax.`,
                });
            }

            let token: IToken;
            try {
                token = lineTokenizer.tokenize(this.currentLineString, this.currentLineNumber);
            } catch (err) {
                let errorMessage = 'Unknown error occured';
                if (err instanceof Error) {
                    errorMessage = err.message;
                }
                throw new ParserError({
                    lineNumber: this.currentLineNumber,
                    errorMessage,
                });
            }
            this.tokens.push(token);
            this.prevToken = token;
        }
        // finalize by adding EOF token
        this.tokens.push(
            new EofToken({
                tokenTypes: TOKEN_TYPES,
                lastLineNumber: this.currentLineNumber,
                version: this.config.version,
            })
        );

        return this.tokens;
    }

    protected enforceFileExists(filepath: string): void {
        const exists = fs.existsSync(filepath);
        if (!exists) {
            throw new Error(`Failed to read file ${filepath}`);
        }
    }

    protected reset(): void {
        this.tokens = [];
        this.prevToken = undefined;
        this.currentLineNumber = 0;
        this.currentLineString = undefined;
    }
}
