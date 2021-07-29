const checkTypes = require('check-types');

class ParserError extends Error {
    /**
     * @param {{lineNumber: number, errorMessage: string}} config
     * @returns {void}
     * @private
     */
    constructor({ lineNumber, errorMessage }) {
        if (lineNumber != null) checkTypes.assert.integer(lineNumber);
        checkTypes.assert.nonEmptyString(errorMessage);

        if (lineNumber == null) {
            super(errorMessage);
        } else {
            super(`Error found at line ${lineNumber}: ${errorMessage}`);
        }

        this.lineNumber = lineNumber;
        this.errorMessage = errorMessage;
    }
}

module.exports = ParserError;
