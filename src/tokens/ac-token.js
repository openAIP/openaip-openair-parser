const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

/**
 * @typedef typedefs.openaip.OpenairParser.AcTokenConfig
 * @type Object
 * @property {string[]} [airspaceClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 * @property {typedefs.openaip.OpenairParser.TokenTypes} tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.
 */

/**
 * Tokenizes "AC" airspace class definitions.
 */
class AcToken extends BaseLineToken {
    static type = 'AC';

    /**
     * @param {typedefs.openaip.OpenairParser.AcTokenConfig} config
     */
    constructor(config) {
        const { airspaceClasses, tokenTypes } = config;

        super({ tokenTypes });

        checkTypes.assert.array.of.nonEmptyString(airspaceClasses);

        this.airspaceClasses = airspaceClasses;
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AC line e.g. "AC D"
        return /^AC\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AcToken({ airspaceClasses: this.airspaceClasses, tokenTypes: this.tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartClass = line.replace(/^AC\s+/, '');

        // check restricted classes
        if (!this.airspaceClasses.includes(linePartClass)) {
            throw new ParserError({ lineNumber, errorMessage: `Unknown airspace class '${line}'` });
        }

        token.tokenized = { line, lineNumber, metadata: { class: linePartClass } };

        return token;
    }

    getAllowedNextTokens() {
        const { COMMENT_TOKEN, AN_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;

        return [COMMENT_TOKEN, AN_TOKEN, SKIPPED_TOKEN];
    }
}

module.exports = AcToken;
