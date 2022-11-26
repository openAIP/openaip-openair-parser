const CommentToken = require('./tokens/comment-token');
const BlankToken = require('./tokens/blank-token');
const AcToken = require('./tokens/ac-token');
const AnToken = require('./tokens/an-token');
const AhToken = require('./tokens/ah-token');
const AlToken = require('./tokens/al-token');
const DpToken = require('./tokens/dp-token');
const VdToken = require('./tokens/vd-token');
const VxToken = require('./tokens/vx-token');
const VwToken = require('./tokens/vw-token');
const DcToken = require('./tokens/dc-token');
const DbToken = require('./tokens/db-token');
const DaToken = require('./tokens/da-token');
const DyToken = require('./tokens/dy-token');
const EofToken = require('./tokens/eof-token');
const BaseLineToken = require('./tokens/base-line-token');
const checkTypes = require('check-types');
const {
    circle: createCircle,
    lineArc: createArc,
    bearing: calcBearing,
    distance: calcDistance,
    buffer: createBuffer,
    lineString: createLineString,
} = require('@turf/turf');
const Airspace = require('./airspace');
const ParserError = require('./parser-error');
const altitudeUnit = require('./altitude-unit');
const unitConversion = require('./unit-conversion');

class AirspaceFactory {
    /**
     * @param {Object} config
     * @param {number} [config.geometryDetail] - Defines the steps that are used to calculate arcs and circles.
     * Defaults to 50. Higher values mean smoother circles but a higher number of polygon points.
     */
    constructor(config) {
        const { geometryDetail } = config;

        checkTypes.assert.integer(geometryDetail);

        this.geometryDetail = geometryDetail;
        /** @type {typedefs.openaip.OpenairParser.Token[]} */
        this.tokens = null;
        /** @type {Airspace} */
        this.airspace = null;
        /** @type {number|null} */
        this.currentLineNumber = null;
        // set to true if airspace contains tokens other than "skipped, blanks or comment"
        this.hasBuildTokens = false;
        this.isAirway = false;
        // metadata required to build an airspace from a width and airways segment coordinates
        this._airway = {
            // width in nautical miles as read from VW token
            width: null,
            // airway segment coordinates read from DY tokens
            segments: [],
        };
    }

    /**
     * @param {typedefs.openaip.OpenairParser.Token[]} tokens - Complete list of tokens
     * @return {Airspace|null}
     */
    createAirspace(tokens) {
        checkTypes.assert.array.of.instance(tokens, BaseLineToken);

        this.tokens = tokens;
        this.airspace = new Airspace();

        // validate correct token ordering
        this.validateTokenOrder();

        for (const token of tokens) {
            const { lineNumber } = token.getTokenized();
            this.currentLineNumber = lineNumber;

            this.consumeToken(token);
            if (token.isIgnoredToken() === false) {
                this.hasBuildTokens = true;
            }
            this.airspace.consumedTokens.push(token);
        }
        // if airspace is build from airway definitions, an additional step is required that creates the actual
        // airspace's polygon geometry
        if (this.isAirway) {
            this.airspace.coordinates = this.buildCoordinatesFromAirway({
                width: this._airway.width,
                segments: this._airway.segments,
            });
        }
        const airspace = this.airspace;

        this.tokens = null;
        this.airspace = null;

        return this.hasBuildTokens ? airspace : null;
    }

    /**
     * @param {{width: number, segments: Array}} options
     * @returns {Array}
     */
    buildCoordinatesFromAirway({ width, segments }) {
        const airwayPathFeature = createLineString(segments);
        const bufferKm = width * 1.852;
        const airwayPolygonFeature = createBuffer(airwayPathFeature, bufferKm, { units: 'kilometers' });
        const [coordinates] = airwayPolygonFeature.geometry.coordinates;

        return coordinates;
    }

