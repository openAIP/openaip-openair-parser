/**
 * Default parser configuration.
 *
 * @type {typedefs.openaip.OpenairParser.ParserConfig}
 */
module.exports = {
    // defines allowed airspace classes used with the AC token
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
    // flight level value to set for upper ceilings defined as "UNLIMITED"
    unlimited: 999,
    // defines the level of detail (smoothness) of arc/circular geometries
    geometryDetail: 100,
    // if true, validates each built airspace geometry to be valid/simple geometry - also checks for self intersections
    validateGeometry: true,
    // if true, uses "convexHull" to fix an invalid geometry - note that this potentially alters the original airspace geometry!
    fixGeometry: false,
};
