const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * Tokenizes "DA" airspace arc definition token.
 */
class DaToken extends BaseLineToken {
    static type = 'DA';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is DA line e.g. "DA 0.25,-57,123"
        return /^DA\s+([+-]?\d*(\.\d+)?),\s*([+-]?\d*),\s*([+-]?\d*)$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new DaToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const arcPartsDefinition = line.replace(/^DA\s+/, '');
        // DA arc definition has three parts: "radius,angelStart,angleEnd" => radius is in NM
        const arcParts = arcPartsDefinition.split(',');
        arcParts.map((value) => value.trim());
        const [radius, angleStart, angleEnd] = arcParts;
        const as = parseFloat(angleStart);
        const ae = parseFloat(angleEnd);

        // angle to bearing
        const startBearing = this.toBearing(as);
        const endBearing = this.toBearing(ae);

        // convert angles to bearings
        token.tokenized = {
            line,
            lineNumber,
            metadata: {
                arcDef: {
                    radius: parseFloat(radius),
                    startBearing: startBearing,
                    endBearing: endBearing,
                },
            },
        };

        return token;
    }

    isAllowedNextToken(token) {
        const { BLANK_TOKEN, COMMENT_TOKEN, DP_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [BLANK_TOKEN, COMMENT_TOKEN, DP_TOKEN, VD_TOKEN, VX_TOKEN, SKIPPED_TOKEN].includes(
            token.constructor.type
        );
    }

    /**
     * @param {number} angle
     * @return {number}
     * @private
     */
    toBearing(angle) {
        checkTypes.assert.number(angle);

        angle = parseFloat(angle);

        let bearing = angle % 360;
        if (bearing < 0) bearing += 360;

        return bearing;
    }
}

module.exports = DaToken;
