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
        const token = new BlankToken({ tokenTypes: this._tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        token._tokenized = { line, lineNumber };

        return token;
    }

    isAllowedNextToken(token) {
        const { BLANK_TOKEN, AC_TOKEN, COMMENT_TOKEN, EOF_TOKEN, SKIPPED_TOKEN } = this._tokenTypes;

        return [BLANK_TOKEN, AC_TOKEN, COMMENT_TOKEN, EOF_TOKEN, SKIPPED_TOKEN].includes(token.constructor.type);
    }
}

module.exports = BlankToken;
