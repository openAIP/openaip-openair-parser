const checkTypes = require('check-types');

class BaseLineToken {
    static type = '';

    /**
     * @param {Object} config
     * @param {typedefs.openaip.OpenairParser.TokenTypes} config.tokenTypes - List of all known token types. Required
     * @param {Object} [config.extendedFormat] - If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
     * to do "isAllowedNextToken" type checks.
     */
    constructor(config) {
        const defaultConfig = { extendedFormat: false };
        const { tokenTypes, extendedFormat } = Object.assign(defaultConfig, config);

        checkTypes.assert.nonEmptyObject(tokenTypes);
        checkTypes.assert.boolean(extendedFormat);

        this.extendedFormat = extendedFormat;
        this.tokenTypes = tokenTypes;
        this.tokenized = null;
        this.line = null;
    }

    /**
     * Returns the original tokenized line.
     *
     * @return {string}
     */
    getLine() {
        return this.line;
    }

    /**
     * Most tokens are considered to be not ignored tokens. Blank, comment and other
     * specific tokens that are not handled are considered to be "ignored" tokens.
     *
     * @return {boolean}
     */
    isIgnoredToken() {
        return false;
    }

    /**
     * @return {string}
     */
    getType() {
        return this.constructor.type;
    }

    /**
     * Returns true if the token can handle the string. False if not.
     *
     * @param {string} line
     * @return {boolean}
     */
    canHandle(line) {
        throw new Error('NOT_IMPLEMENTED');
    }

    /**
     * Factory methods that returns a new token of the corresponding type that contains the tokenized
     * representation of the parsed OpenAIR line.
     *
     * @param {string} line
     * @param {number} lineNumber
     * @return {typedefs.openaip.OpenairParser.Token}
     */
    tokenize(line, lineNumber) {
        throw new Error('NOT_IMPLEMENTED');
    }

    /**
     * Returns the tokenized line.
     *
     * @return {{line: string, lineNumber: number, [metadata]: Object}}
     */
    getTokenized() {
        return this.tokenized;
    }

    /**
     * @param {typedefs.openaip.OpenairParser.Token[]} token
     * @returns {boolean}
     */
    isAllowedNextToken(token) {
        return this.getAllowedNextTokens().includes(token.constructor.type);
    }

    /**
     * @return {string[]}
     */
    getAllowedNextTokens() {
        return [];
    }
}

module.exports = BaseLineToken;
