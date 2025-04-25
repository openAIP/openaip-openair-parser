import type { Coordinate } from '@openaip/coordinate-parser/dist/types/types.js';
import {
    bearing as calcBearing,
    distance as calcDistance,
    lineArc as createArc,
    buffer as createBuffer,
    circle as createCircle,
    lineString as createLineString,
} from '@turf/turf';
import type { Polygon, Position } from 'geojson';
import { z } from 'zod';
import { Airspace, type Altitude } from './airspace.js';
import { AltitudeUnitEnum } from './altitude-unit.enum.js';
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
import { metersToFeet } from './unit-conversion.js';
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
    width: number;
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
    protected _airway: Partial<AirwayStructure> | undefined = undefined;

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
            if (airwayWidth == null || (airwaySegments != null && airwaySegments.length === 0)) {
                throw new ParserError({
                    lineNumber: this._currentLineNumber,
                    errorMessage: 'Airway definition is missing required tokens.',
                });
            }
            this._airspace.coordinates = this.buildCoordinatesFromAirway({
                width: airwayWidth,
                segments: airwaySegments as Position[],
            });
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
            // extended format tokens
            case AiToken.type:
                this.handleAiToken(token as AiToken);
                break;
            case AyToken.type:
                this.handleAyToken(token as AyToken);
                break;
            case AfToken.type:
                this.handleAfToken(token as AfToken);
                break;
            case AgToken.type:
                this.handleAgToken(token as AgToken);
                break;
            case TpToken.type:
                this.handleTpToken(token as TpToken);
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
        // if the extended format is used, add the extended format tokens to the required tokens list
        if (this._extendedFormat === true) {
            // AY token is required, all others are optional
            requiredTokens.push(AyToken.type);
        }
        const requiredTokensInventory: TokenType[] = [];
        let definitionBlockStart: number | undefined = undefined;

        // @ts-expect-error downlevel iteration flag required
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
        // IMPORTANT set coordinates => calculated circle coordinates are the only coordinates
        this._airspace.coordinates = coordinates;
    }

    /**
     * Creates an arc geometry from the last VToken coordinate and a DbToken endpoint coordinates.
     */
    protected handleDbToken(token: DbToken): void {
        const { lineNumber } = token.tokenized;
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
            steps: this._geometryDetail,
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
        this._airspace.coordinates = this._airspace.coordinates.concat(arcCoordinates);
    }

    /**
     * Creates an arc geometry from the last VToken coordinate and a DaToken that contains arc definition as
     * radius, angleStart and angleEnd.
     */
    protected handleDaToken(token: DaToken): void {
        const { lineNumber, metadata: metadataDaToken } = token.tokenized;
        const { radius, startBearing, endBearing } = metadataDaToken.arcDef;
        let angleStart = startBearing;
        let angleEnd = endBearing;
        // by default, arcs are defined clockwise and usually no VD token is present
        let clockwise = true;
        // get the VdToken => is optional (clockwise) and may not be present but is required for counter-clockwise arcs
        const vdToken = this.getNextToken<VdToken>(token, VdToken.type, false);
        // get preceding VxToken => defines the arc center
        const vxToken = this.getNextToken<VxToken>(token, VxToken.type, false);

        if (vdToken != null) {
            clockwise = vdToken.tokenized.metadata.clockwise;
        }
        // if counter-clockwise, flip start/end bearing
        if (clockwise === false) {
            angleStart = endBearing;
            angleEnd = startBearing;
        }
        if (vxToken == null) {
            throw new ParserError({ lineNumber, errorMessage: 'Preceding VX token not found.' });
        }
        const { metadata: metadataVxToken } = vxToken.tokenized;
        const { coordinate: vxTokenCoordinate } = metadataVxToken;

        const centerCoord = this.toArrayLike(vxTokenCoordinate);
        // get the radius in kilometers
        const radiusKm = radius * 1.852;
        // calculate the line arc
        const { geometry } = createArc(centerCoord, radiusKm, angleStart, angleEnd, {
            steps: this._geometryDetail,
            // units can't be set => will result in error "options is invalid" => bug?
        });

        // if counter-clockwise, reverse coordinate list order
        const arcCoordinates = clockwise ? geometry.coordinates : geometry.coordinates.reverse();
        this._airspace.coordinates = this._airspace.coordinates.concat(arcCoordinates);
    }

    protected getBuildDbArcCoordinates(token: DbToken): {
        centerCoordinate: Coordinate;
        startCoordinate: Coordinate;
        endCoordinate: Coordinate;
        clockwise: boolean;
    } {
        // Current "token" is the DbToken => defines arc start/end coordinates
        const { lineNumber, metadata: metadataDbToken } = token.tokenized;
        const { coordinates: dbTokenCoordinates } = metadataDbToken;
        const [dbTokenStartCoordinate, dbTokenEndCoordinate] = dbTokenCoordinates;

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
            centerCoordinate: vxTokenCoordinate,
            startCoordinate: dbTokenStartCoordinate,
            endCoordinate: dbTokenEndCoordinate,
            clockwise,
        };
    }

    protected handleCommentToken(token: CommentToken): void {}

    protected handleBlankToken(token: BlankToken): void {}

    protected handleAiToken(token: AiToken): void {
        const { metadata } = token.tokenized;
        const { identifier } = metadata;

        this._airspace.identifier = identifier;
    }

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

    protected handleTpToken(token: TpToken): void {
        const { metadata } = token.tokenized;
        const { code } = metadata;

        this._airspace.transponderCode = code;
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
                    case AltitudeUnitEnum.m:
                        feeted.value = metersToFeet(value);
                        feeted.unit = AltitudeUnitEnum.ft;
                        break;
                    case AltitudeUnitEnum.ft:
                    default:
                    // nothing to do
                }

                return feeted;
            };
            /*
            Only compare if both lower and upper limit have the same reference datum. If they have different reference datums,
            e.g GND and MSL, the comparison cannot be done.
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

    protected reset() {
        this._tokens = [];
        this._airspace = new Airspace();
        this._currentLineNumber = undefined;
        this._hasBuildTokens = false;
        this._isAirway = false;
        this._airway = undefined;
    }
}
