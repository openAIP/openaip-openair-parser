import fs from 'node:fs';
import LineByLine from 'n-readlines';
import { z } from 'zod';
import { AltitudeUnitEnum, type AltitudeUnit } from './altitude-unit.enum.js';
import { ParserError } from './parser-error.js';
import type { IToken } from './tokens/abstract-line-token.js';
import { AcToken } from './tokens/ac-token.js';
import { AfToken } from './tokens/af-token.js';
import { AgToken } from './tokens/ag-token.js';
import { AhToken } from './tokens/ah-token.js';
import { AiToken } from './tokens/ai-token.js';
import { AlToken } from './tokens/al-token.js';
import { AnToken } from './tokens/an-token.js';
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
import { TokenTypeEnum, type TokenType } from './tokens/token-type.enum.js';
import { AxToken } from './tokens/ax-token.js';
import { VdToken } from './tokens/vd-token.js';
import { VwToken } from './tokens/vw-token.js';
import { VxToken } from './tokens/vx-token.js';
import { validateSchema } from './validate-schema.js';

export type Config = {
    airspaceClasses: string[];
    unlimited: number;
    defaultAltUnit: AltitudeUnit;
    targetAltUnit?: AltitudeUnit | undefined;
    roundAltValues: boolean;
    extendedFormat: boolean;
    extendedFormatClasses: string[];
    extendedFormatTypes: string[];
};

export const ConfigSchema = z
    .object({
        airspaceClasses: z.array(z.string().min(1)),
        unlimited: z.number().int(),
        defaultAltUnit: z.nativeEnum(AltitudeUnitEnum),
        targetAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        roundAltValues: z.boolean(),
        extendedFormat: z.boolean(),
        extendedFormatClasses: z.array(z.string().min(1)),
        extendedFormatTypes: z.array(z.string().min(1)),
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
    protected _config: Config;
    protected tokenizers: IToken[];
    // previous processed token, used to validate correct token order
    protected _tokens: IToken[] = [];
    /** @type {typedefs.openaip.OpenairParser.Token} */
    protected _prevToken: IToken | undefined = undefined;
    protected _currentLineNumber = 0;
    protected _currentLineString: string | undefined = undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const {
            airspaceClasses,
            unlimited,
            defaultAltUnit,
            targetAltUnit,
            roundAltValues,
            extendedFormat,
            extendedFormatClasses,
            extendedFormatTypes,
        } = config;
        this._config = config;
        /** @type {typedefs.openaip.OpenairParser.Token[]} */
        this.tokenizers = [
            new CommentToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new SkippedToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new BlankToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new AcToken({
                tokenTypes: TOKEN_TYPES,
                airspaceClasses,
                extendedFormat,
                extendedFormatClasses,
            }),
            new AnToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new AhToken({
                tokenTypes: TOKEN_TYPES,
                unlimited,
                defaultAltUnit,
                targetAltUnit,
                roundAltValues,
                extendedFormat,
            }),
            new AlToken({
                tokenTypes: TOKEN_TYPES,
                unlimited,
                defaultAltUnit,
                targetAltUnit,
                roundAltValues,
                extendedFormat,
            }),
            new DpToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new VdToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new VxToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new VwToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new DcToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new DbToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new DaToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new DyToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            // extended format tokens
            new AiToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new AyToken({ tokenTypes: TOKEN_TYPES, extendedFormat, extendedFormatTypes }),
            new AfToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new AgToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
            new AxToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
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
            this._currentLineNumber++;
            // call trim to also remove newlines
            this._currentLineString = line.toString().trim();

            // find the tokenizer that can handle the current line
            const lineTokenizer = this.tokenizers.find((value) => value.canHandle(this._currentLineString as string));
            if (lineTokenizer == null) {
                // fail hard if unable to find a tokenizer for a specific line
                throw new ParserError({
                    lineNumber: this._currentLineNumber,
                    errorMessage: `Failed to read line ${this._currentLineNumber}. Unknown syntax.`,
                });
            }

            let token: IToken;
            try {
                token = lineTokenizer.tokenize(this._currentLineString, this._currentLineNumber);
            } catch (e) {
                throw new ParserError({
                    lineNumber: this._currentLineNumber,
                    errorMessage: e.message,
                });
            }
            this._tokens.push(token);
        }
        // finalize by adding EOF token
        this._tokens.push(
            new EofToken({
                tokenTypes: TOKEN_TYPES,
                lastLineNumber: this._currentLineNumber,
                extendedFormat: this._config.extendedFormat,
            })
        );

        return this._tokens;
    }

    protected async enforceFileExists(filepath: string): Promise<void> {
        const exists = fs.existsSync(filepath);
        if (!exists) {
            throw new Error(`Failed to read file ${filepath}`);
        }
    }

    protected reset(): void {
        this._tokens = [];
        this._prevToken = undefined;
        this._currentLineNumber = 0;
        this._currentLineString = undefined;
    }
}
