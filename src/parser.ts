import fs from 'node:fs';
import { featureCollection as createFeatureCollection } from '@turf/turf';
import type { FeatureCollection, LineString, Polygon } from 'geojson';
import { z } from 'zod';
import { AirspaceFactory } from './airspace-factory.js';
import type { Airspace, AirspaceProperties } from './airspace.js';
import { AltitudeUnitEnum, type AltitudeUnit } from './altitude-unit.enum.js';
import { DefaultParserConfig } from './default-parser-config.js';
import { geojsonToOpenair } from './geojson-to-openair.js';
import { OutputGeometryEnum, type OutputGeometry } from './output-geometry.enum.js';
import { ParserError } from './parser-error.js';
import { ParserVersionEnum, type ParserVersion } from './parser-version.enum.js';
import { Tokenizer } from './tokenizer.js';
import type { IToken } from './tokens/abstract-line-token.js';
import { AcToken } from './tokens/ac-token.js';
import { EofToken } from './tokens/eof-token.js';
import { validateSchema } from './validate-schema.js';

const ParserStateEnum = {
    START: 'start',
    READ: 'read',
    // End of file
    EOF: 'eof',
} as const;

export type ParserState = (typeof ParserStateEnum)[keyof typeof ParserStateEnum];

export type Config = {
    // If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
    version?: ParserVersion;
    // Defines a set of allowed "AC" values. Defaults to all ICAO classes.
    allowedClasses?: string[];
    // Defines a set of allowed "AY" values if the version 2 is used.
    allowedTypes?: string[];
    // Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
    unlimited?: number;
    // Defines the steps that are used to calculate arcs and circles. Defaults to 50. Higher values mean smoother circles but a higher number of polygon points.
    geometryDetail?: number;
    // Defines the minimum distance between two points in meters. If two points are closer than this value, they will be merged into one point. Defaults to 0.
    consumeDuplicateBuffer?: number;
    // If true, the GeoJson features are validated. Parser will throw an error if an invalid geometry is found. Defaults to true.
    validateGeometry?: boolean;
    // If true, the build GeoJson features fixed if possible. Note this can potentially alter the original geometry shape. Defaults to false.
    fixGeometry?: boolean;
    // Sets the output geometry. Can be either "POLYGON" or "LINESTRING". Defaults to "POLYGON". "LINESTRING" can be used to visualize invalid geometry definitions.
    // Note that "validateGeometry" and "fixGeometry" has NO effect on "LINESTRING" geometry output!
    outputGeometry?: OutputGeometry;
    // If true, the GeoJSON output will contain the original openair airspace definition block for each airspace. Note that this will considerably increase JSON object size! Defaults to false.
    includeOpenair?: boolean;
    // Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. If not specified, keeps defined unit.
    targetAltUnit?: AltitudeUnit | undefined;
    // If true, rounds the altitude values. Defaults to false.
    roundAltValues?: boolean;
};

export const ConfigSchema = z
    .object({
        version: z.nativeEnum(ParserVersionEnum).optional(),
        allowedClasses: z.array(z.string().min(1)).optional(),
        allowedTypes: z.array(z.string().min(1)).optional(),
        unlimited: z.number().int().min(1).optional(),
        geometryDetail: z.number().int().min(1).optional(),
        consumeDuplicateBuffer: z.number().min(0).optional(),
        validateGeometry: z.boolean().optional(),
        fixGeometry: z.boolean().optional(),
        includeOpenair: z.boolean().optional(),
        outputGeometry: z.nativeEnum(OutputGeometryEnum).optional(),
        targetAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        roundAltValues: z.boolean().optional(),
    })
    .strict()
    .optional()
    .describe('ConfigSchema');

export type ParserResult = { success: true; error?: never } | { success: false; error: ParserError };

/**
 * Reads content of an openAIR formatted file and returns a GeoJSON representation.
 * Parser implements the openAIR specification according to https://github.com/naviter/seeyou_file_formats/blob/main/OpenAir_File_Format_Support.md
 */
export class Parser {
    public readonly config: Required<Config>;
    protected airspaces: Airspace[] = [];
    protected currentState: ParserState = ParserStateEnum.START;
    protected currentToken: IToken | undefined = undefined;
    protected geojson: FeatureCollection<Polygon | LineString, AirspaceProperties> | undefined = undefined;

    constructor(config?: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        this.config = { ...DefaultParserConfig, ...config } as Required<Config>;
    }

