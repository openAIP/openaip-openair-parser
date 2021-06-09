const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

// 16500ft MSL or similar
const REGEX_DEFAULT_ALTITUDE = /^(\d+)\s*(ft|m)?\s+(msl|gnd)?$/;

/**
 * Tokenizes "AH" airspace upper ceiling definitions.
 */
class BaseAltitudeToken extends BaseLineToken {
    constructor() {
        super();
    }

    /**
     * Turns an altitude string into an altitude object literal.
     *
     * @param {string} altitudeString
     * @return {{value: integer, unit: string, referenceDatum: string}}
     */
    _getAltitude(altitudeString) {
        checkTypes.assert.string(altitudeString);

        // trim and convert to lower case
        altitudeString = altitudeString.trim().toLowerCase();

        // check for "default" altitude definition, e.g. 16500ft MSL or similar
        if (REGEX_DEFAULT_ALTITUDE.test(altitudeString)) {
            const altitudeParts = REGEX_DEFAULT_ALTITUDE.exec(altitudeString);

            return { value: altitudeParts[1], unit: altitudeParts[2], referenceDatum: altitudeParts[3] };
        } else {
            throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
        }
    }
}

module.exports = BaseAltitudeToken;
