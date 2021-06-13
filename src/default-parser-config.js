/**
 * Default parser configuration.
 *
 * @type {typedefs.openaipOpenairParser.ParserConfig}
 */
module.exports = {
    airspaceClasses: [
        // default ICAO classes
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        // classes commonly found in openair files
        'R',
        'Q',
        'D',
        'P',
        'GP',
        'WAVE',
        'W',
        'GLIDING',
        'RMZ',
        'TMZ',
        'CTR',
    ],
    unlimited: 999,
    geometryDetail: 100,
    keepOriginal: false,
    validateGeometry: true,
    fixGeometry: true,
};
