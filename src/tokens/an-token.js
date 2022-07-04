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
        const token = new AnToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        this.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartName = line.replace(/^AN\s+/, '');

        token.tokenized = { line, lineNumber, metadata: { name: linePartName } };

        return token;
    }

    getAllowedNextTokens() {
        const { COMMENT_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [COMMENT_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = AnToken;
