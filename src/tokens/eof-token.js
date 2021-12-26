const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * @typedef typedefs.openaip.OpenairParser.EofTokenConfig
 * @type Object
 * @property {number} lastLineNumber - Last line number of file.
 * @property {typedefs.openaip.OpenairParser.TokenTypes} tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.

 */

/**
 * EOF token. Is not generated by the tokenizer but appended to the token list after tokenizer
 * is finished. Marks the end of the parsed file.
 */
class EofToken extends BaseLineToken {
    static type = 'EOF';

    /**
     * @param {typedefs.openaip.OpenairParser.EofTokenConfig} config
     */
    constructor(config) {
        const { tokenTypes, lastLineNumber } = config;

        super({ tokenTypes });

        checkTypes.assert.number(lastLineNumber);

        this.lastLineNumber = lastLineNumber;
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
        return { line: '', lineNumber: this.lastLineNumber };
    }
}

module.exports = EofToken;
