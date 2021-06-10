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
    constructor() {
        super();
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

        return { line, lineNumber, altitude };
    }

    isAllowedNextToken(token) {
        return (
            token instanceof CommentToken ||
            token instanceof AhToken ||
            token instanceof DpToken ||
            token instanceof VToken
        );
    }
}

module.exports = AlToken;
