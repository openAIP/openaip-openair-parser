const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * @typedef typedefs.openaipOpenairParser.BaseAltitudeTokenConfig
 * @type Object
 * @property {typedefs.openaipOpenairParser.TokenTypes} tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.
 * @property {number} [unlimited] -  Defines the flight level to set if an airspace ceiling is defined with "unlimited". Defaults to 999;
 */

/**
 * @typedef typedefs.openaipOpenairParser.AltitudeReader
 * @type Object
 * @function canHandle
 * @function read
 */

/**
 * Reads a default airspace ceiling definition, e.g. "2700ft MSL".
 *
 * @type {typedefs.openaipOpenairParser.AltitudeReader}
 */
class AltitudeDefaultReader {
    constructor() {
        this.REGEX_ALTITUDE = /^(\d+)\s*(FT|M)?\s+(MSL|AMSL|GND|GROUND|AGL|SURFACE|SFC|SRFC)?$/;
    }

    /**
     * @param {string} altitudeString
     * @returns {boolean}
     */
    canHandle(altitudeString) {
        return this.REGEX_ALTITUDE.test(altitudeString);
    }

    /**
     * @param {string} altitudeString
     * @returns {{value: number, unit: string, referenceDatum: string}}
     * @private
     */
    read(altitudeString) {
        // check for "default" altitude definition, e.g. 16500ft MSL or similar
        const altitudeParts = this.REGEX_ALTITUDE.exec(altitudeString);
        // get altitude parts
        let value = parseInt(altitudeParts[1]);
        let unit = altitudeParts[2];
        const referenceDatum = this._harmonizeReference(altitudeParts[3]);

        /*
        Although "ft" is mostly used as main unit in openAIR airspace definitions, sometimes "meters" (m) are used instead.
        In this case, the tokenizer will convert meters into feet BUT this comes at a downside. Unfortunately,
        the source used to generate the openAIR file will often define meter values that are "prettified" and when
        converted to feet, they will almost NEVER match the common rounded values like "2500" but rather something like "2478.123".
         */
        if (unit === 'M') {
            value = this._metersToFeet(value);
            unit = 'FT';
        }

        return { value, unit, referenceDatum };
    }
    /**
     * @param {number} meters
     * @return {number}
     * @private
     */
    _metersToFeet(meters) {
        checkTypes.assert.integer(meters);

        return Math.round(meters * 3.28084);
    }
    /**
     * @param {string} reference
     * @return {string}
     * @private
     */
    _harmonizeReference(reference) {
        checkTypes.assert.string(reference);

        switch (reference) {
            case 'MSL':
            case 'AMSL':
                return 'MSL';
            case 'GND':
            case 'GROUND':
            case 'AGL':
            case 'SURFACE':
            case 'SFC':
            case 'SRFC':
                return 'GND';
            default:
                throw new SyntaxError(`Unknown reference datum ${reference}`);
        }
    }
}

/**
 * Reads a flight level airspace ceiling definition, e.g. FL80.
 *
 * @type {typedefs.openaipOpenairParser.AltitudeReader}
 */
class AltitudeFlightLevelReader {
    constructor() {
        this.REGEX_ALTITUDE = /^FL\s*(\d{2,})?$/;
    }

    /**
     * @param {string} altitudeString
     * @returns {boolean}
     */
    canHandle(altitudeString) {
        return this.REGEX_ALTITUDE.test(altitudeString);
    }

    /**
     * @param {string} altitudeString
     * @returns {{value: number, unit: string, referenceDatum: string}}
     * @private
     */
    read(altitudeString) {
        // check flight level altitude definition
        const altitudeParts = this.REGEX_ALTITUDE.exec(altitudeString);
        // get altitude parts
        let value = parseInt(altitudeParts[1]);
        const unit = 'FL';
        const referenceDatum = 'STD';

        return { value, unit, referenceDatum };
    }
}

/**
 * Reads a surface airspace ceiling definition, e.g. GND.
 *
 * @type {typedefs.openaipOpenairParser.AltitudeReader}
 */
class AltitudeSurfaceReader {
    constructor() {
        this.REGEX_ALTITUDE = /^(MSL|GND|GROUND|AGL|SURFACE|SFC|SRFC)$/;
    }

    /**
     * @param {string} altitudeString
     * @returns {boolean}
     */
    canHandle(altitudeString) {
        return this.REGEX_ALTITUDE.test(altitudeString);
    }

    /**
     * @param {string} altitudeString
     * @returns {{value: number, unit: string, referenceDatum: string}}
     * @private
     */
    read(altitudeString) {
        const altitudeParts = this.REGEX_ALTITUDE.exec(altitudeString);
        let referenceDatum = altitudeParts[0];

        if (referenceDatum !== 'MSL') {
            // always use GND
            referenceDatum = 'GND';
        }

        return { value: 0, unit: 'FT', referenceDatum };
    }
}

/**
 * Reads unlimited ceiling airspace definitions.
 *
 * @type {typedefs.openaipOpenairParser.AltitudeReader}
 */
class AltitudeUnlimitedReader {
    /**
     * @param {{unlimited: number}} config - Defines the flight level to set if an airspace ceiling is defined with "unlimited". Defaults to 999;
     */
    constructor({ unlimited }) {
        checkTypes.assert.integer(unlimited);

        this._unlimited = unlimited;
        // unlimited ceiling definition
        this.REGEX_ALTITUDE = /^(UNLIMITED|UNL)$/;
    }

    /**
     * @param {string} altitudeString
     * @returns {boolean}
     */
    canHandle(altitudeString) {
        return this.REGEX_ALTITUDE.test(altitudeString);
    }

    /**
     * @param {string} altitudeString
     * @returns {{value: number, unit: string, referenceDatum: string}}
     * @private
     */
    read(altitudeString) {
        return { value: this._unlimited, unit: 'FL', referenceDatum: 'STD' };
    }
}

/**
 * Tokenizes "AH/AL" airspace ceiling definitions.
 *
 * @type {typedefs.openaipOpenairParser.AltitudeReader}
 */
class BaseAltitudeToken extends BaseLineToken {
    /**
     * @param {typedefs.openaipOpenairParser.BaseAltitudeTokenConfig} config
     */
    constructor(config) {
        const { unlimited, tokenTypes } = config;

        super({ tokenTypes });

        this._unlimited = unlimited;

        /** @type {typedefs.openaipOpenairParser.AltitudeReader[]} */
        this._readers = [
            new AltitudeDefaultReader(),
            new AltitudeFlightLevelReader(),
            new AltitudeSurfaceReader(),
            new AltitudeUnlimitedReader({ unlimited }),
        ];
    }

    /**
     * Turns an altitude string into an altitude object literal.
     *
     * @param {string} altitudeString
     * @return {{value: number, unit: string, referenceDatum: string}}
     * @private
     */
    _getAltitude(altitudeString) {
        checkTypes.assert.string(altitudeString);

        // trim and convert to upper case
        altitudeString = altitudeString.trim().toUpperCase();

        for (const reader of this._readers) {
            if (reader.canHandle(altitudeString)) {
                return reader.read(altitudeString);
            }
        }

        throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
    }
}

module.exports = BaseAltitudeToken;
