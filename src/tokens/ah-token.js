const BaseAltitudeToken = require('./base-altitude-token');
const checkTypes = require('check-types');
const AlToken = require('./al-token');
const DpToken = require('./dp-token');
const VToken = require('./v-token');
const CommentToken = require('./comment-token');

/**
 * Tokenizes "AH" airspace upper ceiling definitions.
 */
class AhToken extends BaseAltitudeToken {
    static type = 'AH';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AH line e.g. "AH 40000ft MSL"
        return /^AH\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AhToken(this._config);

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartAltitude = line.replace(/^AH\s+/, '');
        const altitude = this._getAltitude(linePartAltitude);

        token._tokenized = { line, lineNumber, metadata: { altitude } };

        return token;
    }

    isAllowedNextToken(token) {
        return [CommentToken.type, AlToken.type, DpToken.type, VToken.type].includes(token.constructor.type);
    }
}

module.exports = AhToken;
