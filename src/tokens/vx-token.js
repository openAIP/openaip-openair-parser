const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const Coordinates = require('coordinate-parser');

/**
 * Tokenizes "V" airspace circle center coordinate definition.
 */
class VxToken extends BaseLineToken {
    static type = 'VX';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is V line e.g. "V X=53:24:25 N 010:25:10 E"
        return /^V\s+X=.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new VxToken({ tokenTypes: this._tokenTypes });

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
        const { COMMENT_TOKEN, DC_TOKEN, DB_TOKEN, DA_TOKEN } = this._tokenTypes;

        return [COMMENT_TOKEN, DC_TOKEN, DB_TOKEN, DA_TOKEN].includes(token.constructor.type);
    }
}

module.exports = VxToken;
