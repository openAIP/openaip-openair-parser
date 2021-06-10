const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const AcToken = require('./ac-token');
const CommentToken = require('./comment-token');

/**
 * Handles blank lines. Each blank line is considered to separate each airspace definition block.
 */
class BlankToken extends BaseLineToken {
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        return line.length === 0;
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        return { line, lineNumber };
    }

    isAllowedNextToken(token) {
        return token instanceof BlankToken || token instanceof AcToken || token instanceof CommentToken;
    }
}

module.exports = BlankToken;
