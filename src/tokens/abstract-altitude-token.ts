import { z } from 'zod';
import { AltitudeUnitEnum, type AltitudeUnit } from '../altitude-unit.enum.js';
import { DefaultParserConfig } from '../default-parser-config.js';
import type { TokenType } from '../types.js';
import { feetToMeters, metersToFeet } from '../unit-conversion.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type Config as BaseLineConfig, type IToken } from './abstract-line-token.js';

export type Config = BaseLineConfig & {
    unlimited?: number;
    // Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
    defaultAltUnit?: AltitudeUnit;
    // Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. If not set, does not convert units.
    targetAltUnit?: AltitudeUnit;
    // If true, rounds the altitude values. Defaults to false. This parameter is most useful when used with unit conversion, e.g. m -> feet.
    roundAltValues?: boolean;
};

export const ConfigSchema = z
    .object({
        tokenTypes: z.array(z.string().nonempty()),
        unlimited: z.number().optional(),
        defaultAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        targetAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        roundAltValues: z.boolean().optional(),
    })
    .strict()
    .describe('ConfigSchema');

type Altitude = { value: number; unit: string; referenceDatum: string };

interface IAltitudeReader {
    canHandle(altitudeString: string): boolean;
    read(altitudeString: string): Altitude;
}

type AbstractAltitudeReaderConfig = {
    unlimited: number;
    defaultAltUnit: AltitudeUnit;
    targetAltUnit: AltitudeUnit | undefined;
    roundAltValues: boolean;
};

const AbstractAltitudeReaderConfigSchema = z
    .object({
        unlimited: z.number(),
        defaultAltUnit: z.nativeEnum(AltitudeUnitEnum),
        targetAltUnit: z.nativeEnum(AltitudeUnitEnum),
        roundAltValues: z.boolean(),
    })
    .strict()
    .describe('AltitudeReaderConfigSchema');

/**
 * Tokenizes "AH/AL" airspace ceiling definitions.
 */
export abstract class AbstractAltitudeToken extends AbstractLineToken {
    static type: TokenType = 'BASE_ALTITUDE';
    protected _unlimited: number;
    protected _defaultAltUnit: AltitudeUnit;
    protected _targetAltUnit: AltitudeUnit | undefined;
    protected _roundAltValues: boolean;
    protected _readers: IAltitudeReader[] = [];

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const defaultConfig = {
            unlimited: DefaultParserConfig.unlimited,
            defaultAltUnit: DefaultParserConfig.defaultAltUnit,
            targetAltUnit: DefaultParserConfig.targetAltUnit,
            roundAltValues: DefaultParserConfig.roundAltValues,
        };
        const { unlimited, tokenTypes, defaultAltUnit, targetAltUnit, roundAltValues } = {
            ...defaultConfig,
            ...config,
        };

        super({ tokenTypes });

        this._unlimited = unlimited;
        this._defaultAltUnit = defaultAltUnit.toUpperCase() as AltitudeUnit;
        this._targetAltUnit = targetAltUnit ? (targetAltUnit.toUpperCase() as AltitudeUnit) : targetAltUnit;
        this._roundAltValues = roundAltValues;

        const readerConfig = {
            unlimited: this._unlimited,
            defaultAltUnit: this._defaultAltUnit,
            targetAltUnit: this._targetAltUnit,
            roundAltValues: this._roundAltValues,
        };
        /** @type {typedefs.openaip.OpenairParser.AltitudeReader[]} */
        this._readers = [
            new AltitudeDefaultReader(readerConfig),
            new AltitudeFlightLevelReader(readerConfig),
            new AltitudeSurfaceReader(readerConfig),
            new AltitudeUnlimitedReader(readerConfig),
        ];
    }

    /**
     * Turns an altitude string into an altitude object literal.
     *
     * @param {string} altitudeString
     * @return {{value: number, unit: string, referenceDatum: string}}
     * @private
     */
    getAltitude(altitudeString: string): Altitude {
        validateSchema(altitudeString, z.string().nonempty(), { assert: true, name: 'altitudeString' });

        // trim and convert to upper case
        altitudeString = altitudeString.trim().toUpperCase();
        for (const reader of this._readers) {
            if (reader.canHandle(altitudeString)) {
                return reader.read(altitudeString);
            }
        }

        throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
    }
}

abstract class AbstractAltitudeReader implements IAltitudeReader {
    protected _REGEX_ALTITUDE: RegExp;
    protected _unlimited: number;
    protected _defaultAltUnit: AltitudeUnit;
    protected _targetAltUnit: AltitudeUnit | undefined;
    protected _roundAltValues: boolean;

    constructor(config: AbstractAltitudeReaderConfig) {
        validateSchema(config, AbstractAltitudeReaderConfigSchema, { assert: true, name: 'config' });

        const { unlimited, defaultAltUnit, targetAltUnit, roundAltValues } = config || {};

        this._REGEX_ALTITUDE = new RegExp('');
        this._unlimited = unlimited;
        this._defaultAltUnit = defaultAltUnit;
        this._targetAltUnit = targetAltUnit;
        this._roundAltValues = roundAltValues;
    }

    abstract canHandle(altitudeString: string): boolean;
    abstract read(altitudeString: string): Altitude;
}

/**
 * Reads a default airspace ceiling definition, e.g. "2700ft MSL".
 */
