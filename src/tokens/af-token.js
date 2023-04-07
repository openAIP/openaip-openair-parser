const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

/**
 * Tokenizes "AF" token value which is a frequency string "123.456"
 */
class AfToken extends BaseLineToken {
    static type = 'AF';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AF line e.g. "AF 123.456"
        return /^AF\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AfToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartFrequency = line.replace(/^AF\s+/, '');
        // validate frequency string
        const isValidFrequency = /^\d{3}\.\d{3}$/.test(linePartFrequency);
        if (isValidFrequency === false) {
            throw new ParserError({ lineNumber, errorMessage: `Invalid frequency string '${line}'` });
        }

        token.tokenized = { line, lineNumber, metadata: { frequency: linePartFrequency } };

        return token;
    }

    getAllowedNextTokens() {
        // no extended format option handling, AG token only in extended format
        const { COMMENT_TOKEN, AG_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN, DP_TOKEN, VW_TOKEN, VX_TOKEN, VD_TOKEN } =
            this.tokenTypes;

        return [COMMENT_TOKEN, AG_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN, DP_TOKEN, VW_TOKEN, VX_TOKEN, VD_TOKEN];
    }
}

module.exports = AfToken;
