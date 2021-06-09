const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "AH" airspace upper ceiling definitions.
 */
class AhToken extends BaseLineToken {
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

        return { line, lineNumber };
    }
}

module.exports = AhToken;
