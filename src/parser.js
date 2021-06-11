const Tokenizer = require('./tokenizer');
const BlankToken = require('./tokens/blank-token');
const CommentToken = require('./tokens/comment-token');
const AcToken = require('./tokens/ac-token');
const EofToken = require('./tokens/eof-token');
const Airspace = require('./airspace');
const defaultConfig = require('./default-parser-config');
const checkTypes = require('check-types');
const { featureCollection: createFeatureCollection } = require('@turf/turf');

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

        /*
        Iterate of tokens and create airspaces.
         */
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            const nextState = this._nextState(token);

            // START state will start new airport instance
            if (nextState === PARSER_STATE.START) {
                if (this._buildAirspace != null) {
                    throw new Error('Parsing failed. Inconsistent airspace build state.');
                }

                // create new airspace instance
                this._buildAirspace = new Airspace({
                    geometryDetail: this._config.geometryDetail,
                    keepOriginal: this._config.keepOriginal,
                });
                this._buildAirspace.consumeToken(token);

                // set parser state into build state
                this._state = PARSER_STATE.BUILD;
                continue;
            }

            // END state will finalize airport instance
            if (nextState === PARSER_STATE.END) {
                if (this._buildAirspace == null) {
                    throw new Error('Parsing failed. Inconsistent airspace build state.');
                }

                // finalize airspace with last token
                this._buildAirspace.consumeToken(token);
                // finalize the airspace => creates a GeoJSON feature
                this._airspaces.push(this._buildAirspace.finalize().asGeoJson());
                // clear built airspace
                this._buildAirspace = null;

                // set parser state into transition state again
                this._state = PARSER_STATE.TRANSITION;
                continue;
            }

            // BUILD state
            if (this._state === PARSER_STATE.BUILD) {
                this._buildAirspace.consumeToken(token);
            }

            this._state = nextState;
        }

        return {
            success: true,
            geojson: createFeatureCollection(this._airspaces),
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