    /**
     * @param {typedefs.openaip.OpenairParser.Token} token
     */
    consumeToken(token) {
        const type = token.getType();
        const { lineNumber } = token.getTokenized();

        switch (type) {
            case CommentToken.type:
                this.handleCommentToken(token);
                break;
            case AcToken.type:
                this.handleAcToken(token);
                break;
            case AnToken.type:
                this.handleAnToken(token);
                break;
            case AhToken.type:
                this.handleAhToken(token);
                break;
            case AlToken.type:
                this.handleAlToken(token);
                break;
            case DpToken.type:
                this.handleDpToken(token);
                break;
            case DyToken.type:
                this.handleDyToken(token);
                break;
            case VdToken.type:
                this.handleVdToken(token);
                break;
            case VxToken.type:
                this.handleVxToken(token);
                break;
            case VwToken.type:
                this.handleVwToken(token);
                break;
            case DcToken.type:
                this.handleDcToken(token);
                break;
            case DbToken.type:
                this.handleDbToken(token);
                break;
            case DaToken.type:
                this.handleDaToken(token);
                break;
            case BlankToken.type:
                this.handleBlankToken(token);
                break;
            case EofToken.type:
                break;
            default:
                throw new ParserError({ lineNumber, errorMessage: `Unknown token '${type}'` });
        }
    }

