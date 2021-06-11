const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "DC" airspace circle radius definition.
 */
class DcToken extends BaseLineToken {
    static type = 'DC';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DC line e.g. "DC 1.10"
        return /^DC\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new DcToken({ tokenTypes: this._tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartRadius = line.replace(/^DC\s+/, '');

        const isRadius = /^\d+(\.\d+)?$/.test(linePartRadius);
        if (!isRadius) {
            throw new SyntaxError(`Unknown circle radius definition '${line}'`);
        }

        token._tokenized = { line, lineNumber, metadata: { radius: parseFloat(linePartRadius) } };

        return token;
    }

    isAllowedNextToken(token) {
        const { BLANK_TOKEN, COMMENT_TOKEN, EOF_TOKEN } = this._tokenTypes;

        return [BLANK_TOKEN, COMMENT_TOKEN, EOF_TOKEN].includes(token.constructor.type);
    }
}

module.exports = DcToken;
