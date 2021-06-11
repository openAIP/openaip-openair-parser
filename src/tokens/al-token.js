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

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AL line e.g. "AL GND"
        return /^AL\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AlToken(this._config);

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartAltitude = line.replace(/^AL\s+/, '');
        const altitude = this._getAltitude(linePartAltitude);

        token._tokenized = { line, lineNumber, metadata: { altitude } };

        return token;
    }

    isAllowedNextToken(token) {
        return [CommentToken.type, AhToken.type, DpToken.type, VToken.type].includes(token.constructor.type);
    }
}

module.exports = AlToken;
