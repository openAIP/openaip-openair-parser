const checkTypes = require('check-types');

class ParserError {
    /**
     * @param {string} line
     * @param {number} lineNumber
     * @param {string} errorMessage
     * @returns {void}
     * @private
     */
    constructor({ line, lineNumber, errorMessage }) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);
        checkTypes.assert.nonEmptyString(errorMessage);

        this.line = line;
        this.lineNumber = lineNumber;
        this.errorMessage = errorMessage;
    }

    toString() {
        return `Error found in '${this.line}' at line ${this.lineNumber}: ${this.errorMessage}`;
    }
}

module.exports = ParserError;
