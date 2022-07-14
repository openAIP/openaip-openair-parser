const checkTypes = require('check-types');

class ParserError extends Error {
    /**
     * @param {{lineNumber: number, errorMessage: string, [geometry]: Object}} config
     * @returns {void}
     * @private
     */
    constructor({ lineNumber, errorMessage, geometry }) {
        if (lineNumber != null) checkTypes.assert.integer(lineNumber);
        checkTypes.assert.nonEmptyString(errorMessage);

        if (lineNumber == null) {
            super(errorMessage);
        } else {
            super(`Error found at line ${lineNumber}: ${errorMessage}`);
        }

        this.name = 'ParserError';
        this.lineNumber = lineNumber;
        this.errorMessage = errorMessage;
        this.geometry = geometry;
    }
}

module.exports = ParserError;
