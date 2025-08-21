import type { Coordinate } from '@openaip/coordinate-parser/dist/esm/types';
import {
    bearing as calcBearing,
    distance as calcDistance,
    buffer as createBuffer,
    circle as createCircle,
    lineString as createLineString,
    destination,
} from '@turf/turf';
import type { Polygon, Position } from 'geojson';
import { z } from 'zod';
import { Airspace, type Altitude } from './airspace.js';
import { AltitudeUnitEnum } from './altitude-unit.enum.js';
import { ParserError } from './parser-error.js';
import { ParserVersionEnum, type ParserVersion } from './parser-version.enum.js';
import { AaToken, BY_NOTAM_ACTIVATION } from './tokens/aa-token.js';
import { AbstractLineToken, type IToken, type Tokenized } from './tokens/abstract-line-token.js';
import { AcToken } from './tokens/ac-token.js';
import { AfToken } from './tokens/af-token.js';
import { AgToken } from './tokens/ag-token.js';
import { AhToken } from './tokens/ah-token.js';
import { AlToken } from './tokens/al-token.js';
import { AnToken } from './tokens/an-token.js';
import { AxToken } from './tokens/ax-token.js';
import { AyToken } from './tokens/ay-token.js';
import { BlankToken } from './tokens/blank-token.js';
import { CommentToken } from './tokens/comment-token.js';
import { DaToken } from './tokens/da-token.js';
import { DbToken } from './tokens/db-token.js';
import { DcToken } from './tokens/dc-token.js';
import { DpToken } from './tokens/dp-token.js';
import { DyToken } from './tokens/dy-token.js';
import { EofToken } from './tokens/eof-token.js';
import { type TokenType } from './tokens/token-type.enum.js';
import { VdToken } from './tokens/vd-token.js';
import { VwToken } from './tokens/vw-token.js';
import { VxToken } from './tokens/vx-token.js';
import { metersToFeet } from './unit-conversion.js';
import { validateSchema } from './validate-schema.js';

export type Config = {
    geometryDetail: number;
    version: ParserVersion;
};

export const ConfigSchema = z
    .object({
        geometryDetail: z.number().int().min(50),
        version: z.nativeEnum(ParserVersionEnum),
    })
    .strict()
    .describe('ConfigSchema');

type AirwayStructure = {
    width: number;
    segments: Position[];
};

export class AirspaceFactory {
    protected _geometryDetail: number;
    protected _version: ParserVersion;
    protected _tokens: IToken[] = [];
    protected _airspace: Airspace;
    protected _currentLineNumber: number | undefined = undefined;
    // set to true if airspace contains tokens other than "skipped, blanks or comment"
    protected _hasBuildTokens: boolean = false;
    protected _isAirway: boolean = false;
    protected _airway: Partial<AirwayStructure> | undefined = undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { geometryDetail, version } = config;

