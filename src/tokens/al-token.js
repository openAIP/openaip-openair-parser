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
        const token = new AlToken({
            tokenTypes: this.tokenTypes,
            unlimited: this.unlimited,
            defaultAltUnit: this.defaultAltUnit,
            targetAltUnit: this.targetAltUnit,
            roundAltValues: this.roundAltValues,
        });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartAltitude = line.replace(/^AL\s+/, '');
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
        const { COMMENT_TOKEN, AG_TOKEN, AF_TOKEN, AH_TOKEN, DP_TOKEN, VW_TOKEN, VX_TOKEN, SKIPPED_TOKEN, VD_TOKEN } =
            this.tokenTypes;

        return [COMMENT_TOKEN, AG_TOKEN, AF_TOKEN, AH_TOKEN, DP_TOKEN, VW_TOKEN, VX_TOKEN, SKIPPED_TOKEN, VD_TOKEN];
    }
}

module.exports = AlToken;
