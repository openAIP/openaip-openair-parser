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
        const token = new AnToken({ tokenTypes: this._tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartName = line.replace(/^AN\s+/, '');

        token._tokenized = { line, lineNumber, metadata: { name: linePartName } };

        return token;
    }

    isAllowedNextToken(token) {
        const { COMMENT_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN } = this._tokenTypes;

        return [COMMENT_TOKEN, AL_TOKEN, AH_TOKEN, SKIPPED_TOKEN].includes(token.constructor.type);
    }
}

module.exports = AnToken;
