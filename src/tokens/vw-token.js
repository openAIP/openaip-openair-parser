const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

/**
 * Tokenizes "V W=" airway width in nautical miles.
 */
class VwToken extends BaseLineToken {
    static type = 'VW';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is W line e.g. "V W=2.5"
        return /^V\s+W=.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new VwToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        this.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartWidth = line.replace(/^V\s+[W]=/, '');

        const isWidth = /^\d+(\.\d+)?$/.test(linePartWidth);
        if (!isWidth) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown airway width definition '${line}'` });
        }

        token.tokenized = { line, lineNumber, metadata: { width: parseFloat(linePartWidth) } };

        return token;
    }

    getAllowedNextTokens() {
        const { COMMENT_TOKEN, DY_TOKEN, BLANK_TOKEN, EOF_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [COMMENT_TOKEN, DY_TOKEN, BLANK_TOKEN, EOF_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = VwToken;
