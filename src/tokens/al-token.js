const BaseAltitudeToken = require('./base-altitude-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

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
        const token = new AlToken({ tokenTypes: this._tokenTypes, unlimited: this._unlimited });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartAltitude = line.replace(/^AL\s+/, '');
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
        const { COMMENT_TOKEN, AH_TOKEN, DP_TOKEN, VX_TOKEN, SKIPPED_TOKEN } = this._tokenTypes;

        return [COMMENT_TOKEN, AH_TOKEN, DP_TOKEN, VX_TOKEN, SKIPPED_TOKEN].includes(token.constructor.type);
    }
}

module.exports = AlToken;