class AltitudeDefaultReader extends AbstractAltitudeReader {
    constructor(config: AbstractAltitudeReaderConfig) {
        super(config);
        this._REGEX_ALTITUDE = /^(\d+(\.\d+)?)\s*(FT|ft|M|m)?\s*(MSL|AMSL|ALT|GND|GROUND|AGL|SURFACE|SFC|SRFC)?$/;
    }

    canHandle(altitudeString: string): boolean {
        return this._REGEX_ALTITUDE.test(altitudeString);
    }

    read(altitudeString: string): Altitude {
        // check for "default" altitude definition, e.g. 16500ft MSL or similar
        const altitudeParts = this._REGEX_ALTITUDE.exec(altitudeString);
        if (altitudeParts == null) {
            throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
        }
        // get altitude parts
        let value = parseFloat(altitudeParts[1]);
        // use the unit defined in altitude definition or if not set, use the configured default unit
        let unit = altitudeParts[3] ?? this._defaultAltUnit;
        const referenceDatum = this.harmonizeReference(altitudeParts[4]);

        /*
        Convert between altitude units if required. This only happens if a target unit is explicitly specified!

        Although "ft" is mostly used as main unit in openAIR airspace definitions, sometimes "meters" (m) are used instead.
        In this case, the tokenizer can convert meters into feet BUT this comes at a downside. Unfortunately,
        the source used to generate the openAIR file will often define meter values that are "prettified" and when
        converted to feet, they will almost NEVER match the common rounded values like "2500" but rather something like "2478.123".
         */
        if (this._targetAltUnit != null) {
            value = this.convertUnits(value, unit, this._targetAltUnit);
            // switch to new target unit
            unit = this._targetAltUnit;
        }
        // round values if requested
        value = this._roundAltValues ? parseInt(Math.round(value).toString()) : value;

        return { value, unit, referenceDatum };
    }

    private convertUnits(value: number, baseUnit: string, targetUnit: string): number {
        if (baseUnit === targetUnit) return value;

        let convValue;
        if (baseUnit === AltitudeUnitEnum.ft && targetUnit === AltitudeUnitEnum.m) {
            convValue = feetToMeters(value);
        } else if (baseUnit === AltitudeUnitEnum.m && targetUnit === AltitudeUnitEnum.ft) {
            convValue = metersToFeet(value);
        } else {
            throw new Error(`Unit conversion between '${baseUnit}' and '${targetUnit}' not supported`);
        }

        return convValue;
    }

    /**
     * Harmonizes various Openair related reference datum definitions and returns internally used reference datum.
     * If NO reference datum is given, default is to use "MSL"!
     */
    private harmonizeReference(reference: string | null): string {
        switch (reference) {
            case 'GND':
            case 'GROUND':
            case 'AGL':
            case 'SURFACE':
            case 'SFC':
            case 'SRFC':
                return 'GND';
            // if no reference datum is defined, always use MSL
            case 'MSL':
            case 'AMSL':
            case 'ALT':
            default:
                return 'MSL';
        }
    }
}

/**
 * Reads a flight level airspace ceiling definition, e.g. FL80.
 *
 * @type {typedefs.openaip.OpenairParser.AltitudeReader}
 */
class AltitudeFlightLevelReader extends AbstractAltitudeReader {
    constructor(config: AbstractAltitudeReaderConfig) {
        super(config);
        this._REGEX_ALTITUDE = /^FL\s*(\d{2,})?$/;
    }

    canHandle(altitudeString: string): boolean {
        return this._REGEX_ALTITUDE.test(altitudeString);
    }

    read(altitudeString: string): Altitude {
        // check flight level altitude definition
        const altitudeParts = this._REGEX_ALTITUDE.exec(altitudeString);
        if (altitudeParts == null) {
            throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
        }
        // get altitude parts
        const value = parseInt(altitudeParts[1]);
        const unit = 'FL';
        const referenceDatum = 'STD';

        return { value, unit, referenceDatum };
    }
}

/**
 * Reads a surface airspace ceiling definition, e.g. GND.
 *
 * @type {typedefs.openaip.OpenairParser.AltitudeReader}
 */
class AltitudeSurfaceReader extends AbstractAltitudeReader {
    constructor(config: AbstractAltitudeReaderConfig) {
        super(config);
        this._REGEX_ALTITUDE = /^(MSL|GND|GROUND|AGL|SURFACE|SFC|SRFC)$/;
    }

    canHandle(altitudeString: string): boolean {
        return this._REGEX_ALTITUDE.test(altitudeString);
    }

    read(altitudeString: string): Altitude {
        const altitudeParts = this._REGEX_ALTITUDE.exec(altitudeString);
        if (altitudeParts == null) {
            throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
        }
        let referenceDatum = altitudeParts[0];
        if (referenceDatum !== 'MSL') {
            // always use GND
            referenceDatum = 'GND';
        }

        return { value: 0, unit: 'FT', referenceDatum };
    }
}

/**
 * Reads unlimited ceiling airspace definitions.
 *
 * @type {typedefs.openaip.OpenairParser.AltitudeReader}
 */
class AltitudeUnlimitedReader extends AbstractAltitudeReader {
    constructor(config: AbstractAltitudeReaderConfig) {
        super(config);
        // unlimited ceiling definition
        this._REGEX_ALTITUDE = /^(UNLIMITED|UNLIM|UNL|UNLTD)$/;
    }

    canHandle(altitudeString: string): boolean {
        return this._REGEX_ALTITUDE.test(altitudeString);
    }

    read(altitudeString: string): Altitude {
        return { value: this._unlimited, unit: 'FL', referenceDatum: 'STD' };
    }
}
