const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Handles ignored lines, e.g. comments starting with "*" or blank lines.
 */
class IgnoredLineToken extends BaseLineToken {
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // blank line
        if (line.length === 0) return true;

        // is comment line starting with "* this is a comment"
        return /^\*.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        return { line, lineNumber };
    }
}

module.exports = IgnoredLineToken;
