const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "AG" ground station call-sign for given AF frequency.
 */
class AgToken extends BaseLineToken {
    static type = 'AG';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AI line e.g. "AI f012e054-e9a4-43dd-87be-eb88b3088439"
        return /^AG\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AgToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AG\s+/, '');

        token.tokenized = { line, lineNumber, metadata: { name: linePartName } };

        return token;
    }

    getAllowedNextTokens() {
        // no extended format option handling, AG token only in extended format
        const { COMMENT_TOKEN, AF_TOKEN, AL_TOKEN, AH_TOKEN, DP_TOKEN, VW_TOKEN, VX_TOKEN, SKIPPED_TOKEN, VD_TOKEN } =
            this.tokenTypes;

        return [COMMENT_TOKEN, AF_TOKEN, AL_TOKEN, AH_TOKEN, DP_TOKEN, VW_TOKEN, VX_TOKEN, SKIPPED_TOKEN, VD_TOKEN];
    }
}

module.exports = AgToken;
