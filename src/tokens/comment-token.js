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
const EofToken = require('./eof-token');

/**
 * Handles comments, e.g. lines starting with "*".
 */
class CommentToken extends BaseLineToken {
    static type = 'COMMENT';

    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is comment line starting with "* this is a comment"
        return /^\*.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new CommentToken();

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        token._tokenized = { line, lineNumber };

        return token;
    }

    isAllowedNextToken(token) {
        return [
            CommentToken.type,
            BlankToken.type,
            AcToken.type,
            AnToken.type,
            AlToken.type,
            AhToken.type,
            DpToken.type,
            VToken.type,
            DcToken.type,
            EofToken.type,
        ].includes(token.constructor.type);
    }
}

module.exports = CommentToken;
