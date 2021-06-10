const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const Coordinates = require('coordinate-parser');
const CommentToken = require('./comment-token');
const BlankToken = require('./blank-token');
const EofToken = require('./eof-token');

/**
 * Tokenizes "DP" airspace polygon coordinate definition.
 */
class DpToken extends BaseLineToken {
    static type = 'DP';

    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DP line e.g. "DP 54:25:00 N 010:40:00 E"
        return /^DP\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartCoordinate = line.replace(/^DP\s+/, '');

        let coordinates;
        try {
            coordinates = new Coordinates(linePartCoordinate);
        } catch (e) {
            throw new SyntaxError(`Unknown coordinate definition '${line}'`);
        }

        this._tokenized = { line, lineNumber, metadata: { coordinates } };
    }

    isAllowedNextToken(token) {
        return [CommentToken.type, DpToken.type, BlankToken.type, EofToken.type].includes(token.constructor.type);
    }
}

module.exports = DpToken;
