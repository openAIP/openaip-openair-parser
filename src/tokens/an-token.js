const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "AN" airspace name definitions.
 */
class AnToken extends BaseLineToken {
    static type = 'AN';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AN line e.g. "AN ED-R10B Todendorf-Putlos MON-SAT+"
        return /^AN\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AnToken({ tokenTypes: this.tokenTypes, extendedFormat: this.extendedFormat });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AN\s+/, '');

        token.tokenized = { line, lineNumber, metadata: { name: linePartName } };

        return token;
    }

    getAllowedNextTokens() {
        const { COMMENT_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;
        // defines allowed tokens in the original format
        let allowedNextTokens = [COMMENT_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN];
        // inject extended format tokens if required
        if (this.extendedFormat) {
            const { AI_TOKEN, AF_TOKEN, AG_TOKEN } = this.tokenTypes;
            allowedNextTokens = allowedNextTokens.concat([AI_TOKEN, AF_TOKEN, AG_TOKEN]);
        }

        return allowedNextTokens;
    }
}

module.exports = AnToken;
