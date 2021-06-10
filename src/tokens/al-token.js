const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "AL" airspace lower ceiling definitions.
 */
class AlToken extends BaseLineToken {
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AL line e.g. "AL GND"
        return /^AL\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // remove the AL part of the string to get the airspace altitude definition
        const linePartAltitude = line.replace(/^AL\s+/, '');
        const altitude = this._getAltitude(linePartAltitude);

        return { line, lineNumber, altitude };
    }
}

module.exports = AlToken;
