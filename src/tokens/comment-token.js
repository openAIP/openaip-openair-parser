const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const BlankToken = require('./blank-token');
const AcToken = require('./ac-token');
const AnToken = require('./an-token');
const AlToken = require('./al-token');
const AhToken = require('./ah-token');
const DpToken = require('./dp-token');
const VToken = require('./v-token');
const DcToken = require('./dc-token');

/**
 * Handles comments, e.g. lines starting with "*".
 */
class CommentToken extends BaseLineToken {
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is comment line starting with "* this is a comment"
        return /^\*.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        return { line, lineNumber };
    }

    isAllowedNextToken(token) {
        return (
            token instanceof CommentToken ||
            token instanceof BlankToken ||
            token instanceof AcToken ||
            token instanceof AnToken ||
            token instanceof AlToken ||
            token instanceof AhToken ||
            token instanceof DpToken ||
            token instanceof VToken ||
            token instanceof DcToken
        );
    }
}

module.exports = CommentToken;
