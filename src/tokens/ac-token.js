const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const AnToken = require('./an-token');
const CommentToken = require('./comment-token');

/**
 * @typedef typedefs.openaipOpenairParser.AcTokenConfig
 * @type Object
 * @property {string[]} [airspaceClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
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
        super();

        const { airspaceClasses } = config;
        checkTypes.assert.array.of.nonEmptyString(airspaceClasses);

        this._config = config;
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AC line e.g. "AC D"
        return /^AC\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AcToken(this._config);

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        const linePartClass = line.replace(/^AC\s+/, '');

        // check restricted classes
        if (!this._config.airspaceClasses.includes(linePartClass)) {
            throw new SyntaxError(`Unknown airspace class '${line}'`);
        }

        token._tokenized = { line, lineNumber, metadata: { class: linePartClass } };

        return token;
    }

    isAllowedNextToken(token) {
        return [CommentToken.type, AnToken.type].includes(token.constructor.type);
    }
}

module.exports = AcToken;
