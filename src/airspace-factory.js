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
const BaseLineToken = require('./tokens/base-line-token');
const checkTypes = require('check-types');
const {
    circle: createCircle,
    lineArc: createArc,
    bearing: calcBearing,
    distance: calcDistance,
} = require('@turf/turf');
const Airspace = require('./airspace');

/**
 * @typedef typedefs.openaipOpenairParser.AirspaceFactoryConfig
 * @type Object
 * @property {number} [geometryDetail] - Defines the steps that are used to calculate arcs and circles. Defaults to 50. Higher values mean smoother circles but a higher number of polygon points.
 * @property {boolean} [keepOriginal] - If true, the returned GeoJson features will contain the original openAIR airspace block definitions. Defaults to false.
 */

class AirspaceFactory {
    /**
     * @param {typedefs.openaipOpenairParser.AirspaceFactoryConfig} config
     */
    constructor(config) {
        const { geometryDetail, keepOriginal } = config;

        checkTypes.assert.integer(geometryDetail);
        checkTypes.assert.boolean(keepOriginal);

        this._keepOriginal = keepOriginal;
        this._geometryDetail = geometryDetail;

        /** @type {BaseLineToken[]} */
        this._tokens = null;
        /** @type {Airspace} */
        this._airspace = null;
    }

    /**
     * @param {BaseLineToken[]} tokens - Complete list of tokens
     * @return {Airspace}
     */
    createAirspace(tokens) {
        checkTypes.assert.array.of.instance(tokens, BaseLineToken);

        this._tokens = tokens;
        this._airspace = new Airspace();

        for (const token of tokens) {
            this._consumeToken(token);
        }
        const airspace = this._airspace;

        this._tokens = null;
        this._airspace = null;

        return airspace;
    }

