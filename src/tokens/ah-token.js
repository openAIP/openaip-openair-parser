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
    constructor() {
        super();
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AH line e.g. "AH 40000ft MSL"
        return /^AH\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartAltitude = line.replace(/^AH\s+/, '');
        const altitude = this._getAltitude(linePartAltitude);

        return { line, lineNumber, altitude };
    }

    isAllowedNextToken(token) {
        return (
            token instanceof CommentToken ||
            token instanceof AlToken ||
            token instanceof DpToken ||
            token instanceof VToken
        );
    }
}

module.exports = AhToken;
