const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "AI" unique airspace identifier string.
 */
class AiToken extends BaseLineToken {
    static type = 'AI';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AI line e.g. "AI f012e054-e9a4-43dd-87be-eb88b3088439"
        return /^AI\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AiToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AI\s+/, '');

        token.tokenized = { line, lineNumber, metadata: { identifier: linePartName } };

        return token;
    }

    getAllowedNextTokens() {
        // no extended format option handling, AG token only in extended format
        const { COMMENT_TOKEN, AN_TOKEN, AY_TOKEN, AF_TOKEN, AG_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN } =
            this.tokenTypes;

        return [COMMENT_TOKEN, AN_TOKEN, AY_TOKEN, AF_TOKEN, AG_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = AiToken;
