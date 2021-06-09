/**
 * @typedef typedefs.openaipOpenairParser.Token
 * @property {string} line
 * @property {integer} lineNumber
 */

class BaseLineToken {
    constructor() {}

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
     * @param {integer} lineNumber
     * @return {typedefs.openaipOpenairParser.Token}
     */
    tokenize(line, lineNumber) {
        throw new Error('NOT_IMPLEMENTED');
    }
}

module.exports = BaseLineToken;
