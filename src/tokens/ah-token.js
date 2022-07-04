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
        const token = new AhToken({
            tokenTypes: this.tokenTypes,
            unlimited: this.unlimited,
            defaultAltUnit: this.defaultAltUnit,
            targetAltUnit: this.targetAltUnit,
            roundAltValues: this.roundAltValues,
        });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        this.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartAltitude = line.replace(/^AH\s+/, '');
        let altitude;
        try {
            altitude = this.getAltitude(linePartAltitude);
        } catch (e) {
            if (e instanceof SyntaxError) {
                throw new ParserError({ lineNumber, errorMessage: e.message });
            } else {
                throw e;
            }
        }

        token.tokenized = { line, lineNumber, metadata: { altitude } };

        return token;
    }

    getAllowedNextTokens() {
        const { COMMENT_TOKEN, AL_TOKEN, DP_TOKEN, VW_TOKEN, VX_TOKEN, SKIPPED_TOKEN, VD_TOKEN } = this.tokenTypes;

        return [COMMENT_TOKEN, AL_TOKEN, DP_TOKEN, VW_TOKEN, VX_TOKEN, SKIPPED_TOKEN, VD_TOKEN];
    }
}

module.exports = AhToken;
