/**
 * Default parser configuration.
 *
 * @type {typedefs.openaip.OpenairParser.ParserConfig}
 */
module.exports = Object.freeze({
    // defines allowed airspace classes used with the AC token. This configuration option only applies if the
    // standard "non-extended" format is used, i.e. with the config parameter "extendedFormat: false".
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
        'P',
        'GP',
        'WAVE',
        'W',
        'GLIDING',
        'RMZ',
        'TMZ',
        'CTR',
    ],
    // If "true" the parser will be able to parse the extended OpenAIR-Format that contains additional tags
    // "AY", "AF", "AG" and "AI". If true, config parameters "allowedClassValues" and "allowedTypeValues" are
    // mandatory.
    extendedFormat: false,
    // defines a set of allowed values if the extended format is used -  default ICAO classes.
    extendedFormatClasses: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    // defines a set of allowed values if the extended format is used.
    extendedFormatTypes: ['R', 'Q', 'P', 'GP', 'WAVE', 'W', 'GLIDING', 'RMZ', 'TMZ', 'CTR'],
    // flight level value to set for upper ceilings defined as "UNLIMITED"
    unlimited: 999,
    // defines the level of detail (smoothness) of arc/circular geometries
    geometryDetail: 100,
    // if true, validates each built airspace geometry to be valid/simple geometry - also checks for self intersections
    validateGeometry: true,
    // If true, uses "convexHull" to fix an invalid geometry - note that this potentially alters the original airspace geometry!
    fixGeometry: false,
    // Sets the output geometry. Can be either "POLYGON" or "LINESTRING". Defaults to "POLYGON". "LINESTRING" can be used
    // to visualize invalid geometry definitions. Note that "validateGeometry" and "fixGeometry" has NO effect on "LINESTRING" geometry output!
    outputGeometry: 'POLYGON',
    // If true, the GeoJSON output will contain the original openair airspace definition block for each airspace. Note that this will considerably increase JSON object size!
    includeOpenair: false,
    // By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'.
    defaultAltUnit: 'ft',
    // Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. If not specified, parser will not convert units.
    targetAltUnit: null,
    // round altitude values
    roundAltValues: false,
});
