import {
    bearing as calcBearing,
    distance as calcDistance,
    lineArc as createArc,
    buffer as createBuffer,
    circle as createCircle,
    lineString as createLineString,
} from '@turf/turf';
import type { Feature, LineString, Polygon, Position } from 'geojson';
import { validate } from 'uuid';
import { z } from 'zod';
import { Airspace } from './airspace.js';
import { AltitudeUnitEnum, type AltitudeUnit } from './altitude-unit.enum.js';
import { ParserError } from './parser-error';
import { AbstractLineToken, type IToken, type Tokenized } from './tokens/abstract-line-token.js';
import { AcToken } from './tokens/ac-token.js';
import { AfToken } from './tokens/af-token.js';
import { AgToken } from './tokens/ag-token.js';
import { AhToken } from './tokens/ah-token.js';
import { AiToken } from './tokens/ai-token.js';
import { AlToken } from './tokens/al-token.js';
import { AnToken } from './tokens/an-token.js';
import { AyToken } from './tokens/ay-token.js';
import { BlankToken } from './tokens/blank-token.js';
import { CommentToken } from './tokens/comment-token.js';
import { DaToken } from './tokens/da-token.js';
import { DbToken } from './tokens/db-token.js';
import { DcToken } from './tokens/dc-token.js';
import { DpToken } from './tokens/dp-token.js';
import { DyToken } from './tokens/dy-token.js';
import { EofToken } from './tokens/eof-token.js';
import type { TokenType } from './tokens/token-type.enum.js';
import { TpToken } from './tokens/tp-token.js';
import { VdToken } from './tokens/vd-token.js';
import { VwToken } from './tokens/vw-token.js';
import { VxToken } from './tokens/vx-token.js';
import { feetToMeters, metersToFeet } from './unit-conversion.js';
import { validateSchema } from './validate-schema.js';

export type Config = {
    geometryDetail: number;
    extendedFormat: boolean;
};

export const ConfigSchema = z
    .object({
        geometryDetail: z.number().int().min(50),
        extendedFormat: z.boolean(),
    })
    .strict()
    .describe('ConfigSchema');

type AirwayStructure = {
    width: number | null;
    segments: Position[];
};

export class AirspaceFactory {
    protected _geometryDetail: number;
    protected _extendedFormat: boolean;
    protected _tokens: IToken[] = [];
    protected _airspace: Airspace;
    protected _currentLineNumber: number | undefined = undefined;
    // set to true if airspace contains tokens other than "skipped, blanks or comment"
    protected _hasBuildTokens: boolean = false;
    protected _isAirway: boolean = false;
    protected _airway: AirwayStructure | undefined = undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { geometryDetail, extendedFormat } = config;

