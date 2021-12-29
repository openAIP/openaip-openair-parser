const BaseLineToken = require('./base-line-token');
const altitudeUnit = require('../altitude-unit');
const checkTypes = require('check-types');

/**
 * @typedef typedefs.openaip.OpenairParser.BaseAltitudeTokenConfig
 * @type Object
 * @property {typedefs.openaip.OpenairParser.Token} tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.
 * @property {number} unlimited - Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
 * @property {string} defaultAltUnit - By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
 * @property {string} targetAltUnit - Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
 * @property {boolean} roundAltValues - If true, rounds the altitude values. Defaults to false.
 */

/**
 * Tokenizes "AH/AL" airspace ceiling definitions.
 *
 * @type {typedefs.openaip.OpenairParser.AltitudeReader}
 */
class BaseAltitudeToken extends BaseLineToken {
    /**
     * @param {typedefs.openaip.OpenairParser.BaseAltitudeTokenConfig} config
     */
    constructor(config) {
        const { unlimited, tokenTypes, defaultAltUnit, targetAltUnit, roundAltValues } = config || {};

        checkTypes.assert.integer(unlimited);
        checkTypes.assert.string(defaultAltUnit);
        checkTypes.assert.string(targetAltUnit);
        checkTypes.assert.boolean(roundAltValues);

        super({ tokenTypes });

        this.unlimited = unlimited;
        this.defaultAltUnit = defaultAltUnit.toUpperCase();
        this.targetAltUnit = targetAltUnit.toUpperCase();
        this.roundAltValues = roundAltValues;

        /** @type {typedefs.openaip.OpenairParser.AltitudeReader[]} */
        this.readers = [
            new AltitudeDefaultReader({ unlimited, defaultAltUnit, targetAltUnit, roundAltValues }),
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
    getAltitude(altitudeString) {
        checkTypes.assert.string(altitudeString);

        // trim and convert to upper case
        altitudeString = altitudeString.trim().toUpperCase();

        for (const reader of this.readers) {
            if (reader.canHandle(altitudeString)) {
                return reader.read(altitudeString);
            }
        }

        throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
    }
}

/**
 * @typedef typedefs.openaip.OpenairParser.AltitudeReader
 * @type Object
 * @function canHandle
 * @function read
 */

/**
 * Reads a default airspace ceiling definition, e.g. "2700ft MSL".
 *
 * @type {typedefs.openaip.OpenairParser.AltitudeReader}
 */
class AltitudeDefaultReader {
    /**
     * @param {{defaultAltUnit: string, targetAltUnit: string, roundAltValues: boolean}} config
     */
    constructor(config) {
        const { defaultAltUnit, targetAltUnit, roundAltValues } = config || {};

        checkTypes.assert.string(defaultAltUnit);
        checkTypes.assert.string(targetAltUnit);
        checkTypes.assert.boolean(roundAltValues);

        this.defaultAltUnit = defaultAltUnit.toUpperCase();
        this.targetAltUnit = targetAltUnit.toUpperCase();
        this.roundAltValues = roundAltValues;
        this.REGEX_ALTITUDE = /^(\d+(\.\d+)?)\s*(FT|ft|M|m)?\s+(MSL|AMSL|ALT|GND|GROUND|AGL|SURFACE|SFC|SRFC)?$/;
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
        let value = parseFloat(altitudeParts[1]);
        // use the unit defined in altitude definition or if not set, use the configured default unit
        let unit = altitudeParts[3] ?? this.defaultAltUnit;
        const referenceDatum = this.harmonizeReference(altitudeParts[4]);

        /*
        Convert between altitude units if required.

        Although "ft" is mostly used as main unit in openAIR airspace definitions, sometimes "meters" (m) are used instead.
        In this case, the tokenizer will convert meters into feet BUT this comes at a downside. Unfortunately,
        the source used to generate the openAIR file will often define meter values that are "prettified" and when
        converted to feet, they will almost NEVER match the common rounded values like "2500" but rather something like "2478.123".
         */
        value = this.convertUnits(value, unit, this.targetAltUnit);
        // round value
        value = this.roundAltValues ? parseInt(Math.round(value)) : value;

        return { value, unit: this.targetAltUnit, referenceDatum };
    }

    /**
     * @param {number} value
     * @param {string} baseUnit
     * @param {string} targetUnit
     * @return {number}
     * @private
     */
    convertUnits(value, baseUnit, targetUnit) {
        if (baseUnit === targetUnit) return value;

        let convValue;
        if (baseUnit === altitudeUnit.ft && targetUnit === altitudeUnit.m) {
            convValue = this.feetToMeters(value);
        } else if (baseUnit === altitudeUnit.m && targetUnit === altitudeUnit.ft) {
            convValue = this.metersToFeet(value);
        } else {
            throw new Error(`Unit conversion between '${baseUnit}' and '${targetUnit}' not supported`);
        }

        return convValue;
    }

    /**
     * @param {number} meters
     * @return {number}
     * @private
     */
    metersToFeet(meters) {
        checkTypes.assert.number(meters);

        return meters * 3.28084;
    }

    /**
     * @param {number} feet
     * @return {number}
     * @private
     */
    feetToMeters(feet) {
        checkTypes.assert.number(feet);

        return feet / 3.28084;
    }

    /**
     * @param {string} reference
     * @return {string}
     * @private
     */
    harmonizeReference(reference) {
        checkTypes.assert.string(reference);

        switch (reference) {
            case 'MSL':
            case 'AMSL':
            case 'ALT':
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
 * @type {typedefs.openaip.OpenairParser.AltitudeReader}
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
 * @type {typedefs.openaip.OpenairParser.AltitudeReader}
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
 * @type {typedefs.openaip.OpenairParser.AltitudeReader}
 */
class AltitudeUnlimitedReader {
    /**
     * @param {{unlimited: number}} config - Defines the flight level to set if an airspace ceiling is defined with "unlimited". Defaults to 999;
     */
    constructor({ unlimited }) {
        checkTypes.assert.integer(unlimited);

        this.unlimited = unlimited;
        // unlimited ceiling definition
        this.REGEX_ALTITUDE = /^(UNLIMITED|UNL|UNLTD)$/;
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
        return { value: this.unlimited, unit: 'FL', referenceDatum: 'STD' };
    }
}

module.exports = BaseAltitudeToken;
