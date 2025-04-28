import { type AltitudeUnit } from './altitude-unit.enum.js';
import type { OutputGeometry } from './output-geometry.enum.js';
import { ParserVersionEnum, type ParserVersion } from './parser-version.enum.js';

type DefaultConfig = {
    version: ParserVersion;
    allowedClasses: string[];
    allowedTypes: string[];
    unlimited: number;
    geometryDetail: number;
    consumeDuplicateBuffer: number;
    validateGeometry: boolean;
    fixGeometry: boolean;
    outputGeometry: OutputGeometry;
    targetAltUnit: AltitudeUnit | undefined;
    roundAltValues: boolean;
    includeOpenair: boolean;
};

export const DefaultParserConfig: DefaultConfig = {
    // Defines the parser version to use. Defaults to version 2.
    version: ParserVersionEnum.VERSION_2,
    // Defines a set of allowed "AC" values. Defaults to all ICAO classes.
    allowedClasses: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'UNCLASSIFIED'],
    // Defines a set of allowed "AY" values if version 2 is used. Otherwise, allows all used types.
    allowedTypes: [],
    // Flight level value to set for upper ceilings defined as "UNLIMITED".
    unlimited: 999,
    // Defines the level of detail (smoothness) of arc/circular geometries.
    geometryDetail: 100,
    // Defines the minimum distance between two points in meters. If two points are closer than this value, they will be merged into one point. Defaults to 0.
    consumeDuplicateBuffer: 0,
    // If true, validates each built airspace geometry to be valid/simple geometry - also checks for self intersections.
    validateGeometry: true,
    // If true, tries to fix an invalid geometry - note that this potentially alters the original airspace geometry!
    fixGeometry: false,
    // Sets the output geometry. Can be either "POLYGON" or "LINESTRING". Defaults to "POLYGON". "LINESTRING" can be used
    // to visualize invalid geometry definitions. Note that "validateGeometry" and "fixGeometry" has NO effect on "LINESTRING" geometry output!
    outputGeometry: 'POLYGON',
    // Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. If not specified, parser will not convert units.
    targetAltUnit: undefined,
    // Round altitude values.
    roundAltValues: false,
    // If true, the GeoJSON output will contain the original openair airspace definition block for each airspace. Note that this will considerably increase JSON object size!
    includeOpenair: false,
} as const;
