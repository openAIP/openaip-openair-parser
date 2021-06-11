const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Handles comments, e.g. lines starting with "*".
 */
class CommentToken extends BaseLineToken {
    static type = 'COMMENT';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is comment line starting with "* this is a comment"
        return /^\*.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new CommentToken({ tokenTypes: this._tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        token._tokenized = { line, lineNumber };

        return token;
    }

    isAllowedNextToken(token) {
        const {
            COMMENT_TOKEN,
            BLANK_TOKEN,
            AC_TOKEN,
            AN_TOKEN,
            AL_TOKEN,
            AH_TOKEN,
            DP_TOKEN,
            VX_TOKEN,
            VD_TOKEN,
            DB_TOKEN,
            DC_TOKEN,
            EOF_TOKEN,
        } = this._tokenTypes;

        return [
            COMMENT_TOKEN,
            BLANK_TOKEN,
            AC_TOKEN,
            AN_TOKEN,
            AL_TOKEN,
            AH_TOKEN,
            DP_TOKEN,
            VX_TOKEN,
            VD_TOKEN,
            DB_TOKEN,
            DC_TOKEN,
            EOF_TOKEN,
        ].includes(token.constructor.type);
    }
}

module.exports = CommentToken;
