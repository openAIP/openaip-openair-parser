const checkTypes = require('check-types');

/**
 * @namespace typedefs.openaip.OpenairParser.ParserError
 */

/**
 * @typedef {typedefs.openaip.OpenairParser.ParserError.Config}
 * @type {Object}
 * @property {string} line
 * @property {string} lineNumber
 * @property {string} message
 */

class ParserError extends Error {
    /**
     * @param {typedefs.openaip.OpenairParser.ParserError.Config}
     * @returns {void}
     * @private
     */
    constructor({ line, lineNumber, errorMessage }) {
        if (line != null) checkTypes.assert.string(line);
        if (lineNumber != null) checkTypes.assert.integer(lineNumber);
        checkTypes.assert.nonEmptyString(errorMessage);

        if (line != null && line?.length > 0 && lineNumber != null) {
            super(`Error found in '${line}' at line ${lineNumber}: ${errorMessage}`);
        } else {
            super(errorMessage);
        }

        this.line = line;
        this.lineNumber = lineNumber;
        this.errorMessage = errorMessage;
    }
}

module.exports = ParserError;
