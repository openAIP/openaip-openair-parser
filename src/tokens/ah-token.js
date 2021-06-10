const BaseAltitudeToken = require('./base-altitude-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "AH" airspace upper ceiling definitions.
 */
class AhToken extends BaseAltitudeToken {
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AH line e.g. "AH 40000ft MSL"
        return /^AH\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // remove the AH part of the string to get the airspace altitude definition
        const linePartAltitude = line.replace(/^AH\s+/, '');
        const altitude = this._getAltitude(linePartAltitude);

        return { line, lineNumber, altitude };
    }
}

module.exports = AhToken;
