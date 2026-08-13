import fs from 'node:fs';
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
    warnIfExpired?: boolean;
};

export const ConfigSchema = z
    .object({
        unlimited: z.number().int(),
        targetAltUnit: z.enum(AltitudeUnitEnum).optional(),
        roundAltValues: z.boolean(),
        version: z.enum(ParserVersionEnum),
        allowedClasses: z.array(z.string().min(1)),
        allowedTypes: z.array(z.string().min(1)),
        warnIfExpired: z.boolean().optional(),
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
    // dispatch maps for O(1) tokenizer lookup by line prefix
    protected prefixDispatch: Map<string, IToken> = new Map();
    protected vDispatch: Map<string, IToken> = new Map();
    protected skippedDispatch: Map<string, IToken> = new Map();
    protected commentTokenizer: IToken | undefined = undefined;
    protected blankTokenizer: IToken | undefined = undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { unlimited, targetAltUnit, roundAltValues, version, allowedClasses, allowedTypes, warnIfExpired } =
            config;
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
            new AaToken({ tokenTypes: TOKEN_TYPES, version, warnIfExpired }),
        ];

        // build prefix -> tokenizer dispatch maps for fast line routing
        const byType = new Map<TokenType, IToken>();
        for (const tokenizer of this.tokenizers) {
            byType.set(tokenizer.type, tokenizer);
        }
        const twoLetterPrefixes: Record<string, TokenType> = {
            AC: TokenTypeEnum.AC,
            AN: TokenTypeEnum.AN,
            AH: TokenTypeEnum.AH,
            AL: TokenTypeEnum.AL,
            DP: TokenTypeEnum.DP,
            DC: TokenTypeEnum.DC,
            DB: TokenTypeEnum.DB,
            DA: TokenTypeEnum.DA,
            DY: TokenTypeEnum.DY,
            AY: TokenTypeEnum.AY,
            AF: TokenTypeEnum.AF,
            AG: TokenTypeEnum.AG,
            AX: TokenTypeEnum.AX,
            AA: TokenTypeEnum.AA,
        };
        for (const [prefix, type] of Object.entries(twoLetterPrefixes)) {
            const tokenizer = byType.get(type);
            if (tokenizer != null) this.prefixDispatch.set(prefix, tokenizer);
        }
        // "V <letter>=" tokens are dispatched by the variable letter after "V "
        this.vDispatch.set('D', byType.get(TokenTypeEnum.VD) as IToken);
        this.vDispatch.set('X', byType.get(TokenTypeEnum.VX) as IToken);
        this.vDispatch.set('W', byType.get(TokenTypeEnum.VW) as IToken);
        // "V Z=" is a skipped token
        this.vDispatch.set('Z', byType.get(TokenTypeEnum.SKIPPED) as IToken);
        // skipped token prefixes (AT, TO, TC, SP, SB)
        const skippedTokenizer = byType.get(TokenTypeEnum.SKIPPED) as IToken;
        for (const prefix of ['AT', 'TO', 'TC', 'SP', 'SB']) {
            this.skippedDispatch.set(prefix, skippedTokenizer);
        }
        this.commentTokenizer = byType.get(TokenTypeEnum.COMMENT);
        this.blankTokenizer = byType.get(TokenTypeEnum.BLANK);
    }

    /**
     * Resolves the tokenizer that is responsible for the given line by prefix dispatch.
     * Returns undefined if no prefix match is found; callers must fall back to a full scan
     * to preserve the original "unknown syntax" behavior for malformed lines.
     */
    protected resolveTokenizer(line: string): IToken | undefined {
        if (line.length === 0) {
            return this.blankTokenizer;
        }
        if (line[0] === '*') {
            return this.commentTokenizer;
        }
        if (line.length >= 2) {
            const prefix = line.slice(0, 2);
            if (prefix === 'V ') {
                // skip whitespace after "V " and dispatch by the variable letter (D/X/W/Z)
                let i = 2;
                while (i < line.length && line[i] === ' ') {
                    i++;
                }
                return this.vDispatch.get(line[i]);
            }
            const skipped = this.skippedDispatch.get(prefix);
            if (skipped != null) {
                return skipped;
            }
            return this.prefixDispatch.get(prefix);
        }
        return undefined;
    }

    /**
     * Tokenizes the openAIR file at given path and returns the list of created tokens.
     */
    tokenize(filepath: string): IToken[] {
        validateSchema(filepath, z.string().nonempty(), { assert: true, name: 'filepath' });

        this.reset();
        this.enforceFileExists(filepath);

        // Read file content and split into lines
        const content = fs.readFileSync(filepath, 'utf-8');
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            this.currentLineNumber++;
            // call trim to also remove newlines
            this.currentLineString = line.trim();

            // find the tokenizer that can handle the current line - try the fast prefix dispatch
            // first, then fall back to a full scan to preserve behavior for malformed lines
            const candidate = this.resolveTokenizer(this.currentLineString as string);
            const lineTokenizer =
                candidate != null && candidate.canHandle(this.currentLineString as string)
                    ? candidate
                    : this.tokenizers.find((value) => value.canHandle(this.currentLineString as string));
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
