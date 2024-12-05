const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const { Parser: CoordinateParser } = require('@openaip/coordinate-parser');
const ParserError = require('../parser-error');

/**
 * Tokenizes "DY" airway segment coordinate definition.
 */
class DyToken extends BaseLineToken {
    static type = 'DY';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DY line e.g. "DY 54:25:00 N 010:40:00 E"
        return /^DY\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new DyToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        // extract coordinate pair
        const linePartCoordinate = line.replace(/^DY\s+/, '');

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
        const { COMMENT_TOKEN, DY_TOKEN, BLANK_TOKEN, EOF_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [COMMENT_TOKEN, DY_TOKEN, BLANK_TOKEN, EOF_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = DyToken;
