const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const Coordinates = require('coordinate-parser');
const CommentToken = require('./comment-token');
const DcToken = require('./dc-token');
const DbToken = require('./db-token');

/**
 * Tokenizes "V" airspace circle center coordinate definition.
 */
class VToken extends BaseLineToken {
    static type = 'V';

    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is V line e.g. "V X=53:24:25 N 010:25:10 E"
        return /^V\s+X=.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new VToken();

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartCoordinate = line.replace(/^V\s+X=/, '');

        let coordinate;
        try {
            coordinate = new Coordinates(linePartCoordinate);
        } catch (e) {
            throw new SyntaxError(`Unknown coordinate definition '${line}'`);
        }

        token._tokenized = { line, lineNumber, metadata: { coordinate } };

        return token;
    }

    isAllowedNextToken(token) {
        return [CommentToken.type, DcToken.type, DbToken.type].includes(token.constructor.type);
    }
}

module.exports = VToken;
