const Tokenizer = require('./tokenizer');
const BlankToken = require('./tokens/blank-token');
const CommentToken = require('./tokens/comment-token');
const AcToken = require('./tokens/ac-token');
const EofToken = require('./tokens/eof-token');
const AirspaceFactory = require('./airspace-factory');
const defaultConfig = require('./default-parser-config');
const checkTypes = require('check-types');
const { featureCollection: createFeatureCollection } = require('@turf/turf');
const ParserError = require('./parser-error');

const PARSER_STATE = {
    // parser is traversing down in the list of tokens (from beginning) until EOF is reached or AC token is found
    TRANSITION: 'transition',
    // parser is reading a complete airspace definition block
    READ: 'read',
    // parser has reached the end of an airspace definition block and can now build an airspace instance from read tokens
    BUILD: 'build',
    // End of file
    EOF: 'eof',
};

/**
 * @typedef typedefs.openaipOpenairParser.ParserConfig
 * @type Object
 * @property {string[]} [airspaceClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 * @property {number} [unlimited] - Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
 * @property {number} [geometryDetail] - Defines the steps that are used to calculate arcs and circles. Defaults to 50. Higher values mean smoother circles but a higher number of polygon points.
 * @property {boolean} [keepOriginal] - If true, the returned GeoJson features will contain the original openAIR airspace block definitions. Defaults to false.
 */

/**
 * @typedef typedefs.openaipOpenairParser.ParserResult
 * @type Object
 * @property {boolean} success - If true, parsing was successful, false if not.
 * @property {FeatureCollection} - [geojson] - On success, contains a GeoJson FeatureCollection representation of the parsed openAIR file.
 * @property {Array} [errors] - A list of errors if parsing was NOT successful.
 */

/**
 * Reads content of an openAIR formatted file and returns a GeoJSON representation.
 */
class Parser {
    /**
     * @param {typedefs.openaipOpenairParser.ParserConfig} [config] - The parser configuration
     */
    constructor(config) {
        const configuration = Object.assign(defaultConfig, config);
        const { airspaceClasses, unlimited, geometryDetail, keepOriginal } = configuration;
        checkTypes.assert.array.of.nonEmptyString(airspaceClasses);
        checkTypes.assert.integer(unlimited);
        checkTypes.assert.integer(geometryDetail);
        checkTypes.assert.boolean(keepOriginal);

        this._config = configuration;
        // default state of parser
        this._currentState = PARSER_STATE.TRANSITION;
        /** @type {Airspace[]} */
        this._airspaces = [];
        this._lastToken = null;
        this._currentToken = null;
        this._airspaceTokens = [];
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
        const tokenizer = new Tokenizer({
            airspaceClasses: this._config.airspaceClasses,
            unlimited: this._config.unlimited,
        });
        const tokens = await tokenizer.tokenize(filepath);
        // abort if tokenizer has syntax errors at this point
        if (tokenizer.hasErrors()) {
            const errors = tokenizer.getErrors();

            return {
                success: errors.length === 0,
                errors: errors,
            };
        }

        try {
            /*
        Iterate of tokens and create airspaces.
         */
            for (let i = 0; i < tokens.length; i++) {
                this._currentToken = tokens[i];
                this._currentState = this._nextState(this._currentToken);

                // enforce the tokens are in syntactically correct sequence
                if (this._lastToken != null && this._lastToken.isAllowedNextToken(this._currentToken) === false) {
                    const { lineNumber } = this._currentToken.getTokenized();

                    throw new SyntaxError(`Unexpected token ${this._currentToken.getType()} at line ${lineNumber}`);
                }

                // add new airspace tokens to airspace token list => in process if reading a single airspace definition block
                if (this._currentState === PARSER_STATE.READ) {
                    this._airspaceTokens.push(this._currentToken);

                    continue;
                }

                // reached end of airspace definition block either =>  start building airspace instance from read tokens
                if (
                    this._currentState === PARSER_STATE.BUILD ||
                    (this._currentState === PARSER_STATE.EOF && this._airspaceTokens.length > 0)
                ) {
                    // do not push current token to airspace tokens list => token is either blank or eof
                    // build airspace from read tokens
                    const factory = new AirspaceFactory({
                        geometryDetail: this._config.geometryDetail,
                        keepOriginal: this._config.keepOriginal,
                    });
                    const airspace = factory.createAirspace(this._airspaceTokens);
                    // push new airspace to list
                    this._airspaces.push(airspace);
                    // reset read airspace tokens
                    this._airspaceTokens = [];

                    // only change state to transition if if EOF is NOT reached yet
                    if (this._currentState === PARSER_STATE.BUILD) this._currentToken = PARSER_STATE.TRANSITION;

                    continue;
                }
            }
        } catch (e) {
            const { line, lineNumber } = this._currentToken.getTokenized();

            return {
                success: false,
                errors: [new ParserError({ line, lineNumber, errorMessage: e.message })],
            };
        }

        const geojsonFeatures = this._airspaces.map((value) => {
            return value.asGeoJson();
        });

        return {
            success: true,
            geojson: createFeatureCollection(geojsonFeatures),
        };
    }

    /**
     * @param {BaseAltitudeToken} token
     * @return {string}
     * @private
     */
    _nextState(token) {
        // do not change state if reading a comment regardless of current state
        if (token instanceof CommentToken) return this._currentState;

        // state is set to EOF if end of file is reached regardless of current state
        if (token instanceof EofToken) return PARSER_STATE.EOF;

        if (this._currentState === PARSER_STATE.TRANSITION) {
            // blank tokens are omitted when in transition
            if (token instanceof BlankToken) return this._currentState;

            // an AC token marks start of a new airspace definition block and sets the read state
            if (token instanceof AcToken) {
                return PARSER_STATE.READ;
            }

            throw new Error('Next parser state is unknown');
        }

        // handle state changes when reading airspace
        if (this._currentState === PARSER_STATE.READ) {
            // reached end of airspace definition block => start building an airspace from read tokens
            if (token instanceof BlankToken) {
                return PARSER_STATE.BUILD;
            }

            // all other tokens will not change the current read state
            return this._currentState;
        }

        throw new Error('Next parser state is unknown');
    }

    /**
     * Resets the state.
     */
    _reset() {
        this._currentState = PARSER_STATE.TRANSITION;
        this._airspaces = [];
        this._lastToken = null;
        this._currentToken = null;
        this._airspaceTokens = [];
    }
}

module.exports = Parser;
