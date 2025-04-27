import { z } from 'zod';
import type { Altitude } from '../airspace.js';
import { AltitudeUnitEnum, type AltitudeUnit } from '../altitude-unit.enum.js';
import { feetToMeters, metersToFeet } from '../unit-conversion.js';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type Config as BaseLineConfig } from './abstract-line-token.js';
import { type TokenType } from './token-type.enum.js';

type Metadata = { altitude: Altitude };

export type Config = BaseLineConfig & {
    unlimited: number;
    // Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. If not set, does not convert units.
    targetAltUnit?: AltitudeUnit | undefined;
    // If true, rounds the altitude values. Defaults to false. This parameter is most useful when used with unit conversion, e.g. m -> feet.
    roundAltValues: boolean;
    // If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
    extendedFormat: boolean;
};

export const ConfigSchema = z
    .object({
        tokenTypes: z.array(z.string().nonempty()),
        unlimited: z.number(),
        targetAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        roundAltValues: z.boolean(),
        extendedFormat: z.boolean(),
    })
    .strict()
    .describe('ConfigSchema');

interface IAltitudeReader {
    canHandle(altitudeString: string): boolean;
    read(altitudeString: string): Altitude;
}

type AbstractAltitudeReaderConfig = {
    unlimited: number;
    targetAltUnit?: AltitudeUnit | undefined;
    roundAltValues: boolean;
};

const AbstractAltitudeReaderConfigSchema = z
    .object({
        unlimited: z.number(),
        targetAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        roundAltValues: z.boolean(),
    })
    .strict()
    .describe('AltitudeReaderConfigSchema');

/**
 * Tokenizes "AH/AL" airspace ceiling definitions.
 */
export abstract class AbstractAltitudeToken extends AbstractLineToken<Metadata> {
    static type: TokenType = 'BASE_ALTITUDE';
    protected _unlimited: number;
    protected _targetAltUnit: AltitudeUnit | undefined;
    protected _roundAltValues: boolean;
    protected _readers: IAltitudeReader[] = [];

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        const { unlimited, tokenTypes, targetAltUnit, roundAltValues, extendedFormat } = config;
        super({ tokenTypes, extendedFormat });

        this._unlimited = unlimited;
        this._targetAltUnit = targetAltUnit ? (targetAltUnit.toUpperCase() as AltitudeUnit) : targetAltUnit;
        this._roundAltValues = roundAltValues;

        const readerConfig = {
            unlimited: this._unlimited,
            targetAltUnit: this._targetAltUnit,
            roundAltValues: this._roundAltValues,
        };
        this._readers = [
            new AltitudeDefaultReader(readerConfig),
            new AltitudeFlightLevelReader(readerConfig),
            new AltitudeSurfaceReader(readerConfig),
            new AltitudeUnlimitedReader(readerConfig),
        ];
    }

    /**
     * Turns an altitude string into an altitude object literal.
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
    protected _targetAltUnit: AltitudeUnit | undefined;
    protected _roundAltValues: boolean;

    constructor(config: AbstractAltitudeReaderConfig) {
        validateSchema(config, AbstractAltitudeReaderConfigSchema, { assert: true, name: 'config' });

        const { unlimited, targetAltUnit, roundAltValues } = config || {};

        this._REGEX_ALTITUDE = new RegExp('');
        this._unlimited = unlimited;
        this._targetAltUnit = targetAltUnit;
        this._roundAltValues = roundAltValues;
    }

    abstract canHandle(altitudeString: string): boolean;
    abstract read(altitudeString: string): Altitude;
}

/**
 * Reads a default airspace ceiling definition, e.g. "2700ft AMSL".
 */
class AltitudeDefaultReader extends AbstractAltitudeReader {
    constructor(config: AbstractAltitudeReaderConfig) {
        super(config);
        this._REGEX_ALTITUDE = /^(\d+(\.\d+)?)\s*(FT|ft|M|m)?\s*(AMSL|AGL)?$/;
    }

    canHandle(altitudeString: string): boolean {
        return this._REGEX_ALTITUDE.test(altitudeString);
    }

    read(altitudeString: string): Altitude {
        // check for "default" altitude definition, e.g. 16500ft AMSL or similar
        const altitudeParts = this._REGEX_ALTITUDE.exec(altitudeString);
        if (altitudeParts == null) {
            throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
        }
        // get altitude parts
        let value = parseFloat(altitudeParts[1]);
        let unit = altitudeParts[3];
        const referenceDatum = altitudeParts[4];
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

    protected convertUnits(value: number, baseUnit: string, targetUnit: string): number {
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
}

/**
 * Reads a flight level airspace ceiling definition, e.g. FL80.
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
 */
class AltitudeSurfaceReader extends AbstractAltitudeReader {
    constructor(config: AbstractAltitudeReaderConfig) {
        super(config);
        this._REGEX_ALTITUDE = /^(GND)$/;
    }

    canHandle(altitudeString: string): boolean {
        return this._REGEX_ALTITUDE.test(altitudeString);
    }

    read(altitudeString: string): Altitude {
        const altitudeParts = this._REGEX_ALTITUDE.exec(altitudeString);
        if (altitudeParts == null) {
            throw new SyntaxError(`Unknown altitude definition '${altitudeString}'`);
        }
        const referenceDatum = altitudeParts[0];

        return { value: 0, unit: 'FT', referenceDatum };
    }
}

/**
 * Reads unlimited ceiling airspace definitions.
 */
class AltitudeUnlimitedReader extends AbstractAltitudeReader {
    constructor(config: AbstractAltitudeReaderConfig) {
        super(config);
        // unlimited ceiling definition
        this._REGEX_ALTITUDE = /^(UNL)$/;
    }

    canHandle(altitudeString: string): boolean {
        return this._REGEX_ALTITUDE.test(altitudeString);
    }

    read(altitudeString: string): Altitude {
        return { value: this._unlimited, unit: 'FL', referenceDatum: 'STD' };
    }
}
