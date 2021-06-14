const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * @typedef typedefs.openaipOpenairParser.AcTokenConfig
 * @type Object
 * @property {string[]} [airspaceClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 * @property {typedefs.openaipOpenairParser.TokenTypes} tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.
 */

/**
 * Tokenizes "AC" airspace class definitions.
 */
class AcToken extends BaseLineToken {
    static type = 'AC';

    /**
     * @param {typedefs.openaipOpenairParser.AcTokenConfig} config
     */
    constructor(config) {
        const { airspaceClasses, tokenTypes } = config;

        super({ tokenTypes });

        checkTypes.assert.array.of.nonEmptyString(airspaceClasses);

        this._airspaceClasses = airspaceClasses;
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AC line e.g. "AC D"
        return /^AC\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AcToken({ airspaceClasses: this._airspaceClasses, tokenTypes: this._tokenTypes });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartClass = line.replace(/^AC\s+/, '');

        // check restricted classes
        if (!this._airspaceClasses.includes(linePartClass)) {
            throw new SyntaxError(`Unknown airspace class '${line}'`);
        }

        token._tokenized = { line, lineNumber, metadata: { class: linePartClass } };

        return token;
    }

    isAllowedNextToken(token) {
        const { COMMENT_TOKEN, AN_TOKEN } = this._tokenTypes;

        return [COMMENT_TOKEN, AN_TOKEN].includes(token.constructor.type);
    }
}

module.exports = AcToken;