        this._airspace = new Airspace();
        this._geometryDetail = geometryDetail;
        this._extendedFormat = extendedFormat;
    }

    createAirspace(tokens: IToken[]): Airspace | undefined {
        validateSchema(tokens, z.array(z.instanceof(AbstractLineToken)), { assert: true, name: 'tokens' });

        this.reset();
        this._tokens = tokens;
        this._airspace = new Airspace();
        // validate all tokens are correct and that we are able to build an airspace from them
        this.validateTokens();

        for (const token of tokens) {
            const { lineNumber } = token.tokenized as Tokenized;
            this._currentLineNumber = lineNumber;
            // process the next token
            this.consumeToken(token);
            // if the previously processed token is not an ignored token, set the "hasBuildTokens" flag
            if (token.isIgnoredToken() === false) {
                this._hasBuildTokens = true;
            }
            this._airspace.consumedTokens.push(token);
        }
        // if airspace is build from airway definitions, an additional step is required that creates the actual
        // airspace's polygon geometry
        if (this._isAirway === true) {
            if (this._airway == null) {
                throw new ParserError({
                    lineNumber: this._currentLineNumber,
                    errorMessage: 'Airway definition is missing required tokens.',
                });
            }
            const airwayWidth = this._airway.width;
            const airwaySegments = this._airway.segments;
            if (airwayWidth == null || airwaySegments.length === 0) {
                throw new ParserError({
                    lineNumber: this._currentLineNumber,
                    errorMessage: 'Airway definition is missing required tokens.',
                });
            }
            this._airspace.coordinates = this.buildCoordinatesFromAirway({
                width: airwayWidth,
                segments: airwaySegments,
            });
        }
        const airspace = this._airspace;

        return this._hasBuildTokens ? airspace : undefined;
    }

    /**
     * Builds a coordinates list from an airway definition. The coordinate list can then be used to
     * create a polygon geometry.
     */
    protected buildCoordinatesFromAirway(ctx: { width: number; segments: Position[] }): Position[] {
        const { width, segments } = ctx;
        const airwayPathFeature = createLineString(segments);
        const bufferKm = width * 1.852;
        const airwayPolygon = createBuffer(airwayPathFeature, bufferKm, { units: 'kilometers' })?.geometry;
        if (airwayPolygon == null) {
            throw new ParserError({
                lineNumber: this._currentLineNumber,
                errorMessage: 'Airway definition is missing required tokens.',
            });
        }
        if (airwayPolygon.type !== 'Polygon') {
            throw new ParserError({
                lineNumber: this._currentLineNumber,
                errorMessage: `Failed to create polygon from airway definition. Invalid geometry.`,
            });
        }

        return (airwayPolygon as Polygon).coordinates.flat();
    }

    protected consumeToken(token: IToken): void {
        const type = token.type;
        const { lineNumber } = token.tokenized as Tokenized;
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
            // extended format tokens
            case AiToken.type:
                this.handleAiToken(token);
                break;
            case AyToken.type:
                this.handleAyToken(token);
                break;
            case AfToken.type:
                this.handleAfToken(token);
                break;
            case AgToken.type:
                this.handleAgToken(token);
                break;
            case TpToken.type:
                this.handleTpToken(token);
                break;
            default:
                throw new ParserError({ lineNumber, errorMessage: `Unknown token '${type}'` });
        }
    }

    /**
     * Runs all required validations on the tokenized lines. Should be run before starting to build
     * an airspace from tokens.
     */
    protected validateTokens(): void {
        this.validateTokenOrder();
        this.validateTokenInventory();
    }

    /**
     * Validates that tokenized lines have correct order. Should be run before "validateTokenInventory".
     */
    protected validateTokenOrder(): void {
        let startingAcTagFound = false;
        // @ts-expect-error downlevel iteration flag required
        for (const [index, currentToken] of this._tokens.entries()) {
            const maxLookAheadIndex = this._tokens.length - 1;
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
                        errorMessage: `The first token must be of type '${
                            AcToken.type
                        }'. Token '${currentToken.getType()}' found on line ${currentTokenLineNumber}.`,
                    });
                }
            }

            // get "next" token index and consider max look ahead
            let lookAheadIndex = index + 1;
            lookAheadIndex = lookAheadIndex > maxLookAheadIndex ? maxLookAheadIndex : lookAheadIndex;

            // don't check last token
            if (index < maxLookAheadIndex) {
                // get next token, skip ignored tokens
                let lookAheadToken = this._tokens[lookAheadIndex];
                while (lookAheadToken.isIgnoredToken() && lookAheadIndex <= maxLookAheadIndex) {
                    lookAheadIndex++;
                    lookAheadToken = this._tokens[lookAheadIndex];
                }

                const isAllowedNextToken = currentToken.isAllowedNextToken(lookAheadToken);
                if (isAllowedNextToken === false) {
                    const { lineNumber: lookAheadTokenLineNumber } = lookAheadToken.tokenized as Tokenized;

                    throw new ParserError({
                        lineNumber: lookAheadTokenLineNumber,
                        errorMessage: `Token '${currentToken.getType()}' on line ${currentTokenLineNumber} does not allow subsequent token '${lookAheadToken.type}' on line ${lookAheadTokenLineNumber}`,
                    });
                }
            }
        }
    }

    /**
     * Validates that all required tokens are present. The logic relies on the fact that the token order
     * has already been checked with "validateTokenOrder". The "validateTokenOrder" method will ensure
     * that the most basic ordering is correct and that there is a geometry section present (which is NOT
     * validated with this method).
     */
    protected validateTokenInventory(): void {
        // tokens that are always required, no matter if "standard" or "extended" format is used
        const requiredTokens = [AcToken.type, AnToken.type, AlToken.type, AhToken.type];
        // if the extended format is used, add the extended format tokens to the required tokens list
        if (this._extendedFormat === true) {
            // AY token is required, all others are optional
            requiredTokens.push(AyToken.type);
        }
        const requiredTokensInventory: TokenType[] = [];
        let definitionBlockStart = null;

        // @ts-expect-error downlevel iteration flag required
        for (const [index, currentToken] of this._tokens.entries()) {
            const { lineNumber: currentTokenLineNumber } = currentToken.getTokenized();
            if (index === 0) {
                // store the airspace definition block start line number for error messages
                definitionBlockStart = currentTokenLineNumber;
            }
            // if current token type is in the list of required tokens, add it to the inventory
            if (requiredTokens.includes(currentToken.getType())) {
                requiredTokensInventory.push(currentToken.getType());
            }
        }
        // check if all required tokens are present
        const missingTokens = requiredTokens.filter((token) => !requiredTokensInventory.includes(token));
        if (missingTokens.length > 0) {
            throw new ParserError({
                lineNumber: definitionBlockStart,
                errorMessage: `Airspace definition block is missing required tokens: ${missingTokens.join(', ')}`,
            });
        }
        // handle optional extended format tokens AF, AG (if present)
        const afToken = this._tokens.find((token) => token.type === AfToken.type);
        const agToken = this._tokens.find((token) => token.type === AgToken.type);
        // AG is optional and requires AF to be present
        if (!afToken && agToken) {
            throw new ParserError({
                lineNumber: (agToken.tokenized as Tokenized).lineNumber,
                errorMessage: `Token '${AgToken.type}' is present but token '${AfToken.type}' is missing.`,
            });
        }
    }

    protected handleAnToken(token: AnToken): void {
        const { metadata } = token.tokenized as Tokenized;
        const { name } = metadata;

        this._airspace.name = name;
    }

    protected handleAcToken(token: AcToken) {
        const { metadata } = token.tokenized as Tokenized;
        const { class: acClass } = metadata;

        this._airspace.airspaceClass = acClass;
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleAhToken(token) {
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
    protected handleAlToken(token) {
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
    protected handleDpToken(token) {
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
    protected handleVdToken(token) {
        checkTypes.assert.instance(token, VdToken);
    }

    /**
     * Does nothing but required to create an arc.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleVxToken(token) {
        checkTypes.assert.instance(token, VxToken);
    }

    /**
     * Sets airway width in nautical miles.
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleVwToken(token) {
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
    protected handleDyToken(token) {
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
    protected handleDcToken(token) {
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
    protected handleDbToken(token) {
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
    protected handleDaToken(token) {
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
    protected getBuildDbArcCoordinates(token) {
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
    protected handleCommentToken(token) {
        checkTypes.assert.instance(token, CommentToken);
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleBlankToken(token) {
        checkTypes.assert.instance(token, BlankToken);
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleAiToken(token) {
        checkTypes.assert.instance(token, AiToken);

        const { metadata } = token.getTokenized();
        const { identifier } = metadata;

        this.airspace.identifier = identifier;
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleAyToken(token) {
        checkTypes.assert.instance(token, AyToken);

        const { metadata } = token.getTokenized();
        const { type } = metadata;

        this.airspace.type = type;
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleAfToken(token) {
        checkTypes.assert.instance(token, AfToken);

        const { metadata } = token.getTokenized();
        const { frequency } = metadata;

        if (this.airspace.frequency == null) {
            this.airspace.frequency = {};
        }
        this.airspace.frequency.value = frequency;
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleAgToken(token) {
        checkTypes.assert.instance(token, AgToken);

        const { metadata } = token.getTokenized();
        const { name } = metadata;

        if (this.airspace.frequency == null) {
            this.airspace.frequency = {};
        }
        this.airspace.frequency.name = name;
    }

    /**
     *
     * @param {typedefs.openaip.OpenairParser.Token} token
     * @return {void}
     * @private
     */
    protected handleTpToken(token) {
        checkTypes.assert.instance(token, TpToken);

        const { metadata } = token.getTokenized();
        const { code } = metadata;

        this.airspace.transponderCode = code;
    }

    /**
     * @param {Object} coordinate
     * @return {number[]}
     * @private
     */
    protected toArrayLike(coordinate) {
        return [coordinate.longitude, coordinate.latitude];
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
    protected getNextToken(token, tokenType, lookAhead = true) {
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
    protected flToFeet(ceiling) {
        let { value, unit, referenceDatum } = ceiling;

        if (unit === 'FL') {
            value *= 100;
            unit = 'FT';
            referenceDatum = 'MSL';
        }

        return { value, unit, referenceDatum };
    }

    protected enforceSaneLimits() {
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
            /*
            Only compare if both lower and upper limit have the same reference datum. If they have different reference datums,
            e.g GND and MSL, the comparison cannot be done.
             */
            if (this.airspace.lowerCeiling.referenceDatum === this.airspace.upperCeiling.referenceDatum) {
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

    protected reset() {
        this._tokens = [];
        this._airspace = undefined;
        this._currentLineNumber = undefined;
        this._hasBuildTokens = false;
        this._isAirway = false;
        this._airway = undefined;
    }
}
