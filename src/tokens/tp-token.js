const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

/**
 * Tokenizes "TP" token value which is a transponder code string "7000"
 */
class TpToken extends BaseLineToken {
    static type = 'TP';

    canHandle(line) {
        checkTypes.assert.string(line);

        // is TP line e.g. "TP 7000"
        return /^TP\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new TpToken({ tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartCode = line.replace(/^TP\s+/, '');
        // validate transponder code string
        const isValidCode = /^[0-7]{4}$/.test(linePartCode);
        if (isValidCode === false) {
            throw new ParserError({ lineNumber, errorMessage: `Invalid transponder code string '${line}'` });
        }

        token.tokenized = { line, lineNumber, metadata: { code: linePartCode } };

        return token;
    }

    getAllowedNextTokens() {
        // no extended format option handling, TP token only in extended format
        const {
            COMMENT_TOKEN,
            AG_TOKEN,
            AL_TOKEN,
            AH_TOKEN,
            SKIPPED_TOKEN,
            DP_TOKEN,
            VW_TOKEN,
            VX_TOKEN,
            VD_TOKEN,
            AN_TOKEN,
            AF_TOKEN,
        } = this.tokenTypes;

        return [
            COMMENT_TOKEN,
            AG_TOKEN,
            AL_TOKEN,
            AH_TOKEN,
            SKIPPED_TOKEN,
            DP_TOKEN,
            VW_TOKEN,
            VX_TOKEN,
            VD_TOKEN,
            AN_TOKEN,
            AF_TOKEN,
        ];
    }
}

module.exports = TpToken;
