const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Handles the D token which is part of an arc definition and declares turn-direction, e.g. clockwise or counter-clockwise.
 * Since the the DB token will get the center point AND start and end coordinates, this token can be omitted.
 */
class VdToken extends BaseLineToken {
    static type = 'VD';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is VD line e.g. "V D=-"
        return /^V\s+D=[+-]$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new VdToken({ tokenTypes: this._tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        token._tokenized = { line, lineNumber };

        return token;
    }

    isAllowedNextToken(token) {
        const { COMMENT_TOKEN, VX_TOKEN } = this._tokenTypes;

        return [COMMENT_TOKEN, VX_TOKEN].includes(token.constructor.type);
    }
}

module.exports = VdToken;
