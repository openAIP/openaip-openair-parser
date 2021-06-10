const CommentToken = require('./tokens/comment-token');
const BlankToken = require('./tokens/blank-token');
const AcToken = require('./tokens/ac-token');
const AnToken = require('./tokens/an-token');
const AhToken = require('./tokens/ah-token');
const AlToken = require('./tokens/al-token');
const DpToken = require('./tokens/dp-token');
const VToken = require('./tokens/v-token');
const DcToken = require('./tokens/dc-token');
const DbToken = require('./tokens/db-token');
const EofToken = require('./tokens/eof-token');

/**
 * @typedef typedefs.openaipOpenairParser.Airspace
 * @function consumeToken - Consumes a token that is required to build the airspace instance.
 */

class Airspace {
    constructor() {
        /** @type {typedefs.openaipOpenairParser.Token[]} */
        this._consumedTokens = [];
        /** @type {typedefs.openaipOpenairParser.Token|null} */
        this._lastToken = null;
        // airspace properties
        this._name = null;
    }

    /**
     * @param {typedefs.openaipOpenairParser.Token} token
     */
    consumeToken(token) {
        this._enforceIsAllowedToken(token);

        const type = token.getType();
        const { lineNumber } = token.getTokenized();

        switch (type) {
            case CommentToken.type:
                this._handleCommentToken(token);
                break;
            case BlankToken.type:
                this._handleBlankToken(token);
                break;
            case AcToken.type:
                break;
            case AnToken.type:
                break;
            case AhToken.type:
                break;
            case AlToken.type:
                break;
            case DpToken.type:
                break;
            case VToken.type:
                break;
            case DcToken.type:
                break;
            case DbToken.type:
                break;
            case EofToken.type:
                break;
            default:
                throw new SyntaxError(`Unknown token '${type}' at line ${lineNumber}`);
        }

        // keep the consumed token
        this._consumedTokens.push(token);
        this._lastToken = token;
    }

    _handleCommentToken(token) {
        return;
    }

    _handleBlankToken(token) {
        return;
    }

    /**
     * Check that given token is allowed as "next token".
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _enforceIsAllowedToken(token) {
        // check that new token is allowed
        if (this._lastToken != null && this._lastToken.isAllowedNextToken(token) === false) {
            const { lineNumber } = token.getTokenized();

            throw new SyntaxError(`Unexpected token ${token.getType()} at line ${lineNumber}`);
        }
    }
}

module.exports = Airspace;
