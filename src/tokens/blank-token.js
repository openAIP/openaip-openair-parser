const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Handles blank lines. Each blank line is considered to separate each airspace definition block.
 */
class BlankToken extends BaseLineToken {
    static type = 'BLANK';

    canHandle(line) {
        checkTypes.assert.string(line);

        return line.length === 0;
    }

    tokenize(line, lineNumber) {
        const token = new BlankToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        token.tokenized = { line, lineNumber };

        return token;
    }

    getAllowedNextTokens() {
        const { BLANK_TOKEN, AC_TOKEN, COMMENT_TOKEN, EOF_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [BLANK_TOKEN, AC_TOKEN, COMMENT_TOKEN, EOF_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = BlankToken;
