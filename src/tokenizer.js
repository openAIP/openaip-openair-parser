const CommentToken = require('./tokens/comment-token');
const BlankToken = require('./tokens/blank-token');
const AcToken = require('./tokens/ac-token');
const AnToken = require('./tokens/an-token');
const AhToken = require('./tokens/ah-token');
const AlToken = require('./tokens/al-token');
const DpToken = require('./tokens/dp-token');
const VToken = require('./tokens/v-token');
const DcToken = require('./tokens/dc-token');
const DbToken = require('./tokens/db-token');
const EofToken = require('./tokens/eof-token');
const LineByLine = require('n-readlines');
const fs = require('fs');
const checkTypes = require('check-types');

/**
 * @typedef typedefs.openaipOpenairParser.TokenizerConfig
 * @type Object
 * @property {string[]} [airspaceClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 * @property {number} [unlimited] - Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;

 */

/**
 * Reads the contents of a give file and tokenizes it. Each line will result in a single token.
 * Each token holds a tokenized representation of the read line.
 * The tokenizer will return a list of all read and created tokens and a list of occurred errors if any.
 */
class Tokenizer {
    /**
     * @param {typedefs.openaipOpenairParser.TokenizerConfig} config
     */
    constructor(config) {
        const { airspaceClasses, unlimited } = config;
        checkTypes.assert.array.of.nonEmptyString(airspaceClasses);
        checkTypes.assert.integer(unlimited);

        this._config = config;
        /** @type {typedefs.openaipOpenairParser.Token[]} */
        this._tokenizers = [
            new CommentToken(),
            new BlankToken(),
            new AcToken({ airspaceClasses }),
            new AnToken(),
            new AhToken({ unlimited }),
            new AlToken({ unlimited }),
            new DpToken(),
            new VToken(),
            new DcToken(),
            new DbToken(),
        ];
        /** @type {typedefs.openaipOpenairParser.Token[]} */
        this._tokens = [];
        this._currentLine = 0;
        this._errors = [];
    }

    /**
     * Tokenizes the openAIR file at given path and returns the list of created tokens.
     *
     * @param filepath
     * @return {typedefs.openaipOpenairParser.Token[]}
     */
    tokenize(filepath) {
        this._reset();

        const liner = new LineByLine(filepath);
        let line;

        while ((line = liner.next())) {
            this._currentLine++;
            const linestring = line.toString();

            // find the tokenizer that can handle the current line
            const lineToken = this._tokenizers.find((value) => value.canHandle(linestring));
            if (lineToken == null) {
                // fail hard if unable to find a tokenizer for a specific line
                throw new SyntaxError(`Failed to read line ${this._currentLine}. Unknown syntax.`);
            }

            try {
                const token = lineToken.tokenize(linestring, this._currentLine);
                this._tokens.push(token);
            } catch (e) {
                this._error(line, this._currentLine, e.message);
            }
        }
        // finalize by adding EOF token
        this._tokens.push(new EofToken(this._currentLine));

        return this._tokens;
    }

    /**
     * @return {boolean}
     */
    hasErrors() {
        return this._errors.length > 0;
    }

    /**
     * @return {{line: string, lineNumber: number, errorMessage: string}[]}
     */
    getErrors() {
        return this._errors;
    }

    /**
     * Adds an error object.
     *
     * @param {string} line
     * @param {number} lineNumber
     * @param {string} errorMessage
     * @returns {void}
     * @private
     */
    _error(line, lineNumber, errorMessage) {
        this._errors.push({
            line,
            lineNumber,
            errorMessage,
        });
    }

    /**
     * Enforces that the file at given filepath exists.
     *
     * @param {string} filepath
     * @return {Promise<void>}
     * @private
     */
    async _enforceFileExists(filepath) {
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
    _reset() {
        this._tokens = [];
        this._currentLine = 0;
        this._errors = [];
    }
}

module.exports = Tokenizer;
