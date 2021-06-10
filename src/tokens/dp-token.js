const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const Coordinates = require('coordinate-parser');
const CommentToken = require('./comment-token');
const BlankToken = require('./blank-token');

/**
 * Tokenizes "DP" airspace polygon coordinate definition.
 */
class DpToken extends BaseLineToken {
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

        return { line, lineNumber, coordinates };
    }

    isAllowedNextToken(token) {
        return token instanceof CommentToken || token instanceof DpToken || token instanceof BlankToken;
    }
}

module.exports = DpToken;
