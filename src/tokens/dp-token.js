const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const Coordinates = require('coordinate-parser');
const ParserError = require('../parser-error');

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
        const token = new DpToken({ tokenTypes: this._tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartCoordinate = line.replace(/^DP\s+/, '');

        let coordinate;
        try {
            coordinate = new Coordinates(linePartCoordinate);
        } catch (e) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown coordinate definition '${line}'` });
        }

        token._tokenized = { line, lineNumber, metadata: { coordinate } };

        return token;
    }

    isAllowedNextToken(token) {
        const { COMMENT_TOKEN, DP_TOKEN, BLANK_TOKEN, EOF_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN } = this._tokenTypes;

        return [COMMENT_TOKEN, DP_TOKEN, BLANK_TOKEN, EOF_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN].includes(
            token.constructor.type
        );
    }
}

module.exports = DpToken;
