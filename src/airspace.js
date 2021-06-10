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
const checkTypes = require('check-types');

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
        this._class = null;
        this._coordinates = [];
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
            case AcToken.type:
                this._handleAcToken(token);
                break;
            case AnToken.type:
                this._handleAnToken(token);
                break;
            case AhToken.type:
                this._handleAhToken(token);
                break;
            case AlToken.type:
                this._handleAlToken(token);
                break;
            case DpToken.type:
                this._handleDpToken(token);
                break;
            case VToken.type:
                break;
            case DcToken.type:
                break;
            case DbToken.type:
                break;
            case BlankToken.type:
                this._handleBlankToken(token);
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

    /**
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleAnToken(token) {
        checkTypes.assert.instance(token, AnToken);

        const { metadata } = token.getTokenized();
        const { name } = metadata;

        checkTypes.assert.nonEmptyString(name);

        this._name = name;
    }

    /**
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleAcToken(token) {
        checkTypes.assert.instance(token, AcToken);

        const { metadata } = token.getTokenized();
        const { class: acClass } = metadata;

        checkTypes.assert.nonEmptyString(acClass);

        this._class = acClass;
    }

    /**
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleAhToken(token) {
        checkTypes.assert.instance(token, AhToken);

        const { metadata } = token.getTokenized();
        const { altitude } = metadata;

        checkTypes.assert.nonEmptyObject(altitude);

        this._upperCeiling = altitude;
    }

    /**
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleAlToken(token) {
        checkTypes.assert.instance(token, AlToken);

        const { metadata } = token.getTokenized();
        const { altitude } = metadata;

        checkTypes.assert.nonEmptyObject(altitude);

        this._lowerCeiling = altitude;
    }

    /**
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleDpToken(token) {
        checkTypes.assert.instance(token, DpToken);

        const { metadata } = token.getTokenized();
        const { coordinate } = metadata;

        checkTypes.assert.nonEmptyObject(coordinate);

        const { latitude, longitude } = coordinate;

        checkTypes.assert.number(latitude);
        checkTypes.assert.number(longitude);

        this._coordinates.push({ latitude, longitude });
    }

    /**
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleCommentToken(token) {
        checkTypes.assert.instance(token, CommentToken);
        // do nothing
        return;
    }

    /**
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleBlankToken(token) {
        checkTypes.assert.instance(token, BlankToken);
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
