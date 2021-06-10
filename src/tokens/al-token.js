const BaseAltitudeToken = require('./base-altitude-token');
const checkTypes = require('check-types');
const AhToken = require('./ah-token');
const DpToken = require('./dp-token');
const VToken = require('./v-token');
const CommentToken = require('./comment-token');

/**
 * Tokenizes "AL" airspace lower ceiling definitions.
 */
class AlToken extends BaseAltitudeToken {
    static type = 'AL';

    constructor(config) {
        super(config);
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AL line e.g. "AL GND"
        return /^AL\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartAltitude = line.replace(/^AL\s+/, '');
        const altitude = this._getAltitude(linePartAltitude);

        this._tokenized = { line, lineNumber, metadata: { altitude } };
    }

    isAllowedNextToken(token) {
        return [CommentToken.type, AhToken.type, DpToken.type, VToken.type].includes(token.constructor.type);
    }
}

module.exports = AlToken;
