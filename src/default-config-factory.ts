import z from 'zod';
import { AltitudeUnitEnum, type AltitudeUnit } from './altitude-unit.enum.js';
import type { OutputGeometry } from './output-geometry.enum.js';
import { ParserVersionEnum, type ParserVersion } from './parser-version.enum.js';
import type { Config as ParserConfig } from './parser.js';
import { validateSchema } from './validate-schema.js';

export type DefaultConfig = {
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

/**
 * Default config for version 1.0 and 2.0 format definitions. If required, users can adjust each value as needed but if done so, format
 * specification requirements may not be met.
 */
export function defaultConfigFactory(version: ParserVersion): ParserConfig {
    validateSchema(version, z.nativeEnum(ParserVersionEnum), { assert: true, name: 'version' });

    // defines a set of common config parameters used in both v1 and v2
    const defaultConfig: Partial<DefaultConfig> = {
        // Defines the parser version to use. Defaults to version 2.
        version: ParserVersionEnum.VERSION_2,
        // Defines a set of allowed "AC" values. Defaults to all ICAO classes.
        allowedClasses: [],
        // Defines a set of allowed "AY" values if version 2 is used. If empty, allows all used types.
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
        targetAltUnit: AltitudeUnitEnum.FEET,
        // Round altitude values.
        roundAltValues: false,
        // If true, the GeoJSON output will contain the original openair airspace definition block for each airspace. Note that this will considerably increase JSON object size!
        includeOpenair: false,
    } as const;

    /*
    Version 1 does not provide the AY command and all classes and types are defined in the AC command.
    Set the allowed values according to the official schema definiation by default.
    */

    if (version === ParserVersionEnum.VERSION_1) {
        defaultConfig.allowedClasses = [
            // ICAO classes
            'A',
            'B',
            'C',
            'D',
            'E',
            'F',
            'G',
            // airspace types
            'AWY',
            'CTR',
            'GSEC',
            'MTMA',
            'GP',
            'P',
            'Q',
            'R',
            'RMZ',
            'TRA',
            'TMZ',
        ];
    }

    /*
    Version 2 does provide both the AC and AY tag. Set the allowed values according to the
    official schema definiation by default.
    */
    if (version === ParserVersionEnum.VERSION_2) {
        defaultConfig.allowedClasses = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'UNC'];
        defaultConfig.allowedTypes = [
            'ACCSEC',
            'ADIZ',
            'ALERT',
            'ASRA',
            'ATZ',
            'AWY',
            'CTA',
            'CTR',
            'CUSTOM',
            'FIR',
            'FIS',
            'GSEC',
            'HTZ',
            'LTA',
            'MATZ',
            'MTA',
            'MTR',
            'N',
            'NONE',
            'OFR',
            'P',
            'Q',
            'R',
            'RMZ',
            'TFR',
            'TIA',
            'TIZ',
            'TMA',
            'TMZ',
            'TRA',
            'TRAFR',
            'TRZ',
            'TSA',
            'UIR',
            'UTA',
            'VFRR',
            'VFRSEC',
            'WARNING',
        ];
    }

    return defaultConfig;
}
