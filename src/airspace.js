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
const { circle: createCircle, polygon: createPolygon, feature: createFeature } = require('@turf/turf');
const uuid = require('uuid');

/**
 * @typedef typedefs.openaipOpenairParser.AirspaceConfig
 * @type Object
 * @property {number} [geometryDetail] - Defines the steps that are used to calculate arcs and circles. Defaults to 50. Higher values mean smoother circles but a higher number of polygon points.
 * @property {boolean} [keepOriginal] - If true, the returned GeoJson features will contain the original openAIR airspace block definitions. Defaults to false.
 */

/**
 * @typedef typedefs.openaipOpenairParser.Airspace
 * @type Object
 * @function consumeToken - Consumes a token that is required to build the airspace instance.
 * @function finalize - Finalizes the airspace and creates a GeoJson representation.
 * @function toGeoJson - Returns the finalized GeoJson representation.
 */

class Airspace {
    /**
     * @param {typedefs.openaipOpenairParser.AirspaceConfig} config
     */
    constructor(config) {
        const { geometryDetail, keepOriginal } = config;
        checkTypes.assert.integer(geometryDetail);
        checkTypes.assert.boolean(keepOriginal);

        this._isFinalized = false;
        this._config = config;
        /** @type {typedefs.openaipOpenairParser.Token[]} */
        this._consumedTokens = [];
        /** @type {typedefs.openaipOpenairParser.Token|null} */
        this._lastToken = null;
        // airspace properties
        this._name = null;
        this._class = null;
        this._coordinates = [];
        this._geojson = null;
    }

    /**
     * @param {typedefs.openaipOpenairParser.Token} token
     */
    consumeToken(token) {
        // if finalized, cannot consume tokens anymore
        if (this._isFinalized) {
            throw new Error('Airspace is already finalized');
        }
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
                this._handleVToken(token);
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
     * Internally creates a GeoJSOn representation of the airspace. Will also lock the airspace from editing.
     * Calls to "consumeToken" after finalization will result in an error.
     */
    finalize() {
        const properties = {
            name: this._name,
            class: this._class,
            upperCeiling: this._upperCeiling,
            lowerCeiling: this._lowerCeiling,
        };
        // inject the original openAIR content if configured
        if (this._config.keepOriginal) {
            properties.openair = [];
            for (const token of this._consumedTokens) {
                const { line, lineNumber } = token.getTokenized();
                properties.openair.push({ line, lineNumber });
            }
        }
        const polygon = createPolygon([this._coordinates]);
        this._geojson = createFeature(polygon.geometry, properties, { id: uuid.v4() });

        // finalize the airspace build which will prevent further manipulations
        this._isFinalized = true;

        return this;
    }

    /**
     * Returns a GeoJSON feature representation of the parsed openAIR airspace.
     *
     * @return {Object}
     */
    asGeoJson() {
        if (this._isFinalized === false) throw Error('Airspace not finalized');

        return this._geojson;
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

        this._coordinates.push([latitude, longitude]);
    }

    /**
     * Only checks if metadata is available. To create a circle, the next token must be a DcToken.
     * Creation of the circle geometry is handled in the DcToken handler.
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleVToken(token) {
        checkTypes.assert.instance(token, VToken);

        const { metadata } = token.getTokenized();
        const { coordinate } = metadata;

        checkTypes.assert.nonEmptyObject(coordinate);

        const { latitude, longitude } = coordinate;

        checkTypes.assert.number(latitude);
        checkTypes.assert.number(longitude);
    }

    /**
     * Creates a circle geometry from the last VToken coordinate and a DcToken radius.
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleDcToken(token) {
        checkTypes.assert.instance(token, DcToken);

        const { metadata } = token.getTokenized();
        const { radius } = metadata;

        checkTypes.assert.number(radius);

        // to create a circle, the center point coordinate from the previous VToken is required
        const { metadata: vtokenMetadata } = this._lastToken.getTokenized();
        const { coordinate } = vtokenMetadata;
        const { latitude, longitude } = coordinate;

        // convert radius in NM to meters
        const radiusM = radius * 1852;

        const { geometry } = createCircle([latitude, longitude], radiusM, { steps: this._config.geometryDetail });
        this._coordinates = geometry.coordinates;
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
