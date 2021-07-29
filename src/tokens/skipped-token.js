const CommentToken = require('./comment-token');
const checkTypes = require('check-types');

/**
 * Handles skipped tokens.
 */
class SkippedToken extends CommentToken {
    static type = 'SKIPPED';

    canHandle(line) {
        checkTypes.assert.string(line);

        // line contains a skipped token
        return /^(AT|TO|TC|SP|SB|DY).*$/.test(line);
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
            SKIPPED_TOKEN,
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
            SKIPPED_TOKEN,
        ].includes(token.constructor.type);
    }
}

module.exports = SkippedToken;
