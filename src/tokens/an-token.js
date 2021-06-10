const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const AhToken = require('./ah-token');
const AlToken = require('./al-token');
const CommentToken = require('./comment-token');

/**
 * Tokenizes "AN" airspace name definitions.
 */
class AnToken extends BaseLineToken {
    static type = 'AN';

    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AN line e.g. "AN ED-R10B Todendorf-Putlos MON-SAT+"
        return /^AN\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartName = line.replace(/^AN\s+/, '');

        this._tokenized = { line, lineNumber, metadata: { name: linePartName } };
    }

    isAllowedNextToken(token) {
        return [CommentToken.type, AlToken.type, AhToken.type].includes(token.constructor.type);
    }
}

module.exports = AnToken;
