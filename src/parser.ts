import fs from 'node:fs';
import rewind from '@mapbox/geojson-rewind';
import { featureCollection as createFeatureCollection } from '@turf/turf';
import { z } from 'zod';
import { AirspaceFactory } from './airspace-factory.js';
import { AltitudeUnitEnum, type AltitudeUnit } from './altitude-unit.enum.js';
import { DefaultParserConfig } from './default-parser-config.js';
import { geojsonToOpenair } from './geojson-to-openair.js';
import { OutputGeometryEnum, type OutputGeometry } from './output-geometry.enum.js';
import { Tokenizer } from './tokenizer.js';
import type { IToken } from './tokens/abstract-line-token.js';
import { AcToken } from './tokens/ac-token.js';
import { EofToken } from './tokens/eof-token.js';
import { validateSchema } from './validate-schema.js';

// TODO defined better interface for parser -> where to put the ParserResult!?!?
export type ParserResult = {};

const ParserStateEnum = {
    START: 'start',
    READ: 'read',
    // End of file
    EOF: 'eof',
} as const;

export type ParserState = (typeof ParserStateEnum)[keyof typeof ParserStateEnum];

export type Config = {
    //A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
    airspaceClasses?: string[];
    // If "true" the parser will be able to parse the extended OpenAIR-Format that contains the additional tags.
    extendedFormat?: boolean;
    // Defines a set of allowed "AC" values if the extended format is used. Defaults to all ICAO classes.
    extendedFormatClasses?: string[];
    // Defines a set of allowed "AY" values if the extended format is used.
    extendedFormatTypes?: string[];
    // Defines the flight level that is used instead of an airspace ceiling that is defined as "unlimited". Defaults to 999;
    unlimited?: number;
    // Defines the steps that are used to calculate arcs and circles. Defaults to 50. Higher values mean smoother circles but a higher number of polygon points.
    geometryDetail?: number;
    // If true, the GeoJson features are validated. Parser will throw an error if an invalid geometry is found. Defaults to true.
    validateGeometry?: boolean;
    // If true, the build GeoJson features fixed if possible. Note this can potentially alter the original geometry shape. Defaults to false.
    fixGeometry?: boolean;
    // Sets the output geometry. Can be either "POLYGON" or "LINESTRING". Defaults to "POLYGON". "LINESTRING" can be used to visualize invalid geometry definitions.
    // Note that "validateGeometry" and "fixGeometry" has NO effect on "LINESTRING" geometry output!
    outputGeometry?: OutputGeometry;
    // If true, the GeoJSON output will contain the original openair airspace definition block for each airspace. Note that this will considerably increase JSON object size! Defaults to false.
    includeOpenair?: boolean;
    // By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'. Defaults to 'ft'.
    defaultAltUnit?: AltitudeUnit;
    // Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'. If not specified, keeps defined unit.
    targetAltUnit?: AltitudeUnit;
    // If true, rounds the altitude values. Defaults to false.
    roundAltValues?: boolean;
};

export const ConfigSchema = z
    .object({
        airspaceClasses: z.array(z.string().min(1)).optional(),
        extendedFormat: z.boolean().optional(),
        extendedFormatClasses: z.array(z.string().min(1)).optional(),
        extendedFormatTypes: z.array(z.string().min(1)).optional(),
        unlimited: z.number().int().min(1).optional(),
        geometryDetail: z.number().int().min(1).optional(),
        validateGeometry: z.boolean().optional(),
        fixGeometry: z.boolean().optional(),
        includeOpenair: z.boolean().optional(),
        defaultAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        targetAltUnit: z.nativeEnum(AltitudeUnitEnum).optional(),
        roundAltValues: z.boolean().optional(),
    })
    .strict()
    .optional()
    .describe('ConfigSchema');

/**
 * @typedef typedefs.openaip.OpenairParser.ParserResult
 * @type Object
 * @property {boolean} success - If true, parsing was successful, false if not.
 * @property {FeatureCollection} - [geojson] - On success, contains a GeoJson FeatureCollection representation of the parsed openAIR file.
 * @property {Array} [errors] - A list of errors if parsing was NOT successful.
 */

/**
 * Reads content of an openAIR formatted file and returns a GeoJSON representation.
 * Parser implements the openAIR specification according to https://github.com/naviter/seeyou_file_formats/blob/main/OpenAir_File_Format_Support.md
 */
export class Parser {
    protected _config: Required<Config>;
    // custom formatters
    protected _formatter = [];
    // TODO add type
    protected _airspaces = [];
    protected _currentState: ParserState = ParserStateEnum.START;
    protected _currentToken: IToken | undefined = undefined;
    protected _airspaceTokens: IToken[] = [];
    // TODO check if really both geom types apply -> FeatureCollection<Geometry, GeoJsonProperties>
    protected _geojson: any | undefined = undefined;

