const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');
const ParserError = require('../parser-error');

/**
 * Tokenizes "AC" airspace class definitions.
 */
class AcToken extends BaseLineToken {
    static type = 'AC';

    /**
     * @param {Object} config
     * @param {boolean} config.extendedFormat - If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
     * @param {string[]} [config.airspaceClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
     * @param {string[]} [config.extendedFormatClasses] - Defines a set of allowed "AC" values if the extended format is used. Defaults to all ICAO classes.
     * @param {typedefs.openaip.OpenairParser.TokenTypes} config.tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.
     */
    constructor(config) {
        const { airspaceClasses, tokenTypes, extendedFormat, extendedFormatClasses } = config;

        super({ tokenTypes });

        checkTypes.assert.boolean(extendedFormat);
        checkTypes.assert.array.of.nonEmptyString(airspaceClasses);
        if (extendedFormatClasses) checkTypes.assert.array.of.nonEmptyString(extendedFormatClasses);

        // enforce that both extended classes and types are defined if extended format should be parsed
        if (extendedFormat && extendedFormatClasses == null) {
            throw new Error('Extended format requires accepted classes to be defined.');
        }

        this.airspaceClasses = airspaceClasses;
        this.extendedFormat = extendedFormat;
        this.extendedFormatClasses = extendedFormatClasses;
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AC line e.g. "AC D"
        return /^AC\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        const token = new AcToken({
            airspaceClasses: this.airspaceClasses,
            extendedFormatClasses: this.extendedFormatClasses,
            extendedFormat: this.extendedFormat,
            tokenTypes: this.tokenTypes,
        });

        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartClass = line.replace(/^AC\s+/, '');

        if (this.extendedFormat) {
            // check restricted classes if using original format
            if (this.extendedFormatClasses.includes(linePartClass) === false) {
                throw new ParserError({ lineNumber, errorMessage: `Unknown extended airspace class '${line}'` });
            }
        } else {
            // check restricted classes if using original format
            if (this.airspaceClasses.includes(linePartClass) === false) {
                throw new ParserError({ lineNumber, errorMessage: `Unknown airspace class '${line}'` });
            }
        }

        token.tokenized = { line, lineNumber, metadata: { class: linePartClass } };

        return token;
    }

    getAllowedNextTokens() {
        const { COMMENT_TOKEN, AN_TOKEN, SKIPPED_TOKEN } = this.tokenTypes;
        // defines allowed tokens in the original format
        let allowedNextTokens = [COMMENT_TOKEN, AN_TOKEN, SKIPPED_TOKEN];
        // inject extended format tokens if required
        if (this.extendedFormat) {
            const { AI_TOKEN, AY_TOKEN } = this.tokenTypes;
            allowedNextTokens = allowedNextTokens.concat([AI_TOKEN, AY_TOKEN]);
        }

        return allowedNextTokens;
    }
}

module.exports = AcToken;