    /**
     * @param {BaseLineToken} token
     */
    _consumeToken(token) {
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
            case VdToken.type:
                this._handleVdToken(token);
                break;
            case VxToken.type:
                this._handleVxToken(token);
                break;
            case DcToken.type:
                this._handleDcToken(token);
                break;
            case DbToken.type:
                this._handleDbToken(token);
                break;
            case BlankToken.type:
                this._handleBlankToken(token);
                break;
            case EofToken.type:
                break;
            default:
                throw new SyntaxError(`Unknown token '${type}' at line ${lineNumber}`);
        }
    }

    /**
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleAnToken(token) {
        checkTypes.assert.instance(token, AnToken);

        const { metadata } = token.getTokenized();
        const { name } = metadata;

        this._airspace.name = name;
    }

    /**
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleAcToken(token) {
        checkTypes.assert.instance(token, AcToken);

        const { metadata } = token.getTokenized();
        const { class: acClass } = metadata;

        this._airspace.class = acClass;
    }

    /**
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleAhToken(token) {
        checkTypes.assert.instance(token, AhToken);

        const { metadata } = token.getTokenized();
        const { altitude } = metadata;

        this._airspace.upperCeiling = altitude;
    }

    /**
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleAlToken(token) {
        checkTypes.assert.instance(token, AlToken);

        const { metadata } = token.getTokenized();
        const { altitude } = metadata;

        this._airspace.lowerCeiling = altitude;
    }

    /**
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleDpToken(token) {
        checkTypes.assert.instance(token, DpToken);

        const { metadata } = token.getTokenized();
        const { coordinate } = metadata;

        checkTypes.assert.nonEmptyObject(coordinate);

        // IMPORTANT subsequently push coordinates
        this._airspace.coordinates.push(this._toArrayLike(coordinate));
    }

    /**
     * Does nothing but required to create an arc.
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleVdToken(token) {
        checkTypes.assert.instance(token, VdToken);
    }

    /**
     * Does nothing but required to create an arc.
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleVxToken(token) {
        checkTypes.assert.instance(token, VxToken);
    }

    /**
     * Creates a circle geometry from the last VToken coordinate and a DcToken radius.
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleDcToken(token) {
        checkTypes.assert.instance(token, DcToken);

        const { metadata } = token.getTokenized();
        const { radius } = metadata;

        const precedingVxToken = this._getNextToken(token, VxToken.type, false);
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
        this._airspace.coordinates = coordinates;
    }

    /**
     * Creates an arc geometry from the last VToken coordinate and a DbToken endpoint coordinates.
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleDbToken(token) {
        const { centerCoordinate, startCoordinate, endCoordinate, clockwise } = this._getBuildArcCoordinates(token);

        // calculate line arc

        const centerCoord = this._toArrayLike(centerCoordinate);
        let startCoord;
        let endCoord;
        if (clockwise) {
            startCoord = this._toArrayLike(startCoordinate);
            endCoord = this._toArrayLike(endCoordinate);
        } else {
            // flip coordinates
            endCoord = this._toArrayLike(startCoordinate);
            startCoord = this._toArrayLike(endCoordinate);
        }

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

        // if counter-clockwise, reverse coordinate list order
        const arcCoordinates = clockwise ? geometry.coordinates : geometry.coordinates.reverse();
        this._airspace.coordinates = this._airspace.coordinates.concat(arcCoordinates);
    }

    /**
     *
     * @param {BaseLineToken} token - Must be a DbToken!
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

        // by default, arcs are defined clockwise and usually no VD token is present
        let clockwise = true;
        // get the VdToken => is optional (clockwise) and may not be present but is required for counter-clockwise arcs
        const vdToken = this._getNextToken(token, VdToken.type, false);
        if (vdToken) {
            clockwise = vdToken.getTokenized().metadata.clockwise;
        }

        // get preceding VxToken => defines the arc center
        const vxToken = this._getNextToken(token, VxToken.type, false);
        if (vxToken === null) {
            throw new Error(`Preceding VX token not found.`);
        }
        const { metadata: metadataVxToken } = vxToken.getTokenized();
        const { coordinate: vxTokenCoordinate } = metadataVxToken;

        // get preceding DpToken to verify that arc start point matches
        const precedingDpToken = this._getNextToken(token, DpToken.type, false);
        if (precedingDpToken === null) {
            throw new Error(`Preceding DP token not found.`);
        }
        const { metadata: metadataPrecedingDpToken } = precedingDpToken.getTokenized();
        const { coordinate: precedingDpTokenCoordinate } = metadataPrecedingDpToken;

        // get net DpToken to verify that arc end point matches
        const nextDpToken = this._getNextToken(token, DpToken.type, true);
        if (nextDpToken === null) {
            throw new Error(`Next DP token not found.`);
        }
        const { metadata: metadataNextDpToken } = nextDpToken.getTokenized();
        const { coordinate: nextDpTokenCoordinate } = metadataNextDpToken;

        // enforce that preceding DP coordinate matches arc start coordinate
        if (
            this._toArrayLike(precedingDpTokenCoordinate).toString() !==
            this._toArrayLike(dbTokenStartCoordinate).toString()
        ) {
            const { line: startpointLine, lineNumber: startpointLineNumber } = token.getTokenized();
            const { line, lineNumber } = precedingDpToken.getTokenized();
            throw new SyntaxError(
                `Coordinates '${line}' at line ${lineNumber} must match the arc start coordinate '${startpointLine}' at line ${startpointLineNumber}`
            );
        }

        // enforce that preceding DP coordinate matches arc start coordinate
        if (
            this._toArrayLike(nextDpTokenCoordinate).toString() !== this._toArrayLike(dbTokenEndCoordinate).toString()
        ) {
            const { line: endpointLine, lineNumber: endpointLineNumber } = token.getTokenized();
            const { line, lineNumber } = nextDpToken.getTokenized();

            throw new SyntaxError(
                `Coordinates '${line}' at line ${lineNumber} must match the arc end coordinate '${endpointLine}' at line ${endpointLineNumber}`
            );
        }

        return {
            centerCoordinate: vxTokenCoordinate,
            startCoordinate: dbTokenStartCoordinate,
            endCoordinate: dbTokenEndCoordinate,
            clockwise,
        };
    }

    /**
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleCommentToken(token) {
        checkTypes.assert.instance(token, CommentToken);
    }

    /**
     *
     * @param {BaseLineToken} token
     * @return {void}
     * @private
     */
    _handleBlankToken(token) {
        checkTypes.assert.instance(token, BlankToken);
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
     * Traverses up the list of "consumed tokens" from the token until a token with the specified type is found.
     *
     * @param {BaseLineToken} token - Currently consumed token
     * @param {string} tokenType - Token type to search for
     * @param {boolean} [lookAhead] - If true, searches for NEXT token in list with specified type. If false, searches preceding token.
     * @return {BaseLineToken|null}
     * @private
     */
    _getNextToken(token, tokenType, lookAhead = true) {
        // get index of current token in tokens list
        let currentIndex = this._tokens.findIndex((value) => value === token);

        if (lookAhead) {
            for (currentIndex; currentIndex <= this._tokens.length - 1; currentIndex++) {
                const nextToken = this._tokens[currentIndex];

                if (nextToken.getType() === tokenType) {
                    return nextToken;
                }
            }
        } else {
            for (currentIndex; currentIndex >= 0; currentIndex--) {
                const nextToken = this._tokens[currentIndex];

                if (nextToken.getType() === tokenType) {
                    return nextToken;
                }
            }
        }

        return null;
    }
}

module.exports = AirspaceFactory;
