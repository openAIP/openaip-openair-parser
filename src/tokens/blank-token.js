const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const AcToken = require('./ac-token');
const CommentToken = require('./comment-token');
const EofToken = require('./eof-token');

/**
 * Handles blank lines. Each blank line is considered to separate each airspace definition block.
 */
class BlankToken extends BaseLineToken {
    static type = 'BLANK';

    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        return line.length === 0;
    }

    tokenize(line, lineNumber) {
        const token = new BlankToken();

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        token._tokenized = { line, lineNumber };

        return token;
    }

    isAllowedNextToken(token) {
        return [BlankToken.type, AcToken.type, CommentToken.type, EofToken.type].includes(token.constructor.type);
    }
}

module.exports = BlankToken;
