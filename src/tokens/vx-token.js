const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const { Parser: CoordinateParser } = require('@openaip/coordinate-parser');
const ParserError = require('../parser-error');

/**
 * Tokenizes "V X=" airspace circle center coordinate definition.
 */
class VxToken extends BaseLineToken {
    static type = 'VX';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is V line e.g. "V X=53:24:25 N 010:25:10 E"
        return /^V\s+X=.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new VxToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartCoordinate = line.replace(/^V\s+[X]=/, '');

        let coordinate;
        try {
            const parser = new CoordinateParser();
            coordinate = parser.parse(linePartCoordinate.trim());
        } catch (e) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown coordinate definition '${line}'` });
        }

        token.tokenized = { line, lineNumber, metadata: { coordinate } };

        return token;
    }

    getAllowedNextTokens() {
        const { COMMENT_TOKEN, DC_TOKEN, DB_TOKEN, DA_TOKEN, VD_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [COMMENT_TOKEN, DC_TOKEN, DB_TOKEN, DA_TOKEN, VD_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = VxToken;
