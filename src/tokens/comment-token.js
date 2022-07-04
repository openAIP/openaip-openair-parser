const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Handles comments, e.g. lines starting with "*".
 */
class CommentToken extends BaseLineToken {
    static type = 'COMMENT';

    isIgnoredToken() {
        return true;
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is comment line starting with "* this is a comment"
        return /^\*.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new CommentToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        this.line = line;
        token.tokenized = { line, lineNumber };

        return token;
    }

    getAllowedNextTokens() {
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
        } = this.tokenTypes;

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
        ];
    }
}

module.exports = CommentToken;
