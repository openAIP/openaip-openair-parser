const Tokenizer = require('./tokenizer');
const AcToken = require('./tokens/ac-token');
const EofToken = require('./tokens/eof-token');
const AirspaceFactory = require('./airspace-factory');
const altitudeUnit = require('./altitude-unit');
const defaultConfig = require('./default-parser-config');
const checkTypes = require('check-types');
const { featureCollection: createFeatureCollection } = require('@turf/turf');
const { geojsonToOpenair } = require('./geojson-to-openair');
const rewind = require('@mapbox/geojson-rewind');
const outputGeometries = require('./output-geometry');

const allowedAltUnits = Object.values(altitudeUnit);
const PARSER_STATE = {
    START: 'start',
    READ: 'read',
    // End of file
    EOF: 'eof',
};

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
     * @param {Object} [config] - if not specified, will use default parameters
     * @param {string[]} [config.airspaceClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
     * @param {number} [config.unlimited] - Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
     * @param {number} [config.geometryDetail] - Defines the steps that are used to calculate arcs and circles. Defaults to 50. Higher values mean smoother circles but a higher number of polygon points.
     * @param {boolean} [config.validateGeometry] - If true, the GeoJson features are validated. Parser will throw an error if an invalid geometry is found. Defaults to true.
     * @param {string} [config.outputGeometry] - Sets the output geometry. Can be either "POLYGON" or "LINESTRING". Defaults to "POLYGON". "LINESTRING" can be used to visualize invalid geometry definitions.
     * Note that "validateGeometry" and "fixGeometry" has NO effect on "LINESTRING" geometry output!
     * @param {boolean} [config.fixGeometry] - If true, the build GeoJson features fixed if possible. Note this can potentially alter the original geometry shape. Defaults to false.
     * @param {boolean} [config.includeOpenair] - If true, the GeoJSON output will contain the original openair airspace definition block for each airspace. Note that this will considerably increase JSON object size! Defaults to false.
     * @param {string} [config.defaultAltUnit] - By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
     * @param {string} [config.targetAltUnit] - Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. If not specified, keeps defined unit.
     * @param {boolean} [config.roundAltValues] - If true, rounds the altitude values. Defaults to false.
     * @param {boolean} [config.extendedFormat] - If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
     * @param {string[]} [config.extendedFormatClasses] - Defines a set of allowed "AC" values if the extended format is used. Defaults to all ICAO classes.
     * @param {string[]} [config.extendedFormatTypes] - Defines a set of allowed "AY" values if the extended format is used.
     */
    constructor(config) {
        const configuration = { ...defaultConfig, ...config };
        const {
            airspaceClasses,
            unlimited,
            geometryDetail,
            validateGeometry,
            outputGeometry,
            fixGeometry,
            includeOpenair,
            defaultAltUnit,
            targetAltUnit,
            roundAltValues,
            extendedFormat,
            extendedFormatClasses,
            extendedFormatTypes,
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
        if ([outputGeometries.POLYGON, outputGeometries.LINESTRING].includes(outputGeometry) === false) {
            throw new Error(
                `Parameter 'outputGeometry' must be one of the allowed output geometries '${Object.values(
                    outputGeometries
                ).join(', ')}.`
            );
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
        if (targetAltUnit && allowedAltUnits.includes(targetAltUnit.toUpperCase()) === false) {
            throw new Error(`Unknown target altitude unit '${targetAltUnit}'`);
        }
        if (checkTypes.boolean(roundAltValues) === false) {
            throw new Error("Parameter 'roundAltValues' must be a boolean.");
        }
        if (checkTypes.boolean(extendedFormat) === false) {
            throw new Error("Parameter 'extendedFormat' must be a boolean.");
        }
        if (checkTypes.array.of.nonEmptyString(extendedFormatClasses) === false) {
            throw new Error("Parameter 'extendedFormatClasses' must be an array of strings.");
        }
        if (checkTypes.array.of.nonEmptyString(extendedFormatTypes) === false) {
            throw new Error("Parameter 'extendedFormatTypes' must be an array of strings.");
        }

        this.config = configuration;
        // custom formatters
        this.formatter = [];
        /** @type {Airspace[]} */
        this.airspaces = [];
        // default state of parser
        this.currentState = PARSER_STATE.START;
        // holds the current token when iterating over token list and building airspaces
        this.currentToken = null;
        // Holds all processed tokens for a single airspace definition block when building airspaces. Will be reset
        // when one airspace is built.
        this.airspaceTokens = [];
        // internally, airspaces are stored as geojson
        this.geojson = null;
    }

    /**
     * Tries to parse the file content.
     *
     * @param filepath
     * @return {Promise<Parser>}
     */
    async parse(filepath) {
        this.reset();

        /*
        Tokenizes the file contents into a list of tokens and a list of syntax
        errors encountered during tokenization. Each token represents a single line and holds a
        "prepared value" of each line, e.g. "DP 52:24:33 N 013:11:02 E" will be converted into
        a prepared value, i.e. object, that contains valid coordinate decimals.

        IMPORTANT If syntax errors occur, the parser will return the result of the tokenizer only.
         */
        const tokenizer = new Tokenizer({
            airspaceClasses: this.config.airspaceClasses,
            unlimited: this.config.unlimited,
            defaultAltUnit: this.config.defaultAltUnit,
            targetAltUnit: this.config.targetAltUnit,
            roundAltValues: this.config.roundAltValues,
            extendedFormat: this.config.extendedFormat,
            extendedFormatClasses: this.config.extendedFormatClasses,
            extendedFormatTypes: this.config.extendedFormatTypes,
        });
        const tokens = await tokenizer.tokenize(filepath);

        // iterate over tokens and create airspaces
        for (let i = 0; i < tokens.length; i++) {
            this.currentToken = tokens[i];

            // do not change state if reading a comment or skipped token regardless of current state
            if (this.currentToken.isIgnoredToken()) continue;

            // AC tokens mark either start or end of airspace definition block
            if (this.currentToken instanceof AcToken) {
                if (this.currentState === PARSER_STATE.READ) {
                    // each new AC line will trigger an airspace build if parser is in READ state
                    // this is needed for files that do not have blanks between definition blocks but comments
                    this.buildAirspace();
                }
            }

            // handle EOF
            if (this.currentToken instanceof EofToken) {
                // if EOF is reached and parser is in READ state, check if we have any unprocessed airspace tokens
                // and if so, build the airspace
                if (this.currentState === PARSER_STATE.READ && this.airspaceTokens.length > 0) {
                    this.buildAirspace();
                    continue;
                }
            }

            this.currentState = PARSER_STATE.READ;
            // in all other cases, push token to airspace tokens list and continue
            this.airspaceTokens.push(this.currentToken);
        }

        // create airspaces as a GeoJSON feature collection and store them internally
        const geojsonFeatures = this.airspaces.map((value) => {
            return value.asGeoJson({
                validateGeometry: this.config.validateGeometry,
                fixGeometry: this.config.fixGeometry,
                includeOpenair: this.config.includeOpenair,
                outputGeometry: this.config.outputGeometry,
            });
        });

        // IMPORTANT make sure that GeoJSON polygons follow the right-hand rule
        this.geojson = rewind(createFeatureCollection(geojsonFeatures), false);

        return this;
    }

    buildAirspace() {
        const factory = new AirspaceFactory({
            geometryDetail: this.config.geometryDetail,
            extendedFormat: this.config.extendedFormat,
        });
        const airspace = factory.createAirspace(this.airspaceTokens);
        if (airspace != null) {
            // push new airspace to list
            this.airspaces.push(airspace);
        }
        // reset read airspace tokens
        this.airspaceTokens = [];
    }

    /**
     * @param {string} format
     *
     * @return {string}
     */
    toFormat(format) {
        switch (format) {
            case 'geojson':
                return JSON.stringify(this.geojson);
            case 'openair':
                return this.toOpenair().join('\n');
            default:
                throw new Error(`Unknown format '${format}'`);
        }
    }

    /**
     * @return {typedefs.openaip.OpenairParser.ParserResult}
     */
    toGeojson() {
        return this.geojson;
    }

    /**
     * @return {string[]}
     */
    toOpenair() {
        return geojsonToOpenair(this.geojson, { extendedFormat: this.config.extendedFormat });
    }

    /**
     * Resets the state.
     */
    reset() {
        this.currentState = PARSER_STATE.START;
        this.airspaces = [];
        this.currentToken = null;
        this.airspaceTokens = [];
        this.geojson = null;
    }
}

module.exports = Parser;
