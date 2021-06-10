const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * EOF token. Is not generated by the tokenizer but appended to the token list after tokenizer
 * is finished. Marks the end of the parsed file.
 */
class EofToken extends BaseLineToken {
    static type = 'EOF';

    /**
     * @param {number} lastLineNumber
     */
    constructor(lastLineNumber) {
        super();

        this._lastLineNumber = lastLineNumber;
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // IMPORTANT cannot handle any line
        return false;
    }

    isAllowedNextToken(token) {
        // no token after EOL
        return false;
    }

    getTokenized() {
        return { line: '', lineNumber: this._lastLineNumber };
    }
}

module.exports = EofToken;