        this._airspace = new Airspace();
        this._geometryDetail = geometryDetail;
        this._version = version;
    }

    createAirspace(tokens: IToken[]): Airspace | undefined {
        validateSchema(tokens, z.array(z.instanceof(AbstractLineToken)), { assert: true, name: 'tokens' });

        this.reset();
        this._tokens = tokens;
        this._airspace = new Airspace();
        // if version 2 is used, set byNotam to false by default
        if (this._version === ParserVersionEnum.VERSION_2) {
            this._airspace.byNotam = false;
        }
        // validate all tokens are correct and that we are able to build an airspace from them
        this.validateTokens();

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
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
            if (airwayWidth == null || (airwaySegments != null && airwaySegments.length === 0)) {
                throw new ParserError({
                    lineNumber: this._currentLineNumber,
                    errorMessage: 'Airway definition is missing required tokens.',
                });
            }
            const airwayCoordinates = this.buildCoordinatesFromAirway({
                width: airwayWidth,
                segments: airwaySegments as Position[],
            });
            this._airspace.addCoordinates(airwayCoordinates);
        }

        return this._hasBuildTokens ? this._airspace : undefined;
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
                this.handleCommentToken(token as CommentToken);
                break;
            case AcToken.type:
                this.handleAcToken(token as AcToken);
                break;
            case AnToken.type:
                this.handleAnToken(token as AnToken);
                break;
            case AhToken.type:
                this.handleAhToken(token as AhToken);
                break;
            case AlToken.type:
                this.handleAlToken(token as AlToken);
                break;
            case DpToken.type:
                this.handleDpToken(token as DpToken);
                break;
            case DyToken.type:
                this.handleDyToken(token as DyToken);
                break;
            case VdToken.type:
                this.handleVdToken(token as VdToken);
                break;
            case VxToken.type:
                this.handleVxToken(token as VxToken);
                break;
            case VwToken.type:
                this.handleVwToken(token as VwToken);
                break;
            case DcToken.type:
                this.handleDcToken(token as DcToken);
                break;
            case DbToken.type:
                this.handleDbToken(token as DbToken);
                break;
            case DaToken.type:
                this.handleDaToken(token as DaToken);
                break;
            case BlankToken.type:
                this.handleBlankToken(token as BlankToken);
                break;
            case EofToken.type:
                break;
            // version 2 tokens
            case AyToken.type:
                this.handleAyToken(token as AyToken);
                break;
            case AfToken.type:
                this.handleAfToken(token as AfToken);
                break;
            case AgToken.type:
                this.handleAgToken(token as AgToken);
                break;
            case AxToken.type:
                this.handleAxToken(token as AxToken);
                break;
            case AaToken.type:
                this.handleAaToken(token as AaToken);
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
        for (const [index, currentToken] of this._tokens.entries()) {
            const maxLookAheadIndex = this._tokens.length - 1;
            const { lineNumber: currentTokenLineNumber } = (currentToken as IToken).tokenized as Tokenized;

            // Make sure the first relevant token is an AC tag. Starting from this AC tag, the token order can be validated
            // only using "look ahead" logic. Otherwise, additional "look behind" must be implemented that would
            // increase processing time.
            if (startingAcTagFound === false && currentToken.isIgnoredToken() === false) {
                if (currentToken.type === AcToken.type) {
                    startingAcTagFound = true;
                } else {
                    throw new ParserError({
                        lineNumber: currentTokenLineNumber,
                        errorMessage: `The first token must be of type '${
                            AcToken.type
                        }'. Token '${currentToken.type}' found on line ${currentTokenLineNumber}.`,
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
                        errorMessage: `Token '${currentToken.type}' on line ${currentTokenLineNumber} does not allow subsequent token '${lookAheadToken.type}' on line ${lookAheadTokenLineNumber}`,
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
        // if version 2 is used, add the version 2 tokens to the required tokens list
        if (this._version === ParserVersionEnum.VERSION_2) {
            // AY token is required, all others are optional
            requiredTokens.push(AyToken.type);
        }
        const requiredTokensInventory: TokenType[] = [];
        let definitionBlockStart: number | undefined = undefined;

        for (const [index, currentToken] of this._tokens.entries()) {
            const { lineNumber: currentTokenLineNumber } = (currentToken as IToken).tokenized as Tokenized;
            if (index === 0) {
                // store the airspace definition block start line number for error messages
                definitionBlockStart = currentTokenLineNumber;
            }
            // if current token type is in the list of required tokens, add it to the inventory
            if (requiredTokens.includes(currentToken.type)) {
                requiredTokensInventory.push(currentToken.type);
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
        // handle optional version 2 tokens AF, AG (if present)
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
        const { metadata } = token.tokenized;
        const { name } = metadata;

        this._airspace.name = name;
    }

    protected handleAcToken(token: AcToken): void {
        const { metadata } = token.tokenized;
        const { class: acClass } = metadata;

        this._airspace.airspaceClass = acClass;
    }

    protected handleAhToken(token: AhToken): void {
        const { metadata } = token.tokenized;
        const { altitude } = metadata;

        this._airspace.upperCeiling = altitude;
        // check that defined upper limit is actually higher than defined lower limit
        this.enforceSaneLimits();
    }

    protected handleAlToken(token: AlToken): void {
        const { metadata } = token.tokenized;
        const { altitude } = metadata;

        this._airspace.lowerCeiling = altitude;
        // check that defined lower limit is actually lower than defined upper limit
        this.enforceSaneLimits();
    }

    protected handleDpToken(token: DpToken): void {
        const { metadata } = token.tokenized;
        const { coordinate } = metadata;

        // IMPORTANT subsequently push coordinates
        this._airspace.coordinates.push(this.toArrayLike(coordinate));
    }

    /**
     * Does nothing but required to create an arc.
     */
    protected handleVdToken(token: VdToken): void {}

    /**
     * Does nothing but required to create an arc.
     */
    protected handleVxToken(token: VxToken): void {}

    /**
     * Sets airway width in nautical miles.
     */
    protected handleVwToken(token: VwToken): void {
        const { metadata } = token.tokenized;
        const { width } = metadata;

        // IMPORTANT indicate that we are building an airspace from airway definition
        this._isAirway = true;
        if (this._airway == null) {
            this._airway = { width };
        } else {
            this._airway.width = width;
        }
    }

    /**
     * Sets airway segment.
     */
    protected handleDyToken(token: DyToken): void {
        const { metadata } = token.tokenized;
        const { coordinate } = metadata;

        if (this._airway == null) {
            this._airway = { segments: [] };
        } else if (this._airway.segments == null) {
            this._airway.segments = [];
        }
        // IMPORTANT subsequently push airway segment coordinates
        (this._airway as AirwayStructure).segments.push(this.toArrayLike(coordinate));
    }

    /**
     * Creates a circle geometry from the last VToken coordinate and a DcToken radius.
     */
    protected handleDcToken(token: DcToken): void {
        const { lineNumber, metadata } = token.tokenized;
        const { radius } = metadata;
        const precedingVxToken = this.getNextToken<VxToken>(token, VxToken.type, false);

        if (precedingVxToken == null) {
            throw new ParserError({ lineNumber, errorMessage: 'Preceding VX token not found.' });
        }
        // to create a circle, the center point coordinate from the previous VToken is required
        const { metadata: vxTokenMetadata } = precedingVxToken.tokenized;
        const { coordinate } = vxTokenMetadata;

        // convert radius in NM to meters
        const radiusM = radius * 1852;

        const { geometry } = createCircle(this.toArrayLike(coordinate), radiusM, {
            steps: this._geometryDetail,
            units: 'meters',
        });
        const [coordinates] = geometry.coordinates;
        /*
        When creating circles and arcs, there may be self-intersections if the defined coordinatesof center and start-/endpoints and radius
        do not match exactly. These self-intersecting coordinates are usually very close together and when removed, the airspace
        geometry basically does not change at all. To mitigate returning invalid geometries, remove duplicates with a specified buffer
        after the circle is created.
        */
        const refinedCoordinates = this.removeNearestCoordinates(coordinates, { minAllowedDistance: 200 });
        // make sure that the last coordinate equals the first coordinate - i.e. close the polygon
        if (refinedCoordinates[0] !== refinedCoordinates[refinedCoordinates.length - 1]) {
            refinedCoordinates.push(refinedCoordinates[0]);
        }
        // IMPORTANT set coordinates => calculated circle coordinates are the only coordinates
        this._airspace.addCoordinates(refinedCoordinates);
    }

    protected handleDbToken(token: DbToken): void {
        const { centerCoordinate, startCoordinate, endCoordinate, clockwise } = this.getBuildDbArcCoordinates(token);
        const arcCenterCoordinate: Position = centerCoordinate;
        // build the adjusted arc-like geometry
        const arcCoordinates = this.createAdjustedArc(startCoordinate, arcCenterCoordinate, endCoordinate, clockwise, {
            steps: this._geometryDetail,
        });
        // add arc coordinates to the airspace coordinates
        this._airspace.addCoordinates(arcCoordinates);
    }

    protected handleDaToken(token: DaToken): void {
        const { centerCoordinate, startCoordinate, endCoordinate, clockwise } = this.getBuildDaArcCoordinates(token);
        // build the adjusted arc-like geometry
        const arcCoordinates = this.createAdjustedArc(startCoordinate, centerCoordinate, endCoordinate, clockwise, {
            steps: this._geometryDetail,
        });
        // add arc coordinates to the airspace coordinates
        this._airspace.addCoordinates(arcCoordinates);
    }

    protected getBuildDbArcCoordinates(token: DbToken): {
        centerCoordinate: Position;
        startCoordinate: Position;
        endCoordinate: Position;
        clockwise: boolean;
    } {
        // current "token" is the DbToken => defines arc start/end coordinates
        const { lineNumber, metadata: metadataDbToken } = token.tokenized;
        const { startCoordinate, endCoordinate } = metadataDbToken;
        // by default, arcs are defined clockwise and usually no VD token is present
        let clockwise = true;
        // get the VdToken => is optional (clockwise) and may not be present but is required for counter-clockwise arcs
        const vdToken: VdToken = this.getNextToken<VdToken>(token, VdToken.type, false) as VdToken;
        if (vdToken) {
            clockwise = vdToken.tokenized.metadata.clockwise;
        }
        // get preceding VxToken => defines the arc center
        const vxToken: VxToken = this.getNextToken<VxToken>(token, VxToken.type, false) as VxToken;
        if (vxToken == null) {
            throw new ParserError({ lineNumber, errorMessage: 'Preceding VX token not found.' });
        }
        const { metadata: metadataVxToken } = vxToken.tokenized;
        const { coordinate: vxTokenCoordinate } = metadataVxToken;

        return {
            centerCoordinate: this.toArrayLike(vxTokenCoordinate),
            startCoordinate: this.toArrayLike(startCoordinate),
            endCoordinate: this.toArrayLike(endCoordinate),
            clockwise,
        };
    }

    protected getBuildDaArcCoordinates(token: DaToken): {
        centerCoordinate: Position;
        startCoordinate: Position;
        endCoordinate: Position;
        clockwise: boolean;
    } {
        // current "token" is the DaToken => defines arc start/end coordinates
        const { lineNumber, metadata: metadataDaToken } = token.tokenized;
        const { radius, startBearing, endBearing } = metadataDaToken;
        // by default, arcs are defined clockwise and usually no VD token is present
        let clockwise = true;
        // get the VdToken => is optional (clockwise) and may not be present but is required for counter-clockwise arcs
        const vdToken: VdToken = this.getNextToken<VdToken>(token, VdToken.type, false) as VdToken;
        if (vdToken) {
            clockwise = vdToken.tokenized.metadata.clockwise;
        }
        // get preceding VxToken => defines the arc center
        const vxToken: VxToken = this.getNextToken<VxToken>(token, VxToken.type, false) as VxToken;
        if (vxToken == null) {
            throw new ParserError({ lineNumber, errorMessage: 'Preceding VX token not found.' });
        }
        const { metadata: metadataVxToken } = vxToken.tokenized;
        const { coordinate: vxTokenCoordinate } = metadataVxToken;
        // calculate start and end coordinates using bearing and radius and center coordinate
        const radiusKm = radius / 1000;
        const startCoordinate = destination(this.toArrayLike(vxTokenCoordinate), radiusKm, startBearing, {
            units: 'kilometers',
        }).geometry.coordinates;
        const endCoordinate = destination(this.toArrayLike(vxTokenCoordinate), radiusKm, endBearing, {
            units: 'kilometers',
        }).geometry.coordinates;

        return {
            centerCoordinate: this.toArrayLike(vxTokenCoordinate),
            startCoordinate,
            endCoordinate,
            clockwise,
        };
    }

    protected handleCommentToken(token: CommentToken): void {}

    protected handleBlankToken(token: BlankToken): void {}

    protected handleAyToken(token: AyToken): void {
        const { metadata } = token.tokenized;
        const { type } = metadata;

        this._airspace.type = type;
    }

    protected handleAfToken(token: AfToken): void {
        const { metadata } = token.tokenized;
        const { frequency } = metadata;

        if (this._airspace.frequency == null) {
            this._airspace.frequency = { value: frequency };
        } else {
            this._airspace.frequency.value = frequency;
        }
    }

    protected handleAgToken(token: AgToken): void {
        const { metadata } = token.tokenized;
        const { name } = metadata;

        if (this._airspace.frequency == null) {
            this._airspace.frequency = { name };
        } else {
            this._airspace.frequency.name = name;
        }
    }

    protected handleAxToken(token: AxToken): void {
        const { metadata } = token.tokenized;
        const { code } = metadata;

        this._airspace.transponderCode = code;
    }

    protected handleAaToken(token: AaToken): void {
        const { metadata } = token.tokenized;
        const { activation } = metadata;

        // handle NONE activation
        if (activation === BY_NOTAM_ACTIVATION) {
            // if there is also another activation time, throw an error
            if (this._airspace.activationTimes != null && this._airspace.activationTimes.length > 0) {
                throw new ParserError({
                    lineNumber: this._currentLineNumber,
                    errorMessage: 'Additional activation times are not allowed with BY NOTAM activation.',
                });
            }
            this._airspace.byNotam = true;
            return;
        }
        // initialize activation times if not already done
        if (this._airspace.activationTimes == null) {
            this._airspace.activationTimes = [];
        }
        this._airspace.activationTimes.push(activation);
    }

    protected toArrayLike(coordinate: Coordinate): Position {
        return [coordinate.longitude, coordinate.latitude];
    }

    /**
     * Traverses up the list of "consumed tokens" from the token until a token with the specified type is found.
     *
     * token - Currently consumed token
     * tokenType - Token type to search for
     * lookAhead - If true, searches for NEXT token in list with specified type. If false, searches preceding token.
     */
    protected getNextToken<T>(token: IToken, tokenType: TokenType, lookAhead: boolean = true): T | undefined {
        // get index of current token in tokens list
        let currentIndex = this._tokens.findIndex((value) => value === token);

        if (lookAhead) {
            for (currentIndex; currentIndex <= this._tokens.length - 1; currentIndex++) {
                const nextToken = this._tokens[currentIndex];

                if (nextToken.type === tokenType) {
                    return nextToken as T;
                }
            }
        } else {
            for (currentIndex; currentIndex >= 0; currentIndex--) {
                const nextToken = this._tokens[currentIndex];

                if (nextToken.type === tokenType) {
                    return nextToken as T;
                }
            }
        }

        return undefined;
    }

    /**
     * Helper that converts FL into FEET. Simplified value to be expected as return value, will not
     * be sufficient for very few edge cases.
     */
    protected flToFeet(ceiling: Altitude): Altitude {
        let { value, unit, referenceDatum } = ceiling;

        if (unit === 'FL') {
            value *= 100;
            unit = 'FT';
            referenceDatum = 'MSL';
        }

        return { value, unit, referenceDatum };
    }

    protected enforceSaneLimits() {
        if (this._airspace.lowerCeiling && this._airspace.upperCeiling) {
            // IMPORTANT "feeted" flight level ceilings must be converted to configured target unit before comparing if specified
            const feeted = function (ceiling: Altitude) {
                const feeted = ceiling;
                const { unit, value } = ceiling;

                switch (unit) {
                    case AltitudeUnitEnum.METER:
                        feeted.value = metersToFeet(value);
                        feeted.unit = AltitudeUnitEnum.FEET;
                        break;
                    case AltitudeUnitEnum.FEET:
                    default:
                    // nothing to do
                }

                return feeted;
            };
            /*
            Only compare if both lower and upper limit have the same reference datum. If they have different reference datums,
            e.g AGL and AMSL, the comparison cannot be done.
             */
            if (this._airspace.lowerCeiling.referenceDatum === this._airspace.upperCeiling.referenceDatum) {
                const compareUpper = feeted(this.flToFeet(this._airspace.upperCeiling));
                const compareLower = feeted(this.flToFeet(this._airspace.lowerCeiling));

                if (compareLower.value > compareUpper.value) {
                    throw new ParserError({
                        lineNumber: this._currentLineNumber,
                        errorMessage: 'Lower limit must be less than upper limit',
                    });
                }
            }
        }
    }

    protected removeNearestCoordinates(coordinates: Position[], config: { minAllowedDistance?: number }): Position[] {
        const defaultConfig = { minAllowedDistance: 200 };
        const { minAllowedDistance } = { ...defaultConfig, ...config };
        const processed: Position[] = [];
        for (const coord of coordinates) {
            const exists = processed.find((value) => {
                // distance that is allowed to be between two coordinates - if below, the coordinate is cosidered a duplicate
                const bufferDistance = minAllowedDistance / 1000;
                const distance = calcDistance(value, coord, { units: 'kilometers' });

                return distance <= bufferDistance;
            });
            if (exists == null) {
                processed.push(coord);
            }
        }
        if (processed.length < 4) {
            throw new ParserError({
                lineNumber: this._currentLineNumber,
                errorMessage: 'The polygon dimensions are too small to create a polygon.',
            });
        }

        return processed;
    }

    /**
     * Creates an arc-like LineString geometry with a smooth transition to the end coordinate.
     * The arc starts with the radius defined by the distance from start to center,
     * then gradually adjusts to meet the exact end coordinate in the final quarter of the arc.
     */
    protected createAdjustedArc(
        startCoordinate: Position,
        centerCoordinate: Position,
        endCoordinate: Position,
        clockwise: boolean,
        options: { steps?: number } = {}
    ): Position[] {
        const defaultOptions = { steps: 100 };
        const { steps } = { ...defaultOptions, ...options };
        const arcCenterCoordinate: Position = centerCoordinate;
        const startBearing = calcBearing(arcCenterCoordinate, startCoordinate);
        let endBearing = calcBearing(arcCenterCoordinate, endCoordinate);
        const startRadius = calcDistance(arcCenterCoordinate, startCoordinate, { units: 'kilometers' });
        const endRadius = calcDistance(arcCenterCoordinate, endCoordinate, { units: 'kilometers' });

        // normalize end bearing for proper arc calculation
        if (clockwise) {
            // for clockwise, if end bearing is less than start bearing, add 360 to end bearing
            // this ensures we go the long way around clockwise
            if (endBearing < startBearing) {
                endBearing += 360;
            }
        } else {
            // for counter-clockwise, if end bearing is greater than start bearing, subtract 360 from end bearing
            // this ensures we go the long way around counter-clockwise
            if (endBearing > startBearing) {
                endBearing -= 360;
            }
        }
        // generate points along the arc
        const coordinates: Position[] = [];
        for (let i = 0; i <= steps; i++) {
            const fraction = i / steps;
            // use a smooth transition curve for the radius in the final quarter
            let currentRadius = startRadius;
            if (fraction > 0.75) {
                // smoothly transition from start radius to end radius -  normalize to 0-1 for last quarter
                const transitionFraction = (fraction - 0.75) * 4;
                // smooth step function
                const smoothFraction = transitionFraction * transitionFraction * (3 - 2 * transitionFraction);
                currentRadius = startRadius + (endRadius - startRadius) * smoothFraction;
            }
            // calculate current bearing and normalize it to -180 to 180 range
            let bearing = startBearing + (endBearing - startBearing) * fraction;
            if (bearing > 180) bearing -= 360;
            if (bearing < -180) bearing += 360;
            // create arc point at current bearing and radius
            const arcPoint = destination(arcCenterCoordinate, currentRadius, bearing, { units: 'kilometers' });
            coordinates.push(arcPoint.geometry.coordinates);
        }
        // ensure the last point exactly matches the target
        coordinates[coordinates.length - 1] = endCoordinate;

        return coordinates;
    }

    protected reset() {
        this._tokens = [];
        this._airspace = new Airspace();
        this._currentLineNumber = undefined;
        this._hasBuildTokens = false;
        this._isAirway = false;
        this._airway = undefined;
    }
}
