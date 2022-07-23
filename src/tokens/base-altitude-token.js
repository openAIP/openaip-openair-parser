const BaseLineToken = require('./base-line-token');
const altitudeUnit = require('../altitude-unit');
const checkTypes = require('check-types');
const unitConversion = require('../unit-conversion');

/**
 * Tokenizes "AH/AL" airspace ceiling definitions.
 */
class BaseAltitudeToken extends BaseLineToken {
    /**
     * @param {Object} config
     * @param {typedefs.openaip.OpenairParser.TokenTypes} config.tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.
     * @param {number} [config.unlimited] - Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
     * @param {string} [config.defaultAltUnit] - By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
     * @param {string} [config.targetAltUnit] - Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. If not set, does not convert units.
     * @param {boolean} [config.roundAltValues] - If true, rounds the altitude values. Defaults to false. This parameter is most useful when used with unit conversion, e.g. m -> feet.
     */
    constructor(config) {
        const { unlimited, tokenTypes, defaultAltUnit, targetAltUnit, roundAltValues } = config || {};

        checkTypes.assert.integer(unlimited);
        checkTypes.assert.string(defaultAltUnit);
        if (targetAltUnit) checkTypes.assert.string(targetAltUnit);
        checkTypes.assert.boolean(roundAltValues);

        super({ tokenTypes });

        this.unlimited = unlimited;
        this.defaultAltUnit = defaultAltUnit.toUpperCase();
        this.targetAltUnit = targetAltUnit ? targetAltUnit.toUpperCase() : null;
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
     * @param {{defaultAltUnit: string, [targetAltUnit]: string|null, roundAltValues: boolean}} config
     */
    constructor(config) {
        const { defaultAltUnit, targetAltUnit, roundAltValues } = config || {};

        checkTypes.assert.string(defaultAltUnit);
        if (targetAltUnit) checkTypes.assert.string(targetAltUnit);
        checkTypes.assert.boolean(roundAltValues);

        this.defaultAltUnit = defaultAltUnit.toUpperCase();
        this.targetAltUnit = targetAltUnit ? targetAltUnit.toUpperCase() : null;
        this.roundAltValues = roundAltValues;
        this.REGEX_ALTITUDE = /^(\d+(\.\d+)?)\s*(FT|ft|M|m)?\s*(MSL|AMSL|ALT|GND|GROUND|AGL|SURFACE|SFC|SRFC)?$/;
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
        Convert between altitude units if required. This only happens if a target unit is explicitly specified!

        Although "ft" is mostly used as main unit in openAIR airspace definitions, sometimes "meters" (m) are used instead.
        In this case, the tokenizer can convert meters into feet BUT this comes at a downside. Unfortunately,
        the source used to generate the openAIR file will often define meter values that are "prettified" and when
        converted to feet, they will almost NEVER match the common rounded values like "2500" but rather something like "2478.123".
         */
        if (this.targetAltUnit != null) {
            value = this.convertUnits(value, unit, this.targetAltUnit);
            // switch to new target unit
            unit = this.targetAltUnit;
        }
        // round values if requested
        // round value
        value = this.roundAltValues ? parseInt(Math.round(value)) : value;

        return { value, unit, referenceDatum };
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
            convValue = unitConversion.feetToMeters(value);
        } else if (baseUnit === altitudeUnit.m && targetUnit === altitudeUnit.ft) {
            convValue = unitConversion.metersToFeet(value);
        } else {
            throw new Error(`Unit conversion between '${baseUnit}' and '${targetUnit}' not supported`);
        }

        return convValue;
    }

    /**
     * Harmonizes various Openair related reference datum definitions and returns internally used reference datum.
     * If NO reference datum is given, default is to use "MSL"!
     *
     * @param {string|null} reference
     * @return {string}
     * @private
     */
    harmonizeReference(reference) {
        switch (reference) {
            case 'GND':
            case 'GROUND':
            case 'AGL':
            case 'SURFACE':
            case 'SFC':
            case 'SRFC':
                return 'GND';
            // if no reference datum is defined, always use MSL
            case 'MSL':
            case 'AMSL':
            case 'ALT':
            default:
                return 'MSL';
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
        this.REGEX_ALTITUDE = /^(UNLIMITED|UNLIM|UNL|UNLTD)$/;
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
