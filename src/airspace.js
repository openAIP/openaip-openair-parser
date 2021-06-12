const CommentToken = require('./tokens/comment-token');
const BlankToken = require('./tokens/blank-token');
const AcToken = require('./tokens/ac-token');
const AnToken = require('./tokens/an-token');
const AhToken = require('./tokens/ah-token');
const AlToken = require('./tokens/al-token');
const DpToken = require('./tokens/dp-token');
const VdToken = require('./tokens/vd-token');
const VxToken = require('./tokens/vx-token');
const DcToken = require('./tokens/dc-token');
const DbToken = require('./tokens/db-token');
const EofToken = require('./tokens/eof-token');
const checkTypes = require('check-types');
const {
    circle: createCircle,
    polygon: createPolygon,
    feature: createFeature,
    lineArc: createArc,
    bearing: calcBearing,
    distance: calcDistance,
} = require('@turf/turf');
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

        this._keepOriginal = keepOriginal;
        this._geometryDetail = geometryDetail;
        this._isFinalized = false;
        /** @type {typedefs.openaipOpenairParser.Token[]} */
        this._consumedTokens = [];
        /** @type {typedefs.openaipOpenairParser.Token|null} */
        this._lastToken = null;
        this._currentTokenIndex = null;
        // airspace properties
        this._name = null;
        this._class = null;
        this._coordinates = [];
        this._geojson = null;
    }

    static fromTokens(tokens, options) {

    }

    /**
     * @param {typedefs.openaipOpenairParser.Token} token
     * @param {typedefs.openaipOpenairParser.Token[]} tokens - Complete list of tokens
     */
    consumeToken(token, tokens) {
        // get index of current token in tokens list
        this._currentTokenIndex = tokens.findIndex((value) => value === token);

        // if finalized, cannot consume tokens anymore
        if (this._isFinalized) {
            throw new Error('Airspace is already finalized');
        }

        const type = token.getType();
        const { lineNumber } = token.getTokenized();

        switch (type) {
            case CommentToken.type:
                this._handleCommentToken(token, tokens);
                break;
            case AcToken.type:
                this._handleAcToken(token, tokens);
                break;
            case AnToken.type:
                this._handleAnToken(token, tokens);
                break;
            case AhToken.type:
                this._handleAhToken(token, tokens);
                break;
            case AlToken.type:
                this._handleAlToken(token, tokens);
                break;
            case DpToken.type:
                this._handleDpToken(token, tokens);
                break;
            case VdToken.type:
                this._handleVdToken(token, tokens);
                break;
            case VxToken.type:
                this._handleVxToken(token, tokens);
                break;
            case DcToken.type:
                this._handleDcToken(token, tokens);
                break;
            case DbToken.type:
                this._handleDbToken(token, tokens);
                break;
            case BlankToken.type:
                this._handleBlankToken(token, tokens);
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
        if (this._keepOriginal) {
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

        // TODO check that coordinates match second coordinate if lastToken is DbToken

        // IMPORTANT subsequently push coordinates
        this._coordinates.push(this._toArrayLike(coordinate));
    }

    /**
     * Does nothing but required to create an arc.
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleVdToken(token) {
        // do nothing
    }

    /**
     * Does nothing but required to create an arc.
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleVxToken(token) {
        // do nothing
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

        const precedingVxToken = this._getPrecedingToken(VxToken.type);
        if (precedingVxToken === null) {
            throw new Error(`Preceding VX token not found.`);
        }
        // to create a circle, the center point coordinate from the previous VToken is required
        const { metadata: vxTokenMetadata } = precedingVxToken.getTokenized();
        const { coordinate } = vxTokenMetadata;

        // convert radius in NM to meters
        const radiusM = radius * 1852;

        const { geometry } = createCircle(this._toArrayLike(coordinate), radiusM, {
            steps: this._geometryDetail,
            units: 'meters',
        });
        const [coordinates] = geometry.coordinates;
        // IMPORTANT set coordinates => calculated circle coordinates are the only coordinates
        this._coordinates = coordinates;
    }

    /**
     * Creates an arc geometry from the last VToken coordinate and a DbToken endpoint coordinates.
     *
     * @param {typedefs.openaipOpenairParser.Token} token
     * @return {void}
     * @private
     */
    _handleDbToken(token) {
        const { centerCoordinate, startCoordinate, endCoordinate, clockwise } = this._getBuildArcCoordinates(token);

        // calculate line arc

        const centerCoord = this._toArrayLike(centerCoordinate);
        const startCoord = this._toArrayLike(startCoordinate);
        const endCoord = this._toArrayLike(endCoordinate);

        // get required bearings
        const startBearing = calcBearing(centerCoord, startCoord);
        const endBearing = calcBearing(centerCoord, endCoord);
        // get the radius in meters
        const radiusM = calcDistance(centerCoord, startCoord, { units: 'kilometers' });
        // calculate the line arc
        const { geometry } = createArc(centerCoord, radiusM, startBearing, endBearing, {
            steps: this._geometryDetail,
            // units can't be set => will result in error "options is invalid" => bug?
        });
        // IMPORTANT subsequently push coordinates
        this._coordinates = this._coordinates.concat(geometry.coordinates);
    }

    /**
     *
     * @param {typedefs.openaipOpenairParser.Token} token - Must be a DbToken!
     * @return {{centerCoordinate: Array, startCoordinate: Array, endCoordinate: Array clockwise: boolean}}
     * @private
     */
    _getBuildArcCoordinates(token) {
        if (token.getType() !== DbToken.type) {
            throw new Error('Token must be a DB token');
        }

        // Current "token" is the DbToken => defines arc start/end coordinates
        const { metadata: metadataDbToken } = token.getTokenized();
        const { coordinates: dbTokenCoordinates } = metadataDbToken;
        const [dbTokenStartCoordinate, dbTokenEndCoordinate] = dbTokenCoordinates;

        // by default, arcs are defined clockwise and usally no VD token is present
        let clockwise = true;
        // get the VdToken => is optional (clockwise) and may not be present but is required for counter-clockwise arcs
        const vdToken = this._getPrecedingToken(VdToken.type);
        if (vdToken) {
            clockwise = vdToken.getTokenized().metadata.clockwise;
        }

        // get preceding VxToken => defines the arc center
        const vxToken = this._getPrecedingToken(VxToken.type);
        if (vxToken === null) {
            throw new Error(`Preceding VX token not found.`);
        }
        const { metadata: metadataVxToken } = vxToken.getTokenized();
        const { coordinate: vxTokenCoordinate } = metadataVxToken;

        // get preceding DpToken to verify that arc start point matches
        const precedingDpToken = this._getPrecedingToken(DpToken.type);
        if (precedingDpToken === null) {
            throw new Error(`Preceding DP token not found.`);
        }
        const { metadata: metadataPrecedingDpToken } = precedingDpToken.getTokenized();
        const { coordinate: precedingDpTokenCoordinate } = metadataPrecedingDpToken;

        // get net DpToken to verify that arc end point matches
        const nextDpToken = this._getNextToken(DpToken.type, idx);
        if (nextDpToken === null) {
            throw new Error(`Next DP token not found.`);
        }
        const { metadata: metadataNextDpToken } = precedingDpToken.getTokenized();
        const { coordinate: nextDpTokenCoordinate } = metadataNextDpToken;

        // enforce that preceding DP coordinate matches arc start coordinate
        if (
            this._toArrayLike(precedingDpTokenCoordinate).toString() !==
            this._toArrayLike(dbTokenStartCoordinate).toString()
        ) {
            const { line, lineNumber } = precedingDpToken.getTokenized();
            throw new SyntaxError(`Coordinates '${line}' at line ${lineNumber} must match the arc start coordinate`);
        }

        // enforce that preceding DP coordinate matches arc start coordinate
        if (
            this._toArrayLike(nextDpTokenCoordinate).toString() !== this._toArrayLike(dbTokenEndCoordinate).toString()
        ) {
            const { line, lineNumber } = nextDpToken.getTokenized();
            throw new SyntaxError(`Coordinates '${line}' at line ${lineNumber} must match the arc end coordinate`);
        }

        return {
            centerCoordinate: vxTokenCoordinate,
            startCoordinate: dbTokenStartCoordinate,
            endCoordinate: dbTokenEndCoordinate,
            clockwise: true,
        };
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
     * @param {Object} coordinate
     * @return {number[]}
     * @private
     */
    _toArrayLike(coordinate) {
        return [coordinate.getLongitude(), coordinate.getLatitude()];
    }

    /**
     * Traverses up the list of "consumed tokens" from the LAST item until a token with the specified type is found.
     *
     * @param {string} tokenType
     * @return {typedefs.openaipOpenairParser.Token|null}
     * @private
     */
    _getPrecedingToken(tokenType) {
        for (let i = this._consumedTokens.length - 1; i >= 0; i--) {
            const nextToken = this._consumedTokens[i];

            if (nextToken.getType() === tokenType) {
                return nextToken;
            }
        }

        return null;
    }

    /**
     * Traverses up the list of "consumed tokens" from the LAST item until a token with the specified type is found.
     *
     * @param {string} tokenType
     * @param {number} startIndex - Index in array to start search from. Defaults to 0.
     * @return {typedefs.openaipOpenairParser.Token|null}
     * @private
     */
    _getNextToken(tokenType, startIndex = 0) {
        for (startIndex; startIndex <= this._consumedTokens.length - 1; startIndex++) {
            const nextToken = this._consumedTokens[startIndex];

            if (nextToken.getType() === tokenType) {
                return nextToken;
            }
        }

        return null;
    }
}

module.exports = Airspace;
