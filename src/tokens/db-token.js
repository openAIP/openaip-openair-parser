const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');
const { Parser } = require('@openaip/coordinate-parser');

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
        const token = new DbToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartEndpoints = line.replace(/^DB\s+/, '');
        // endpoints are defined as comma separated coordinate pairs
        const endpoints = linePartEndpoints.split(',');
        endpoints.map((value) => value.trim());

        // transform each endpoint coordinate string into coordinate object
        let coord = [];
        for (const coordinate of endpoints) {
            try {
                const parser = new Parser();
                const parsedCoordinate = parser.parse(coordinate);
                coord.push(parsedCoordinate);
            } catch (e) {
                throw new ParserError({ lineNumber, errorMessage: `Unknown coordinate definition '${line}'` });
            }
        }

        token.tokenized = { line, lineNumber, metadata: { coordinates: coord } };

        return token;
    }

    getAllowedNextTokens() {
        const { BLANK_TOKEN, COMMENT_TOKEN, DP_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [BLANK_TOKEN, COMMENT_TOKEN, DP_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = DbToken;
