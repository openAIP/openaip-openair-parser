const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const BlankToken = require('./blank-token');
const CommentToken = require('./comment-token');

/**
 * Tokenizes "DC" airspace circle radius definition.
 */
class DcToken extends BaseLineToken {
    static type = 'DC';

    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DC line e.g. "DC 1.10"
        return /^DC\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartRadius = line.replace(/^DC\s+/, '');

        const isRadius = /^\d+(\.\d+)?$/.test(linePartRadius);
        if (!isRadius) {
            throw new SyntaxError(`Unknown circle radius definition '${line}'`);
        }

        this._tokenized = { line, lineNumber, metadata: { radius: linePartRadius } };
    }

    isAllowedNextToken(token) {
        return [BlankToken.type, CommentToken.type].includes(token.constructor.type);
    }
}

module.exports = DcToken;