    constructor(config: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        this._config = { ...DefaultParserConfig, ...config } as Required<Config>;
    }

    async parse(filepath: string): Promise<Parser> {
        this.reset();
        this.enforceFileExists(filepath);
        /*
        Tokenizes the file contents into a list of tokens and a list of syntax
        errors encountered during tokenization. Each token represents a single line and holds a
        "prepared value" of each line, e.g. "DP 52:24:33 N 013:11:02 E" will be converted into
        a prepared value, i.e. object, that contains valid coordinate decimals.

        IMPORTANT If syntax errors occur, the parser will return the result of the tokenizer only.
         */
        const tokenizer = new Tokenizer({
            airspaceClasses: this._config.airspaceClasses,
            unlimited: this._config.unlimited,
            defaultAltUnit: this._config.defaultAltUnit,
            targetAltUnit: this._config.targetAltUnit,
            roundAltValues: this._config.roundAltValues,
            extendedFormat: this._config.extendedFormat,
            extendedFormatClasses: this._config.extendedFormatClasses,
            extendedFormatTypes: this._config.extendedFormatTypes,
        });
        const tokens = tokenizer.tokenize(filepath);

        // iterate over tokens and create airspaces
        for (let i = 0; i < tokens.length; i++) {
            this._currentToken = tokens[i];

            // do not change state if reading a comment or skipped token regardless of current state
            if (this._currentToken.isIgnoredToken()) continue;

            // AC tokens mark either start or end of airspace definition block
            if (this._currentToken instanceof AcToken) {
                if (this._currentState === ParserStateEnum.READ) {
                    // each new AC line will trigger an airspace build if parser is in READ state
                    // this is needed for files that do not have blanks between definition blocks but comments
                    this.buildAirspace();
                }
            }

            // handle EOF
            if (this._currentToken instanceof EofToken) {
                // if EOF is reached and parser is in READ state, check if we have any unprocessed airspace tokens
                // and if so, build the airspace
                if (this._currentState === ParserStateEnum.READ && this._airspaceTokens.length > 0) {
                    this.buildAirspace();
                    continue;
                }
            }

            this._currentState = ParserStateEnum.READ;
            // in all other cases, push token to airspace tokens list and continue
            this._airspaceTokens.push(this._currentToken);
        }

        // create airspaces as a GeoJSON feature collection and store them internally
        const geojsonFeatures = this._airspaces.map((value) => {
            // TODO check that this resolves when Airspace type is set
            return value.asGeoJson({
                validateGeometry: this._config.validateGeometry,
                fixGeometry: this._config.fixGeometry,
                includeOpenair: this._config.includeOpenair,
                outputGeometry: this._config.outputGeometry,
            });
        });
        // IMPORTANT make sure that GeoJSON polygons follow the right-hand rule
        this._geojson = rewind(createFeatureCollection(geojsonFeatures), false);

        return this;
    }

    /**
     * Builds airspace from the current list of airspace tokens.
     */
    protected buildAirspace(): void {
        const factory = new AirspaceFactory({
            geometryDetail: this._config.geometryDetail,
            extendedFormat: this._config.extendedFormat,
        });
        const airspace = factory.createAirspace(this._airspaceTokens);
        if (airspace != null) {
            // TODO check that this resolves when Airspace type is set
            // push new airspace to list
            this._airspaces.push(airspace);
        }
        // reset read airspace tokens
        this._airspaceTokens = [];
    }

    toFormat(format: string): string {
        switch (format) {
            case 'geojson':
                return JSON.stringify(this._geojson);
            case 'openair':
                return this.toOpenair().join('\n');
            default:
                throw new Error(`Unknown format '${format}'`);
        }
    }

    // TODO refine this -> why is the result HERE?!
    toGeojson(): ParserResult {
        if (this._geojson == null) {
            throw new Error('Failed to export to GeoJSON. Parsed GeoJSON is empty.');
        }
        return this._geojson;
    }

    toOpenair(): string[] {
        if (this._geojson == null) {
            throw new Error('Failed to export to OpenAIR. Parsed GeoJSON is empty.');
        }

        return geojsonToOpenair(this._geojson, { extendedFormat: this._config.extendedFormat });
    }

    protected async enforceFileExists(filepath: string): Promise<void> {
        const exists = fs.existsSync(filepath);
        if (!exists) {
            throw new Error(`Failed to read file ${filepath}`);
        }
    }

    protected reset() {
        this._currentState = ParserStateEnum.START;
        this._airspaces = [];
        this._currentToken = undefined;
        this._airspaceTokens = [];
        this._geojson = undefined;
    }
}
