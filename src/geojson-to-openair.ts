import type { FeatureCollection, LineString, Polygon, Position } from 'geojson';
import { sprintf } from 'sprintf-js';
import { z } from 'zod';
import type { Activation, AirspaceProperties } from './airspace.js';
import { AltitudeReferenceDatumEnum } from './altitude-reference-datum.enum.js';
import { type ParserVersion, ParserVersionEnum } from './parser-version.enum.js';
import { validateSchema } from './validate-schema.js';

export type Options = { version?: ParserVersion };
export const OptionsSchema = z.object({
    version: z.nativeEnum(ParserVersionEnum),
});

/**
 * Converts a GeoJSON FeatureCollection created by parser instance to OpenAir format.
 */
export function geojsonToOpenair(
    featureCollection: FeatureCollection<Polygon | LineString, AirspaceProperties>,
    options: Options
): string[] {
    validateSchema(
        featureCollection,
        z.object({
            type: z.literal('FeatureCollection'),
            features: z.array(z.record(z.any())),
        }),
        { assert: true, name: 'featureCollection' }
    );
    validateSchema(options, OptionsSchema, { assert: true, name: 'options' });

    const { version } = options;
    const openair = [];

    for (const geojson of featureCollection.features) {
        const {
            name,
            class: airspaceClass,
            lowerCeiling,
            upperCeiling,
            id,
            type,
            frequency,
            transponderCode,
            activationTimes,
        } = geojson.properties;
        const { value: frequencyValue, name: frequencyName } = frequency || {};

        const { type: geomType, coordinates: geomCoordinates } = geojson.geometry;
        let coordinates: Position[];
        // unwrap polygon coordinates that are wrapped in array
        if (geomType === 'Polygon') {
            coordinates = geomCoordinates[0];
        } else {
            // line string coordinates are already unwrapped
            coordinates = geomCoordinates;
        }
        // add the version header comment depending on which version is used
        if (version === ParserVersionEnum.VERSION_2) {
            openair.push(`* Version 2.0, Copyright © ${new Date().getFullYear()}, Naviter d.o.o. All Rights Reserved`);
        } else {
            openair.push(`* Version 1.0, Copyright © ${new Date().getFullYear()}, Naviter d.o.o. All Rights Reserved`);
        }
        openair.push('');
        // AC: Version 1 / Version 2 - required command
        openair.push(`AC ${airspaceClass}`);
        // AY: Version 2 - required command
        if (version === ParserVersionEnum.VERSION_2 && type != null) openair.push(`AY ${type}`);
        // AN: Version 1 / Version 2 - required command
        openair.push(`AN ${name.toUpperCase()}`);
        // AF: Version 2 - optional command
        if (version === ParserVersionEnum.VERSION_2 && frequencyValue != null) openair.push(`AF ${frequencyValue}`);
        // AG: Version 2 - optional command
        if (version === ParserVersionEnum.VERSION_2 && frequencyName != null) openair.push(`AG ${frequencyName}`);
        // AX: Version 2 - optional command
        if (version === ParserVersionEnum.VERSION_2 && transponderCode != null) openair.push(`AX ${transponderCode}`);
        // AA Version 2 - optional command
        if (version === ParserVersionEnum.VERSION_2 && Array.isArray(activationTimes) && activationTimes?.length > 0) {
            for (const time of activationTimes) {
                openair.push(`AA ${toActivationTime(time)}`);
            }
        }
        // AL: Version 1 / Version 2 - required command
        openair.push(`AL ${toAltLimit(lowerCeiling)}`);
        // AH: Version 1 / Version 2 - required command
        openair.push(`AH ${toAltLimit(upperCeiling)}`);
        // DPs: Version 1 / Version 2 - required commands
        for (const coord of coordinates) {
            openair.push(`DP ${toCoordinate(coord)}`);
        }
        // add spacer between airspace definition blocks
        openair.push('');
    }

    return openair;
}

function toActivationTime(activation: Activation): string {
    const { start, end } = activation;
    const activationTimeParts = [];

    if (start == null) {
        activationTimeParts.push('NONE');
    } else {
        // The date is already in ISO format with Z suffix, just replace milliseconds with Z
        activationTimeParts.push(start.replace(/\.\d{3}Z$/, 'Z'));
    }

    if (end == null) {
        activationTimeParts.push('NONE');
    } else {
        // The date is already in ISO format with Z suffix, just replace milliseconds with Z
        activationTimeParts.push(end.replace(/\.\d{3}Z$/, 'Z'));
    }

    return activationTimeParts.join('/');
}

function toCoordinate(value: Position): string {
    const [x, y] = value;
    const lon = convertDecToDms(x, 'lon');
    const lat = convertDecToDms(y, 'lat');

    return `${lat} ${lon}`;
}

function convertDecToDms(decimal: number, axis: string): string {
    const degFormat = axis === 'lon' ? '%03d' : '%02d';
    //we only handle positive values
    const posDegs = Math.abs(decimal);
    // The whole units of degrees will remain the same (i.e. in 121.135° longitude, start with 121°)
    const deg = sprintf(degFormat, Math.floor(posDegs));
    // Multiply the decimal by 60 (i.e. .135 * 60 = 8.1).
    const degDecimalX60 = (posDegs % 1) * 60;
    // The whole number becomes the minutes (8').
    const min = sprintf('%02d', Math.floor(degDecimalX60));
    // Take the remaining decimal and multiply by 60. (i.e. .1 * 60 = 6).
    // The resulting number becomes the seconds (6"). Seconds can remain as a decimal.
    const sec = sprintf('%02d', Math.round((degDecimalX60 % 1) * 60));
    let suffix;
    if (axis === 'lon') {
        suffix = decimal >= 0 ? 'E' : 'W';
    } else {
        suffix = decimal >= 0 ? 'N' : 'S';
    }
    return `${deg}:${min}:${sec} ${suffix}`;
}

function toAltLimit(value: { value: number; unit: string; referenceDatum: string }): string {
    const { value: altValue, unit, referenceDatum } = value;

    let altLimit;
    if (unit === 'FL') {
        altLimit = `FL${altValue}`;
    } else {
        // handle GND values
        if (referenceDatum === AltitudeReferenceDatumEnum.GROUND && altValue === 0) {
            altLimit = 'GND';
        } else {
            // handle MSL values
            if (referenceDatum === AltitudeReferenceDatumEnum.MAIN_SEA_LEVEL) {
                altLimit = `${altValue}${unit} AMSL`;
            } else if (referenceDatum === AltitudeReferenceDatumEnum.GROUND) {
                altLimit = `${altValue}${unit} AGL`;
            } else {
                altLimit = `${altValue}${unit} ${referenceDatum}`;
            }
        }
    }

    return altLimit;
}
