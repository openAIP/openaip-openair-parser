const Tokenizer = require('./tokenizer');
const BlankToken = require('./tokens/blank-token');
const CommentToken = require('./tokens/comment-token');
const SkippedToken = require('./tokens/skipped-token');
const AcToken = require('./tokens/ac-token');
const EofToken = require('./tokens/eof-token');
const AirspaceFactory = require('./airspace-factory');
const altitudeUnit = require('./altitude-unit');
const defaultConfig = require('./default-parser-config');
const checkTypes = require('check-types');
const { featureCollection: createFeatureCollection } = require('@turf/turf');

const allowedAltUnits = Object.values(altitudeUnit);
const PARSER_STATE = {
    START: 'start',
    READ: 'read',
    // End of file
    EOF: 'eof',
};

/**
 * @typedef typedefs.openaip.OpenairParser.ParserConfig
 * @type Object
 * @property {string[]} [airspaceClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 * @property {number} [unlimited] - Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
 * @property {number} [geometryDetail] - Defines the steps that are used to calculate arcs and circles. Defaults to 50. Higher values mean smoother circles but a higher number of polygon points.
 * @property {boolean} [validateGeometry] - If true, the GeoJson features are validate. Parser will throw an error if an invalid geometry is found. Defaults to true.
 * @property {boolean} [fixGeometry] - If true, the build GeoJson features fixed if possible. Note this can potentially alter the original geometry shape. Defaults to false.
 * @property {boolean} [includeOpenair] - If true, the GeoJSON output will contain the original openair airspace definition block for each airspace. Note that this will considerably increase JSON object size! Defaults to false.
 * @property {string} [defaultAltUnit] - By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
 * @property {string} [targetAltUnit] - Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
 * @property {boolean} [roundAltValues] - If true, rounds the altitude values. Defaults to false.
 */

/**
 * @typedef typedefs.openaip.OpenairParser.ParserResult
 * @type Object
 * @property {boolean} success - If true, parsing was successful, false if not.
 * @property {FeatureCollection} - [geojson] - On success, contains a GeoJson FeatureCollection representation of the parsed openAIR file.
 * @property {Array} [errors] - A list of errors if parsing was NOT successful.
 */

/**
 * Reads content of an openAIR formatted file and returns a GeoJSON representation.
 * Parser implements the openAIR specification according to http://www.winpilot.com/usersguide/userairspace.asp
 * except the following tokens: AT,TO,TC,SP,SB,DY.
 */
class Parser {
    /**
     * @param {typedefs.openaip.OpenairParser.ParserConfig} [config] - The parser configuration
     */
    constructor(config) {
        const configuration = Object.assign(defaultConfig, config);
        const {
            airspaceClasses,
            unlimited,
            geometryDetail,
            validateGeometry,
            fixGeometry,
            includeOpenair,
            defaultAltUnit,
            targetAltUnit,
            roundAltValues,
        } = configuration;

        if (checkTypes.array.of.nonEmptyString(airspaceClasses) === false) {
            throw new Error("Parameter 'airspaceClasses' must be an array of strings.");
        }
        if (checkTypes.integer(unlimited) === false) {
            throw new Error("Parameter 'unlimited' must be an integer.");
        }
        if (checkTypes.integer(geometryDetail) === false) {
            throw new Error("Parameter 'geometryDetail' must be an integer.");
        }
        if (checkTypes.boolean(validateGeometry) === false) {
            throw new Error("Parameter 'validateGeometry' must be a boolean.");
        }
        if (checkTypes.boolean(fixGeometry) === false) {
            throw new Error("Parameter 'fixGeometry' must be a boolean.");
        }
        if (checkTypes.boolean(includeOpenair) === false) {
            throw new Error("Parameter 'includeOpenair' must be a boolean.");
        }
        if (allowedAltUnits.includes(defaultAltUnit.toUpperCase()) === false) {
            throw new Error(`Unknown default altitude unit '${defaultAltUnit}'`);
        }
        if (allowedAltUnits.includes(targetAltUnit.toUpperCase()) === false) {
            throw new Error(`Unknown target altitude unit '${targetAltUnit}'`);
        }
        if (checkTypes.boolean(roundAltValues) === false) {
            throw new Error("Parameter 'roundAltValues' must be a boolean.");
        }

        this._config = configuration;
        // custom formatters
        this.formatter = [];
        /** @type {Airspace[]} */
        this._airspaces = [];
        // default state of parser
        this._currentState = PARSER_STATE.START;
        // holds the current token when iterating over token list and building airspaces
        this._currentToken = null;
        // Holds all processed tokens for a single airspace definition block when building airspaces. Will be reset
        // when one airspace is built.
        this._airspaceTokens = [];
        // internally, airspaces are stored as geojson
        this._geojson = null;
    }

