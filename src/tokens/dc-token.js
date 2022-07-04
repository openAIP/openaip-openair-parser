const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

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
        const token = new DcToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        this.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartRadius = line.replace(/^DC\s+/, '');

        const isRadius = /^\d+(\.\d+)?$/.test(linePartRadius);
        if (!isRadius) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown circle radius definition '${line}'` });
        }

        token.tokenized = { line, lineNumber, metadata: { radius: parseFloat(linePartRadius) } };

        return token;
    }

    getAllowedNextTokens() {
        const { BLANK_TOKEN, COMMENT_TOKEN, EOF_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [BLANK_TOKEN, COMMENT_TOKEN, EOF_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = DcToken;
