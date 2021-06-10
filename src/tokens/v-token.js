const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const Coordinates = require('coordinate-parser');
const CommentToken = require('./comment-token');
const DcToken = require('./dc-token');

/**
 * Tokenizes "V" airspace circle center coordinate definition.
 */
class VToken extends BaseLineToken {
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is V line e.g. "V X=53:24:25 N 010:25:10 E"
        return /^V\s+X=.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartCoordinate = line.replace(/^V\s+X=/, '');

        let coordinates;
        try {
            coordinates = new Coordinates(linePartCoordinate);
        } catch (e) {
            throw new SyntaxError(`Unknown coordinate definition '${linePartCoordinate}'`);
        }

        return { line, lineNumber, coordinates };
    }

    isAllowedNextToken(token) {
        return token instanceof CommentToken || token instanceof DcToken;
    }
}

module.exports = VToken;
