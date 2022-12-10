const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

/**
 * Tokenizes "AY" airspace type definitions.
 */
class AyToken extends BaseLineToken {
    static type = 'AY';

    /**
     * @param {Object} config
     * @param {string[]} [config.extendedFormatTypes] - Defines a set of allowed "AY" values if the extended format is used.
     * @param {typedefs.openaip.OpenairParser.TokenTypes} config.tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.
     */
    constructor(config) {
        const { tokenTypes, extendedFormatTypes } = config;

        super({ tokenTypes });

        checkTypes.assert.array.of.nonEmptyString(extendedFormatTypes);

        this.extendedFormatTypes = extendedFormatTypes;
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AC line e.g. "AC D"
        return /^AY\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AyToken({ extendedFormatTypes: this.extendedFormatTypes, tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartType = line.replace(/^AY\s+/, '');

        // if config defines a list of allowed types, verify that used type is in this list
        if (this.extendedFormatTypes?.length > 0 && this.extendedFormatTypes.includes(linePartType) === false) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown extended airspace type '${line}'` });
        }

        token.tokenized = { line, lineNumber, metadata: { type: linePartType } };

        return token;
    }

    getAllowedNextTokens() {
        // no extended format option handling, AY token only in extended format
        const { COMMENT_TOKEN, AI_TOKEN, AN_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [COMMENT_TOKEN, AI_TOKEN, AN_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = AyToken;
