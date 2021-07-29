const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const Coordinates = require('coordinate-parser');
const ParserError = require('../parser-error');

/**
 * Tokenizes "DB" airspace arc endpoints definition.
 */
class DbToken extends BaseLineToken {
    static type = 'DB';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DB line e.g. "DB 52:22:39 N 013:08:15 E , 52:24:33 N 013:11:02 E"
        return /^DB\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new DbToken({ tokenTypes: this._tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartEndpoints = line.replace(/^DB\s+/, '');
        // endpoints are defined as comma separated coordinate pairs
        const endpoints = linePartEndpoints.split(',');
        endpoints.map((value) => value.trim());

        // transform each endpoint coordinate string into coordinate object
        let coord = [];
        for (const coordinate of endpoints) {
            try {
                coord.push(new Coordinates(coordinate));
            } catch (e) {
                throw new ParserError({ lineNumber, errorMessage: `Unknown coordinate definition '${line}'` });
            }
        }

        token._tokenized = { line, lineNumber, metadata: { coordinates: coord } };

        return token;
    }

    isAllowedNextToken(token) {
        const { BLANK_TOKEN, COMMENT_TOKEN, DP_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN } = this._tokenTypes;

        return [BLANK_TOKEN, COMMENT_TOKEN, DP_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN].includes(token.constructor.type);
    }
}

module.exports = DbToken;
