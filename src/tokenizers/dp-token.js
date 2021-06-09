const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "DP" airspace polygon coordinate definition.
 */
class DpToken extends BaseLineToken {
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DP line e.g. "DP 54:25:00 N 010:40:00 E"
        return /^DP\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        return { line, lineNumber };
    }
}

module.exports = DpToken;
