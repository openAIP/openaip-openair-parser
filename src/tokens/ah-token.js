const BaseAltitudeToken = require('./base-altitude-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

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
        const token = new AhToken({ tokenTypes: this._tokenTypes, unlimited: this._unlimited });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartAltitude = line.replace(/^AH\s+/, '');
        let altitude;
        try {
            altitude = this._getAltitude(linePartAltitude);
        } catch (e) {
            if (e instanceof SyntaxError) {
                throw new ParserError({ line, lineNumber, errorMessage: e.message });
            } else {
                throw e;
            }
        }

        token._tokenized = { line, lineNumber, metadata: { altitude } };

        return token;
    }

    isAllowedNextToken(token) {
        const { COMMENT_TOKEN, AL_TOKEN, DP_TOKEN, VX_TOKEN, SKIPPED_TOKEN } = this._tokenTypes;

        return [COMMENT_TOKEN, AL_TOKEN, DP_TOKEN, VX_TOKEN, SKIPPED_TOKEN].includes(token.constructor.type);
    }
}

module.exports = AhToken;