    parse(filepath: string): ParserResult {
        validateSchema(filepath, z.string().nonempty(), { assert: true, name: 'filepath' });

        // hard fail if file does not exist
        this.enforceFileExists(filepath);

        try {
            this.reset();
            /*
            Tokenizes the file contents into a list of tokens and a list of syntax
            errors encountered during tokenization. Each token represents a single line and holds a
            "prepared value" of each line, e.g. "DP 52:24:33 N 013:11:02 E" will be converted into
            a prepared value, i.e. object, that contains valid coordinate decimals.

            IMPORTANT If syntax errors occur, the parser will return the result of the tokenizer only.
            */
            const tokenizer = new Tokenizer({
                unlimited: this.config.unlimited,
                targetAltUnit: this.config.targetAltUnit,
                roundAltValues: this.config.roundAltValues,
                version: this.config.version,
                allowedClasses: this.config.allowedClasses,
                allowedTypes: this.config.allowedTypes,
            });
            const tokens = tokenizer.tokenize(filepath);

            let airspaceTokens: IToken[] = [];
            // iterate over tokens and create airspaces
            for (let i = 0; i < tokens.length; i++) {
                this.currentToken = tokens[i];

                // do not change state if reading a comment or skipped token regardless of current state
                if (this.currentToken.isIgnoredToken()) continue;

                // AC tokens mark either start or end of airspace definition block
                if (this.currentToken instanceof AcToken) {
                    if (this.currentState === ParserStateEnum.READ) {
                        // each new AC line will trigger an airspace build if parser is in READ state
                        // this is needed for files that do not have blanks between definition blocks but comments
                        this.buildAirspace(airspaceTokens);
                        airspaceTokens = [];
                    }
                }

                // handle EOF
                if (this.currentToken instanceof EofToken) {
                    // if EOF is reached and parser is in READ state, check if we have any unprocessed airspace tokens
                    // and if so, build the airspace
                    if (this.currentState === ParserStateEnum.READ && airspaceTokens.length > 0) {
                        this.buildAirspace(airspaceTokens);
                        airspaceTokens = [];
                        continue;
                    }
                }

                this.currentState = ParserStateEnum.READ;
                // in all other cases, push token to airspace tokens list and continue
                airspaceTokens.push(this.currentToken);
            }

            // create airspaces as a GeoJSON feature collection and store them internally
            const geojsonAirspaces = this.airspaces.map((value) => {
                return value.asGeoJson({
                    validateGeometry: this.config.validateGeometry,
                    fixGeometry: this.config.fixGeometry,
                    includeOpenair: this.config.includeOpenair,
                    outputGeometry: this.config.outputGeometry,
                    consumeDuplicateBuffer: this.config.consumeDuplicateBuffer,
                });
            });
            // create the feature collection
            this.geojson = createFeatureCollection(geojsonAirspaces);

            const result: Partial<ParserResult> = {
                success: true,
            };

            return result as ParserResult;
        } catch (err) {
            if (err instanceof ParserError) {
                return {
                    success: false,
                    error: err,
                };
            } else {
                return {
                    success: false,
                    error: new ParserError({ errorMessage: 'Unhandled parser error' }),
                };
            }
        }
    }

    toFormat(format: string): string {
        switch (format) {
            case 'geojson':
                return JSON.stringify(this.geojson);
            case 'openair':
                return this.toOpenair().join('\n');
            default:
                throw new Error(`Unknown format '${format}'`);
        }
    }

    toGeojson(): FeatureCollection<Polygon | LineString, AirspaceProperties> {
        if (this.geojson == null) {
            throw new Error('No parser result found. Parse something first.');
        }

        return this.geojson;
    }

    toOpenair(): string[] {
        if (this.geojson == null) {
            throw new Error('No parser result found. Parse something first.');
        }

        return geojsonToOpenair(this.geojson, { version: this.config.version });
    }

    protected enforceFileExists(filepath: string): void {
        const exists = fs.existsSync(filepath);
        if (exists === false) {
            throw new Error(`Failed to read file ${filepath}`);
        }
    }

    /**
     * Builds airspace from a given list of airspace tokens.
     */
    protected buildAirspace(airspaceTokens: IToken[]): void {
        const factory = new AirspaceFactory({
            geometryDetail: this.config.geometryDetail,
            version: this.config.version,
        });
        const airspace = factory.createAirspace(airspaceTokens);
        if (airspace != null) {
            // push new airspace to list
            this.airspaces.push(airspace);
        }
    }

    protected reset() {
        this.currentState = ParserStateEnum.START;
        this.airspaces = [];
        this.currentToken = undefined;
        this.geojson = undefined;
    }
}
