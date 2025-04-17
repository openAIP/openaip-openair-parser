import CommentToken from './tokens/comment-token.js';
import SkippedToken from './tokens/skipped-token.js';
import BlankToken from './tokens/blank-token.js';
import AcToken from './tokens/ac-token.js';
import AnToken from './tokens/an-token.js';
import AhToken from './tokens/ah-token.js';
import AlToken from './tokens/al-token.js';
import DpToken from './tokens/dp-token.js';
import VdToken from './tokens/vd-token.js';
import VxToken from './tokens/vx-token.js';
import VwToken from './tokens/vw-token.js';
import DcToken from './tokens/dc-token.js';
import DbToken from './tokens/db-token.js';
import DaToken from './tokens/da-token.js';
import DyToken from './tokens/dy-token.js';
import EofToken from './tokens/eof-token.js';
import AiToken from './tokens/ai-token.js';
import AyToken from './tokens/ay-token.js';
import AfToken from './tokens/af-token.js';
import AgToken from './tokens/ag-token.js';
import TpToken from './tokens/tp-token.js';
import LineByLine from 'n-readlines';
import fs from 'node:fs';
import {ParserError} from './parser-error.js';

/**
 * @typedef typedefs.openaip.OpenairParser.Token
 * @type Object
 * @property {function} isIgnoredToken
 * @property {function} tokenize
 * @property {function} getTokenized
 * @property {function} getType
 * @property {function} canHandle
 * @property {function} isAllowedNextToken
 */

/**
 * List of token types required for "isAllowedNextToken" type checks. Mainly to avoid directly requiring tokens in a token
 * and creating circular dependencies.
 *
 * @typedef typedefs.openaip.OpenairParser.TokenTypes
 * @type {Object}
 * @property {string} COMMENT_TOKEN
 * @property {string} BLANK_TOKEN
 * @property {string} AC_TOKEN
 * @property {string} AN_TOKEN
 * @property {string} AH_TOKEN
 * @property {string} AL_TOKEN
 * @property {string} DP_TOKEN
 * @property {string} VD_TOKEN
 * @property {string} VX_TOKEN
 * @property {string} DC_TOKEN
 * @property {string} DB_TOKEN
 * @property {string} DA_TOKEN
 * @property {string} EOF_TOKEN
 * @property {string} SKIPPED_TOKEN
 * @property {string} AI_TOKEN
 * @property {string} AY_TOKEN
 * @property {string} AF_TOKEN
 * @property {string} AG_TOKEN
 * @property {string} TP_TOKEN
 */
const TOKEN_TYPES = {
    COMMENT_TOKEN: CommentToken.type,
    BLANK_TOKEN: BlankToken.type,
    AC_TOKEN: AcToken.type,
    AN_TOKEN: AnToken.type,
    AH_TOKEN: AhToken.type,
    AL_TOKEN: AlToken.type,
    DP_TOKEN: DpToken.type,
    VD_TOKEN: VdToken.type,
    VX_TOKEN: VxToken.type,
    VW_TOKEN: VwToken.type,
    DC_TOKEN: DcToken.type,
    DB_TOKEN: DbToken.type,
    DA_TOKEN: DaToken.type,
    DY_TOKEN: DyToken.type,
    EOF_TOKEN: EofToken.type,
    SKIPPED_TOKEN: SkippedToken.type,
    // extended format tokens
    AI_TOKEN: AiToken.type,
    AY_TOKEN: AyToken.type,
    AF_TOKEN: AfToken.type,
    AG_TOKEN: AgToken.type,
    TP_TOKEN: TpToken.type,
};

/**
 * Reads the contents of a give file and tokenizes it. Each line will result in a single token.
 * Each token holds a tokenized representation of the read line. The tokenizer will return a list of all read
 * and created tokens. The tokenizer will throw a syntax error on the first error that is encountered.
 */
class Tokenizer {
    /**
     * @param {Object} config
     * @param {string[]} config.airspaceClasses - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
     * @param {number} config.unlimited - Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
     * @param {string} config.defaultAltUnit - By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
     * @param {string} config.targetAltUnit - Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
     * @param {boolean} config.roundAltValues - If true, rounds the altitude values. Defaults to false.
     * @param {boolean} [config.extendedFormat] - If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
     * @param {string[]} [config.extendedFormatClasses] - Defines a set of allowed "AC" values if the extended format is used. Defaults to all ICAO classes.
     * @param {string[]} [config.extendedFormatTypes] - Defines a set of allowed "AY" values if the extended format is used.
     */
    constructor(config) {
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

        checkTypes.assert.array.of.nonEmptyString(airspaceClasses);
        checkTypes.assert.integer(unlimited);
        checkTypes.assert.string(defaultAltUnit);
        if (targetAltUnit) checkTypes.assert.string(targetAltUnit);
        checkTypes.assert.boolean(roundAltValues);
        checkTypes.assert.boolean(extendedFormat);
        checkTypes.assert.array.of.nonEmptyString(extendedFormatClasses);
        checkTypes.assert.array.of.nonEmptyString(extendedFormatTypes);

        this.config = config;
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
            new TpToken({ tokenTypes: TOKEN_TYPES, extendedFormat }),
        ];
        /** @type {typedefs.openaip.OpenairParser.Token[]} */
        this.tokens = [];
        // previous processed token, used to validate correct token order
        /** @type {typedefs.openaip.OpenairParser.Token} */
        this.prevToken = null;
        this.currentLineString = null;
        this.currentLineNumber = 0;
    }

    /**
     * Tokenizes the openAIR file at given path and returns the list of created tokens.
     *
     * @param filepath
     * @return {typedefs.openaip.OpenairParser.Token[]}
     */
    tokenize(filepath) {
        this.reset();

        const liner = new LineByLine(filepath);
        let line;

        while ((line = liner.next())) {
            this.currentLineNumber++;
            // call trim to also remove newlines
            this.currentLineString = line.toString().trim();

            // find the tokenizer that can handle the current line
            const lineTokenizer = this.tokenizers.find((value) => value.canHandle(this.currentLineString));
            if (lineTokenizer == null) {
                // fail hard if unable to find a tokenizer for a specific line
                throw new ParserError({
                    lineNumber: this.currentLineNumber,
                    errorMessage: `Failed to read line ${this.currentLineNumber}. Unknown syntax.`,
                });
            }

            let token;
            try {
                token = lineTokenizer.tokenize(this.currentLineString, this.currentLineNumber);
            } catch (e) {
                throw new ParserError({
                    lineNumber: this.currentLineNumber,
                    errorMessage: e.message,
                });
            }
            this.tokens.push(token);
        }
        // finalize by adding EOF token
        this.tokens.push(new EofToken({ tokenTypes: TOKEN_TYPES, lastLineNumber: this.currentLineNumber }));

        return this.tokens;
    }

    /**
     * Enforces that the file at given filepath exists.
     *
     * @param {string} filepath
     * @return {Promise<void>}
     * @private
     */
    async enforceFileExists(filepath) {
        const exists = await fs.existsSync(filepath);
        if (!exists) {
            throw new Error(`Failed to read file ${filepath}`);
        }
    }

    /**
     * Resets the state.
     *
     * @returns {void}
     */
    reset() {
        this.tokens = [];
        this.prevToken = null;
        this.currentLine = null;
        this.currentLineNumber = 0;
    }
}

module.exports = Tokenizer;
