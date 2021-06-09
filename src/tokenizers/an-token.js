const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "AN" airspace name definitions.
 */
class AnToken extends BaseLineToken {
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AN line e.g. "AN ED-R10B Todendorf-Putlos MON-SAT+"
        return /^AN\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // remove the AN part of the string to get the airspace name
        const linePartName = line.replace(/^AN\s+/, '');

        return { line, lineNumber, name: linePartName };
    }
}

module.exports = AnToken;
