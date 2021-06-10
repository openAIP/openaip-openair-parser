const Tokenizer = require('./tokenizer');
const BlankToken = require('./tokens/blank-token');
const CommentToken = require('./tokens/comment-token');
const AcToken = require('./tokens/ac-token');
const EofToken = require('./tokens/eof-token');
const Airspace = require('./airspace');

const PARSER_STATE = {
    // parser is traversing down in the list of tokens (from beginning) until EOF is reached or AC token is found
    TRANSITION: 'transition',
    // parser is at start of a new airspace definition block
    START: 'start',
    // parser is current "building" an airspace from an airspace definition block
    BUILD: 'build',
    // parser is at end of a build airspace definition block
    END: 'end',
};

/**
 * @typedef typedefs.openaipOpenairParser.ParserConfig
 * @param {string} [encoding] - Sets the encoding to use. Defaults to 'utf-8'.
 * @param {string[]} [restrictAcClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 * @param {number} [unlimited] - Defines the flight level to set if an airspace ceiling is defined with "unlimited". Defaults to 999;
 */

/**
 * @typedef typedefs.openaipOpenairParser.ParserResult
 * @param {boolean} success - If true, parsing was successful, false if not.
 * @param {Array} errors - A list of errors. Empty if parsing was successful.
 */

/**
 * Reads content of an openAIR formatted file and returns a normalized representation. For convenience,
 * JSON and GeoJSON formatters are included.
 */
class Parser {
    /**
     * @param {typedefs.openaipOpenairParser.ParserConfig} [config] - The parser configuration
     */
    constructor(config) {
        this._config = config || { encoding: 'utf-8' };
        // default state of parser
        this._state = PARSER_STATE.TRANSITION;
        /** @type {typedefs.openaipOpenairParser.Airspace[]} */
        this._airspaces = [];
        /** @type {typedefs.openaipOpenairParser.Airspace} */
        this._buildAirspace = null;
    }

    /**
     * Tries to parse the file content.
     *
     * @param filepath
     * @return {Promise<typedefs.openaipOpenairParser.ParserResult>}
     */
    async parse(filepath) {
        this._reset();

        /*
        Tokenize the file contents and will result in a list of tokens and a list of syntax
        errors encountered during tokenization. Each token represents a single line and hold a
        "prepared value" if each line, e.g. "DP 52:24:33 N 013:11:02 E" will be converted into
        a object that contains valid coordinate decimals.

        IMPORTANT If syntax errors occur, the parser will return the result of the tokenizer only.
         */
        const tokenizer = new Tokenizer(this._config);
        const tokens = await tokenizer.tokenize(filepath);
        // abort if tokenizer has syntax errors at this point
        if (tokenizer.hasErrors()) {
            const errors = tokenizer.getErrors();

            return {
                success: errors.length === 0,
                errors: errors,
            };
        }

        /*
        Iterate of tokens and create airspaces.
         */
        for (let i = 0; i <= tokens.length; i++) {
            const token = tokens[i];

            const nextState = this._nextState(token);

            // START state will start new airport instance
            if (nextState === PARSER_STATE.START) {
                if (this._buildAirspace != null) {
                    throw new Error('Parsing failed. Inconsistent airspace build state.');
                }
                // set parser state into build state
                this._state = PARSER_STATE.BUILD;
                // create new airspace instance
                this._buildAirspace = new Airspace();
                this._buildAirspace.consumeToken(token);

                continue;
            }

            // END state will finalize airport instance
            if (nextState === PARSER_STATE.END) {
                if (this._buildAirspace == null) {
                    throw new Error('Parsing failed. Inconsistent airspace build state.');
                }
                // set parser state into transition state again
                this._state = PARSER_STATE.TRANSITION;
                // finalize airspace with last token
                this._buildAirspace.consumeToken(token);
                // push built airspace into list
                this._airspaces.push(this._buildAirspace);
                // clear built airspace
                this._buildAirspace = null;

                continue;
            }

            this._state = nextState;
        }

        return {
            success: true,
            errors: [],
        };
    }

    /**
     * @param {typedefs.openaipOpenairParser.BaseAltitudeToken} token
     * @return {string}
     * @private
     */
    _nextState(token) {
        // state does not change when reading a comment line
        if (token instanceof CommentToken) return this._state;

        // parser is in transition and reached blank line => will not change current state
        if (this._state === PARSER_STATE.TRANSITION && token instanceof BlankToken) {
            return PARSER_STATE.TRANSITION;
        }

        // parser is in build state and EOF is reached
        if (this._state === PARSER_STATE.BUILD && token instanceof EofToken) {
            return PARSER_STATE.END;
        }

        // parser is in transition and reached beginning of new airspace definition block
        if (this._state === PARSER_STATE.TRANSITION && token instanceof AcToken) {
            return PARSER_STATE.START;
        }

        // parser is in build state, i.e. reading an airspace definition block
        if (this._state === PARSER_STATE.BUILD && !(token instanceof BlankToken)) {
            return PARSER_STATE.BUILD;
        }

        // parser is in build state and next token is a blank token which marks the end of an airspace definition block
        if (this._state === PARSER_STATE.BUILD && token instanceof BlankToken) {
            return PARSER_STATE.END;
        }

        throw new Error('Next parser state is unknown');
    }

    /**
     * Resets the state.
     */
    _reset() {
        this._state = PARSER_STATE.TRANSITION;
        this._airspaces = [];
        this._buildAirspace = null;
    }
}

module.exports = Parser;
