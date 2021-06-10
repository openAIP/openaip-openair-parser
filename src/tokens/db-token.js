const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const BlankToken = require('./blank-token');
const CommentToken = require('./comment-token');
const Coordinates = require('coordinate-parser');

/**
 * Tokenizes "DB" airspace arc endpoints definition.
 */
class DbToken extends BaseLineToken {
    static type = 'DB';

    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DB line e.g. "DB 52:22:39 N 013:08:15 E , 52:24:33 N 013:11:02 E"
        return /^DB\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartEndpoints = line.replace(/^DB\s+/, '');
        // endpoints are defined as comma separated coordinate pairs
        const endpoints = linePartEndpoints.split(',');
        endpoints.map((value) => value.trim());

        // transform each endpoint coordinate string into coordinate object
        let coordinates = [];
        for (const coordinate of endpoints) {
            try {
                coordinates.push(new Coordinates(coordinate));
            } catch (e) {
                throw new SyntaxError(`Unknown coordinate definition '${line}'`);
            }
        }

        this._tokenized = { line, lineNumber, metadata: { coordinates } };
    }

    isAllowedNextToken(token) {
        return [BlankToken.type, CommentToken.type].includes(token.constructor.type);
    }
}

module.exports = DbToken;
