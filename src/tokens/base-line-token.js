const checkTypes = require('check-types');
const { all } = require('check-types');

/**
 * @typedef typedefs.openaip.OpenairParser.TokenConfig
 * @type Object
 * @property {typedefs.openaip.OpenairParser.TokenTypes} tokenTypes - List of all known token types. Required to do "isAllowedNextToken" type checks.
 */

class BaseLineToken {
    static type = '';

    /**
     * @param {typedefs.openaip.OpenairParser.TokenConfig} config
     */
    constructor(config) {
        const { tokenTypes } = config;

        checkTypes.assert.nonEmptyObject(tokenTypes);

        this.tokenTypes = tokenTypes;
        this.tokenized = null;
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
     * @param {number} lookAhead - Number of tokens to lookahead. Either positive or negative integers are allowed.
     * @param {number} index - Current index in tokens list.
     * @param {typedefs.openaip.OpenairParser.Token[]} tokens - The complete parsed list of tokens.
     * @param {Function[]} [skipTokens] - A list of tokens to skip when doing a look ahead.
     * @returns {boolean}
     */
    isAllowedNextToken(lookAhead, index, tokens, skipTokens) {
        checkTypes.assert.integer(lookAhead);
        checkTypes.assert.integer(index);
        checkTypes.assert.array.of.object(tokens);
        checkTypes.assert.array.of.function(skipTokens);

        const maxLookAhead = tokens.length - 1;
        const allowedTokens = this.getAllowedNextTokens();
        // maximum possible look ahead index
        // get the actual look ahead index
        let lookIndex = index + lookAhead;
        lookIndex = lookIndex < 0 ? 0 : lookIndex;
        let lookAheadToken = tokens[lookIndex];

        if (lookAheadToken === undefined) {
            throw new Error('Index out of bounds.');
        }

        // advance in list and get "next next" token if first "next" token should be skipped, stop at end of list
        while (skipTokens.includes(lookAheadToken.constructor.type) && lookIndex <= maxLookAhead) {
            lookIndex++;
            lookAheadToken = tokens[lookIndex];
        }

        return allowedTokens.includes(lookAheadToken.constructor.type);
    }

    /**
     * @return {string[]}
     */
    getAllowedNextTokens() {
        return [];
    }
}

module.exports = BaseLineToken;