    /**
     * Validates that tokenized lines have correct order.
     *
     * @return {void}
     */
    validateTokenOrder() {
        let startingAcTagFound = false;
        for (const [index, currentToken] of this.tokens.entries()) {
            const maxLookAheadIndex = this.tokens.length - 1;
            const { lineNumber: currentTokenLineNumber } = currentToken.getTokenized();

            // Make sure the first relevant token is an AC tag. Starting from this AC tag, the token order can be validated
            // only using "look ahead" logic. Otherwise, additional "look behind" must be implemented that would
            // increase processing time.
            if (startingAcTagFound === false && currentToken.isIgnoredToken() === false) {
                if (currentToken.getType() === AcToken.type) {
                    startingAcTagFound = true;
                } else {
                    throw new ParserError({
                        lineNumber: currentTokenLineNumber,
                        errorMessage: `The first token must be of tpye '${
                            AcToken.type
                        }'. Token '${currentToken.getType()}' found on line ${currentTokenLineNumber}.`,
                    });
                }
            }

            // get "next" token index and consider max look ahead
            let lookAheadIndex = index + 1;
            lookAheadIndex = lookAheadIndex > maxLookAheadIndex ? maxLookAheadIndex : lookAheadIndex;

            // dont check last token
            if (index < maxLookAheadIndex) {
                // get next token, skip ignored tokens
                let lookAheadToken = this.tokens[lookAheadIndex];
                while (lookAheadToken.isIgnoredToken() && lookAheadIndex <= maxLookAheadIndex) {
                    lookAheadIndex++;
                    lookAheadToken = this.tokens[lookAheadIndex];
                }

                const isAllowedNextToken = currentToken.isAllowedNextToken(lookAheadToken);
                if (isAllowedNextToken === false) {
                    const { lineNumber: lookAheadTokenLineNumber } = lookAheadToken.getTokenized();

                    throw new ParserError({
                        lineNumber: lookAheadTokenLineNumber,
                        errorMessage: `Token '${currentToken.getType()}' on line ${currentTokenLineNumber} does not allow subsequent token '${lookAheadToken.getType()}' on line ${lookAheadTokenLineNumber}`,
                    });
                }
            }
        }
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleAnToken(token) {
        checkTypes.assert.instance(token, AnToken);

        const { metadata } = token.getTokenized();
        const { name } = metadata;

        this.airspace.name = name;
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleAcToken(token) {
        checkTypes.assert.instance(token, AcToken);

        const { metadata } = token.getTokenized();
        const { class: acClass } = metadata;

        this.airspace.class = acClass;
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleAhToken(token) {
        checkTypes.assert.instance(token, AhToken);

        const { metadata } = token.getTokenized();
        const { altitude } = metadata;

        this.airspace.upperCeiling = altitude;

        // check that defined upper limit is actually higher than defined lower limit
        this.enforceSaneLimits();
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleAlToken(token) {
        checkTypes.assert.instance(token, AlToken);

        const { metadata } = token.getTokenized();
        const { altitude } = metadata;

        this.airspace.lowerCeiling = altitude;

        // check that defined lower limit is actually lower than defined upper limit
        this.enforceSaneLimits();
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleDpToken(token) {
        checkTypes.assert.instance(token, DpToken);

        const { metadata } = token.getTokenized();
        const { coordinate } = metadata;

        checkTypes.assert.nonEmptyObject(coordinate);

        // IMPORTANT subsequently push coordinates
        this.airspace.coordinates.push(this.toArrayLike(coordinate));
    }

    /**
     * Does nothing but required to create an arc.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleVdToken(token) {
        checkTypes.assert.instance(token, VdToken);
    }

    /**
     * Does nothing but required to create an arc.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleVxToken(token) {
        checkTypes.assert.instance(token, VxToken);
    }

    /**
     * Sets airway width in nautical miles.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleVwToken(token) {
        checkTypes.assert.instance(token, VwToken);

        const { metadata } = token.getTokenized();
        const { width } = metadata;

        // IMPORTANT indicate that we are building an airspace from airway definition
        this.isAirway = true;
        this._airway.width = width;
    }

    /**
     * Sets airway segment.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleDyToken(token) {
        checkTypes.assert.instance(token, DyToken);

        const { metadata } = token.getTokenized();
        const { coordinate } = metadata;

        checkTypes.assert.nonEmptyObject(coordinate);

        // IMPORTANT subsequently push airway segment coordinates
        this._airway.segments.push(this.toArrayLike(coordinate));
    }

    /**
     * Creates a circle geometry from the last VToken coordinate and a DcToken radius.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleDcToken(token) {
        checkTypes.assert.instance(token, DcToken);

        const { lineNumber, metadata } = token.getTokenized();
        const { radius } = metadata;

        const precedingVxToken = this.getNextToken(token, VxToken.type, false);
        if (precedingVxToken === null) {
            throw new ParserError({ lineNumber, errorMessage: 'Preceding VX token not found.' });
        }
        // to create a circle, the center point coordinate from the previous VToken is required
        const { metadata: vxTokenMetadata } = precedingVxToken.getTokenized();
        const { coordinate } = vxTokenMetadata;

        // convert radius in NM to meters
        const radiusM = radius * 1852;

        const { geometry } = createCircle(this.toArrayLike(coordinate), radiusM, {
            steps: this.geometryDetail,
            units: 'meters',
        });
        const [coordinates] = geometry.coordinates;
        // IMPORTANT set coordinates => calculated circle coordinates are the only coordinates
        this.airspace.coordinates = coordinates;
    }

    /**
     * Creates an arc geometry from the last VToken coordinate and a DbToken endpoint coordinates.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleDbToken(token) {
        checkTypes.assert.instance(token, DbToken);

        const { lineNumber } = token.getTokenized();
        const { centerCoordinate, startCoordinate, endCoordinate, clockwise } = this.getBuildDbArcCoordinates(token);

        // calculate line arc

        const centerCoord = this.toArrayLike(centerCoordinate);
        let startCoord;
        let endCoord;
        if (clockwise) {
            startCoord = this.toArrayLike(startCoordinate);
            endCoord = this.toArrayLike(endCoordinate);
        } else {
            // flip coordinates
            endCoord = this.toArrayLike(startCoordinate);
            startCoord = this.toArrayLike(endCoordinate);
        }

        // get required bearings
        const startBearing = calcBearing(centerCoord, startCoord);
        const endBearing = calcBearing(centerCoord, endCoord);
        // get the radius in kilometers
        const radiusKm = calcDistance(centerCoord, startCoord, { units: 'kilometers' });
        if (radiusKm == null || radiusKm === 0) {
            throw new ParserError({
                lineNumber,
                errorMessage: 'Arc definition is invalid. Calculated arc radius is 0.',
            });
        }
        // calculate the line arc
        const { geometry } = createArc(centerCoord, radiusKm, startBearing, endBearing, {
            steps: this.geometryDetail,
            // units can't be set => will result in error "options is invalid" => bug?
        });

        // IMPORTANT if center point is not correctly defined, arcs will almost always self-intersect because the
        //  DP start-/endpoint will NOT match the calculated arc start-/endpoint. To avoid self-intersections, replace last arc start-/endpoint
        //  with the originally defined start-/endpoint. This could be done better but currently I have no idea how...
        geometry.coordinates.shift();
        geometry.coordinates.pop();
        geometry.coordinates = [startCoord, ...geometry.coordinates, endCoord];

        // if counter-clockwise, reverse coordinate list order
        const arcCoordinates = clockwise ? geometry.coordinates : geometry.coordinates.reverse();
        this.airspace.coordinates = this.airspace.coordinates.concat(arcCoordinates);
    }

    /**
     * Creates an arc geometry from the last VToken coordinate and a DaToken that contains arc definition as
     * radius, angleStart and angleEnd.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleDaToken(token) {
        checkTypes.assert.instance(token, DaToken);

        const { lineNumber, metadata: metadataDaToken } = token.getTokenized();
        const { radius, startBearing, endBearing } = metadataDaToken.arcDef;
        let angleStart = startBearing;
        let angleEnd = endBearing;

        // by default, arcs are defined clockwise and usually no VD token is present
        let clockwise = true;
        // get the VdToken => is optional (clockwise) and may not be present but is required for counter-clockwise arcs
        const vdToken = this.getNextToken(token, VdToken.type, false);
        if (vdToken) {
            clockwise = vdToken.getTokenized().metadata.clockwise;
        }

        // if counter-clockwise, flip start/end bearing
        if (clockwise === false) {
            angleStart = endBearing;
            angleEnd = startBearing;
        }

        // get preceding VxToken => defines the arc center
        const vxToken = this.getNextToken(token, VxToken.type, false);
        if (vxToken === null) {
            throw new ParserError({ lineNumber, errorMessage: 'Preceding VX token not found.' });
        }
        const { metadata: metadataVxToken } = vxToken.getTokenized();
        const { coordinate: vxTokenCoordinate } = metadataVxToken;

        const centerCoord = this.toArrayLike(vxTokenCoordinate);
        // get the radius in kilometers
        const radiusKm = radius * 1.852;
        // calculate the line arc
        const { geometry } = createArc(centerCoord, radiusKm, angleStart, angleEnd, {
            steps: this.geometryDetail,
            // units can't be set => will result in error "options is invalid" => bug?
        });

        // if counter-clockwise, reverse coordinate list order
        const arcCoordinates = clockwise ? geometry.coordinates : geometry.coordinates.reverse();
        this.airspace.coordinates = this.airspace.coordinates.concat(arcCoordinates);
    }

    /**
     * @param {typedefs.openaip.OpenairParser.Token} token - Must be a DbToken!
     * @return {{centerCoordinate: Array, startCoordinate: Array, endCoordinate: Array, clockwise: boolean}}
     * @private
     */
    getBuildDbArcCoordinates(token) {
        checkTypes.assert.instance(token, DbToken);

        // Current "token" is the DbToken => defines arc start/end coordinates
        const { lineNumber, metadata: metadataDbToken } = token.getTokenized();
        const { coordinates: dbTokenCoordinates } = metadataDbToken;
        const [dbTokenStartCoordinate, dbTokenEndCoordinate] = dbTokenCoordinates;

        // by default, arcs are defined clockwise and usually no VD token is present
        let clockwise = true;
        // get the VdToken => is optional (clockwise) and may not be present but is required for counter-clockwise arcs
        const vdToken = this.getNextToken(token, VdToken.type, false);
        if (vdToken) {
            clockwise = vdToken.getTokenized().metadata.clockwise;
        }

        // get preceding VxToken => defines the arc center
        const vxToken = this.getNextToken(token, VxToken.type, false);
        if (vxToken === null) {
            throw new ParserError({ lineNumber, errorMessage: 'Preceding VX token not found.' });
        }
        const { metadata: metadataVxToken } = vxToken.getTokenized();
        const { coordinate: vxTokenCoordinate } = metadataVxToken;

        return {
            centerCoordinate: vxTokenCoordinate,
            startCoordinate: dbTokenStartCoordinate,
            endCoordinate: dbTokenEndCoordinate,
            clockwise,
        };
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleCommentToken(token) {
        checkTypes.assert.instance(token, CommentToken);
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    handleBlankToken(token) {
        checkTypes.assert.instance(token, BlankToken);
    }

    /**
     * @param {Object} coordinate
     * @return {number[]}
     * @private
     */
    toArrayLike(coordinate) {
        return [coordinate.getLongitude(), coordinate.getLatitude()];
    }

    /**
     * Traverses up the list of "consumed tokens" from the token until a token with the specified type is found.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token - Currently consumed token
     * @param {string} tokenType - Token type to search for
     * @param {boolean} [lookAhead] - If true, searches for NEXT token in list with specified type. If false, searches preceding token.
     * @return {typedefs.openaip.OpenairParser.Token|null}
     * @private
     */
    getNextToken(token, tokenType, lookAhead = true) {
        // get index of current token in tokens list
        let currentIndex = this.tokens.findIndex((value) => value === token);

        if (lookAhead) {
            for (currentIndex; currentIndex <= this.tokens.length - 1; currentIndex++) {
                const nextToken = this.tokens[currentIndex];

                if (nextToken.getType() === tokenType) {
                    return nextToken;
                }
            }
        } else {
            for (currentIndex; currentIndex >= 0; currentIndex--) {
                const nextToken = this.tokens[currentIndex];

                if (nextToken.getType() === tokenType) {
                    return nextToken;
                }
            }
        }

        return null;
    }

    /**
     * Helper that converts FL into FEET. Simplified value to be expected as return value, will not
     * be sufficient for very few edge cases.
     *
     * @param ceiling
     * @returns {{unit: string, value, referenceDatum: string}}
     */
    flToFeet(ceiling) {
        let { value, unit, referenceDatum } = ceiling;

        if (unit === 'FL') {
            value *= 100;
            unit = 'FT';
            referenceDatum = 'MSL';
        }

        return { value, unit, referenceDatum };
    }

    enforceSaneLimits() {
        if (this.airspace.lowerCeiling && this.airspace.upperCeiling) {
            // IMPORTANT "feeted" flight level ceilings must be converted to configured target unit before comparing if specified
            const feeted = function (ceiling) {
                const feeted = ceiling;
                const { unit, value } = ceiling;

                switch (unit) {
                    case altitudeUnit.m:
                        feeted.value = unitConversion.metersToFeet(value);
                        feeted.unit = altitudeUnit.ft;
                        break;
                    case altitudeUnit.ft:
                    default:
                    // nothing to do
                }

                return feeted;
            };
            const compareUpper = feeted(this.flToFeet(this.airspace.upperCeiling));
            const compareLower = feeted(this.flToFeet(this.airspace.lowerCeiling));

            if (compareLower.value > compareUpper.value) {
                throw new ParserError({
                    lineNumber: this.currentLineNumber,
                    errorMessage: 'Lower limit must be less than upper limit',
                });
            }
        }
    }
}

module.exports = AirspaceFactory;