    /**
     * Tries to parse the file content.
     *
     * @param filepath
     * @return {Promise<Parser>}
     */
    async parse(filepath) {
        this._reset();

        /*
        Tokenizes the file contents into a list of tokens and a list of syntax
        errors encountered during tokenization. Each token represents a single line and holds a
        "prepared value" of each line, e.g. "DP 52:24:33 N 013:11:02 E" will be converted into
        a prepared value, i.e. object, that contains valid coordinate decimals.

        IMPORTANT If syntax errors occur, the parser will return the result of the tokenizer only.
         */
        const tokenizer = new Tokenizer({
            airspaceClasses: this._config.airspaceClasses,
            unlimited: this._config.unlimited,
            defaultAltUnit: this._config.defaultAltUnit,
            targetAltUnit: this._config.targetAltUnit,
            roundAltValues: this._config.roundAltValues,
        });
        const tokens = await tokenizer.tokenize(filepath);

        // iterate over tokens and create airspaces
        for (let i = 0; i < tokens.length; i++) {
            this._currentToken = tokens[i];

            // do not change state if reading a comment or skipped token regardless of current state
            if (
                this._currentToken instanceof CommentToken ||
                this._currentToken instanceof SkippedToken ||
                this._currentToken instanceof BlankToken
            ) {
                continue;
            }

            // AC tokens mark either start or end of airspace definition block
            if (this._currentToken instanceof AcToken) {
                if (this._currentState === PARSER_STATE.READ) {
                    // each new AC line will trigger an airspace build if parser is in READ state
                    // this is needed for files that do not have blanks between definition blocks but comments
                    this._buildAirspace();
                }
            }

            // handle EOF
            if (this._currentToken instanceof EofToken) {
                // if EOF is reached and parser is in READ state, check if we have any unprocessed airspace tokens
                // and if so, build the airspace
                if (this._currentState === PARSER_STATE.READ && this._airspaceTokens.length > 0) {
                    this._buildAirspace();
                    continue;
                }
            }

            this._currentState = PARSER_STATE.READ;
            // in all other cases, push token to airspace tokens list and continue
            this._airspaceTokens.push(this._currentToken);
        }

        // create airspaces as a GeoJSON feature collection and store them internally
        const geojsonFeatures = this._airspaces.map((value) => {
            return value.asGeoJson({
                validateGeometry: this._config.validateGeometry,
                fixGeometry: this._config.fixGeometry,
                includeOpenair: this._config.includeOpenair,
            });
        });
        this._geojson = createFeatureCollection(geojsonFeatures);

        return this;
    }

    _buildAirspace() {
        const factory = new AirspaceFactory({
            geometryDetail: this._config.geometryDetail,
        });
        const airspace = factory.createAirspace(this._airspaceTokens);
        // push new airspace to list
        this._airspaces.push(airspace);
        // reset read airspace tokens
        this._airspaceTokens = [];
    }

    /**
     * @param {string} format
     */
    toFormat(format) {
        switch (format) {
            case 'geojson':
                return this._geojson;
            default:
                throw new Error(`Unknown format '${format}'`);
        }
    }

    /**
     * @return {typedefs.openaip.OpenairParser.ParserResult}
     */
    toGeojson() {
        return this._geojson;
    }

    /**
     * Resets the state.
     */
    _reset() {
        this._currentState = PARSER_STATE.START;
        this._airspaces = [];
        this._currentToken = null;
        this._airspaceTokens = [];
        this._geojson = null;
    }
}

module.exports = Parser;
