/**
 * @typedef typedefs.openaipOpenairParser.Token
 * @property type
 * @function getType
 * @function canHandle
 * @function tokenize
 * @function getTokenized
 * @function isAllowedNextToken
 */

class BaseLineToken {
    static type = '';

    constructor() {
        this._tokenized = null;
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
     * @param {string} line
     * @param {number} lineNumber
     * @return {void}
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
        return this._tokenized;
    }

    /**
     * Checks if the input token as next token or not.
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {boolean}
     */
    isAllowedNextToken(token) {
        throw new Error('NOT_IMPLEMENTED');
    }
}

module.exports = BaseLineToken;
