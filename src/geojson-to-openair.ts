import { randomUUID } from 'node:crypto';
import type { FeatureCollection, LineString, Polygon, Position } from 'geojson';
import { sprintf } from 'sprintf-js';
import { z } from 'zod';
import type { AirspaceProperties } from './airspace.js';
import { validateSchema } from './validate-schema.js';

export type Options = { extendedFormat?: boolean };
export const OptionsSchema = z.object({
    // if true, exports to extended format. If read from original format, it will only add the "AI" tag.
    extendedFormat: z.boolean().optional(),
});

/**
 * Converts a GeoJSON FeatureCollection created by parser instance to OpenAir format.
 */
export function geojsonToOpenair(
    featureCollection: FeatureCollection<Polygon | LineString, AirspaceProperties>,
    options?: Options
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

    const defaultOptions = { extendedFormat: false };
    const { extendedFormat } = Object.assign(defaultOptions, options);
    const openair = [];

    for (const geojson of featureCollection.features) {
        const { name, class: airspaceClass, lowerCeiling, upperCeiling, id, type, frequency } = geojson.properties;
        const { value: frequencyValue, name: frequencyName } = frequency || {};

        // if extended format is set as output format, at least inject an AI token if not exists
        const aiValue = id ?? randomUUID();
        const { type: geomType, coordinates: geomCoordinates } = geojson.geometry;
        let coordinates: Position[];
        // unwrap polygon coordinates that are wrapped in array
        if (geomType === 'Polygon') {
            coordinates = geomCoordinates[0];
        } else {
            // line string coordinates are already unwrapped
            coordinates = geomCoordinates;
        }

        // AC
        openair.push(`AC ${airspaceClass}`);
        // AY (extended format) - optional tag
        if (extendedFormat && type != null) openair.push(`AY ${type}`);
        // AN
        openair.push(`AN ${name.toUpperCase()}`);
        // AI (extended format) - required tag
        if (extendedFormat) openair.push(`AI ${aiValue}`);
        // AF (extended format) - optional tag
        if (extendedFormat && frequencyValue != null) openair.push(`AF ${frequencyValue}`);
        // AG (extended format) - optional tag
        if (extendedFormat && frequencyName != null) openair.push(`AG ${frequencyName}`);
        // AL
        openair.push(`AL ${toAltLimit(lowerCeiling)}`);
        // AH
        openair.push(`AH ${toAltLimit(upperCeiling)}`);
        // DPs
        for (const coord of coordinates) {
            openair.push(`DP ${toCoordinate(coord)}`);
        }
        // add spacer between airspace definition blocks
        openair.push('');
    }

    return openair;
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
        if (referenceDatum === 'GND' && altValue === 0) {
            altLimit = referenceDatum;
        } else {
            altLimit = `${altValue}${unit} ${referenceDatum}`;
        }
    }

    return altLimit;
}
