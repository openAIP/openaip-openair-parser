const CommentToken = require('./tokens/comment-token');
const SkippedToken = require('./tokens/skipped-token');
const BlankToken = require('./tokens/blank-token');
const AcToken = require('./tokens/ac-token');
const AnToken = require('./tokens/an-token');
const AhToken = require('./tokens/ah-token');
const AlToken = require('./tokens/al-token');
const DpToken = require('./tokens/dp-token');
const VdToken = require('./tokens/vd-token');
const VxToken = require('./tokens/vx-token');
const DcToken = require('./tokens/dc-token');
const DbToken = require('./tokens/db-token');
const DaToken = require('./tokens/da-token');
const EofToken = require('./tokens/eof-token');
const LineByLine = require('n-readlines');
const fs = require('fs');
const checkTypes = require('check-types');
const ParserError = require('./parser-error');

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
    DC_TOKEN: DcToken.type,
    DB_TOKEN: DbToken.type,
    DA_TOKEN: DaToken.type,
    EOF_TOKEN: EofToken.type,
    SKIPPED_TOKEN: SkippedToken.type,
};

/**
 * @typedef typedefs.openaip.OpenairParser.TokenizerConfig
 * @type Object
 * @property {string[]} airspaceClasses - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 * @property {number} unlimited - Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
 * @property {string} defaultAltUnit - By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
 * @property {string} targetAltUnit - Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
 * @property {boolean} roundAltValues - If true, rounds the altitude values. Defaults to false.
 */

/**
 * Reads the contents of a give file and tokenizes it. Each line will result in a single token.
 * Each token holds a tokenized representation of the read line. The tokenizer will return a list of all read
 * and created tokens. The tokenizer will throw a syntax error on the first error that is encountered.
 */
class Tokenizer {
    /**
     * @param {typedefs.openaip.OpenairParser.TokenizerConfig} config
     */
    constructor(config) {
        const { airspaceClasses, unlimited, defaultAltUnit, targetAltUnit, roundAltValues } = config;

        checkTypes.assert.array.of.nonEmptyString(airspaceClasses);
        checkTypes.assert.integer(unlimited);
        checkTypes.assert.string(defaultAltUnit);
        checkTypes.assert.string(targetAltUnit);
        checkTypes.assert.boolean(roundAltValues);

        this.config = config;
        /** @type {BaseLineToken[]} */
        this.tokenizers = [
            new CommentToken({ tokenTypes: TOKEN_TYPES }),
            new SkippedToken({ tokenTypes: TOKEN_TYPES }),
            new BlankToken({ tokenTypes: TOKEN_TYPES }),
            new AcToken({ tokenTypes: TOKEN_TYPES, airspaceClasses }),
            new AnToken({ tokenTypes: TOKEN_TYPES }),
            new AhToken({ tokenTypes: TOKEN_TYPES, unlimited, defaultAltUnit, targetAltUnit, roundAltValues }),
            new AlToken({ tokenTypes: TOKEN_TYPES, unlimited, defaultAltUnit, targetAltUnit, roundAltValues }),
            new DpToken({ tokenTypes: TOKEN_TYPES }),
            new VdToken({ tokenTypes: TOKEN_TYPES }),
            new VxToken({ tokenTypes: TOKEN_TYPES }),
            new DcToken({ tokenTypes: TOKEN_TYPES }),
            new DbToken({ tokenTypes: TOKEN_TYPES }),
            new DaToken({ tokenTypes: TOKEN_TYPES }),
        ];
        /** @type {typedefs.openaip.OpenairParser.Token[]} */
        this.tokens = [];
        // previous processed token, used to validate correct token order
        /** @type {BaseLineToken} */
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

            // validate correct token order
            if (this.prevToken && this.prevToken.isAllowedNextToken(lineTokenizer) === false) {
                const { lineNumber: prevTokenLineNumber } = this.prevToken.getTokenized();
                const { lineNumber: currentTokenLineNumber } = token.getTokenized();

                throw new ParserError({
                    lineNumber: this.currentLineNumber,
                    errorMessage: `Previous token '${this.prevToken.getType()}' on line ${prevTokenLineNumber} does not allow subsequent token '${token.getType()}' on line ${currentTokenLineNumber}`,
                });
            }

            this.tokens.push(token);
            // IMPORTANT only keep relevant (no comments...) as "previous token" to check token order
            if (token.getType() !== 'COMMENT' && token.getType() !== 'SKIPPED') {
                this.prevToken = token;
            }
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
