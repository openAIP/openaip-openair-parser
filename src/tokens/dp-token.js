const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');
const { Parser: CoordinateParser } = require('@openaip/coordinate-parser');

/**
 * Tokenizes "DP" airspace polygon coordinate definition.
 */
class DpToken extends BaseLineToken {
    static type = 'DP';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DP line e.g. "DP 54:25:00 N 010:40:00 E"
        return /^DP\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new DpToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        // extract coordinate pair
        const linePartCoordinate = line.replace(/^DP\s+/, '');

        let coordinate;
        try {
            const parser = new CoordinateParser();
            coordinate = parser.parse(linePartCoordinate.trim());
        } catch (e) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown coordinate definition '${line}'` });
        }

        token.tokenized = { line, lineNumber, metadata: { coordinate } };

        return token;
    }

    getAllowedNextTokens() {
        const { COMMENT_TOKEN, DP_TOKEN, DA_TOKEN, BLANK_TOKEN, EOF_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN } =
            this.tokenTypes;

        return [COMMENT_TOKEN, DP_TOKEN, DA_TOKEN, BLANK_TOKEN, EOF_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = DpToken;
