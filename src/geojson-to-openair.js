const checkTypes = require('check-types');
const { sprintf } = require('sprintf-js');
const { randomUUID } = require('node:crypto');

/**
 * Converts a GeoJSON FeatureCollection created by parser instance to OpenAir format.
 *
 * @param {Object} featureCollection
 * @param {Object} [options]
 * @param {Object} [options.extendedFormat] - If true, exports to extended format. If read from original format, it will only add the "AI" tag.
 * @return {string[]}
 */
function geojsonToOpenair(featureCollection, options) {
    const defaultOptions = { extendedFormat: false };

    const { extendedFormat } = Object.assign(defaultOptions, options);

    checkTypes.assert.nonEmptyObject(featureCollection);
    checkTypes.assert.boolean(extendedFormat);

    const openair = [];
    for (const geojson of featureCollection.features) {
        const { name, class: aspcClass, lowerCeiling, upperCeiling, identifier, type, frequency } = geojson.properties;
        const { value: frequencyValue, name: frequencyName } = frequency || {};

        // if extended format is set as output format, at least inject an AI token if not exists
        const aiValue = identifier ?? randomUUID();

        const { coordinates: polyCoordinates } = geojson.geometry;
        // polygon coordinates are wrapped in array
        const [coordinates] = polyCoordinates;

        // AC
        openair.push(`AC ${aspcClass}`);
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

/**
 * @param {number[]} value
 * @return {string}
 * @private
 */
function toCoordinate(value) {
    const [x, y] = value;
    const lon = convertDecToDms(x, 'lon');
    const lat = convertDecToDms(y, 'lat');

    return `${lat} ${lon}`;
}

/**
 * @param {number} decimal
 * @param {string} axis
 * @return {string}
 * @private
 */
function convertDecToDms(decimal, axis) {
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

/**
 * @param {Object} value
 * @return {string}
 * @private
 */
function toAltLimit(value) {
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

module.exports = { geojsonToOpenair };
