import fs from 'node:fs';
import os from 'node:os';
import { convertBlocksInNode, type ConvertTask } from './concurrency/convert-blocks.js';
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
    // Controls worker usage for large files: 'auto' uses file size threshold; true forces workers; false disables workers
    useWorkers?: boolean | 'auto';
    // When > 0, simplifies output geometry using Turf with given tolerance in meters
    simplifyToleranceMeters?: number;
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
        useWorkers: z.union([z.boolean(), z.literal('auto')]).optional(),
        simplifyToleranceMeters: z.number().min(0).optional(),
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
    protected _config: Required<Config>;
    protected _airspaces: Airspace[] = [];
    protected _currentState: ParserState = ParserStateEnum.START;
    protected _currentToken: IToken | undefined = undefined;
    protected _airspaceTokens: IToken[] = [];
    protected _geojson: FeatureCollection<Polygon | LineString, AirspaceProperties> | undefined = undefined;

    constructor(config?: Config) {
        validateSchema(config, ConfigSchema, { assert: true, name: 'config' });

        this._config = { ...DefaultParserConfig, ...config } as Required<Config>;
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
                unlimited: this._config.unlimited,
                targetAltUnit: this._config.targetAltUnit,
                roundAltValues: this._config.roundAltValues,
                version: this._config.version,
                allowedClasses: this._config.allowedClasses,
                allowedTypes: this._config.allowedTypes,
            });
            const tokens = tokenizer.tokenize(filepath);

            // Decide processing strategy based on file size.
            const { size } = fs.statSync(filepath);
            const FIFTEEN_MB = 15 * 1024 * 1024;
            const useWorkers = this._config.useWorkers;
            const shouldProcessConcurrently = useWorkers === 'auto' ? size > FIFTEEN_MB : useWorkers === true;

            if (shouldProcessConcurrently) {
                const debug = process.env.OPENAIR_WORKER_DEBUG === '1';
                const log = (...args: unknown[]) => {
                    if (debug) console.log('[WorkerPool]', ...args);
                };
                log('Concurrent path enabled', { size, FIFTEEN_MB, useWorkers });
                // Split tokens into airspace blocks by AC boundaries and process in worker threads.
                const blocks: IToken[][] = [];
                let current: IToken[] = [];
                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i];
                    // skip ignored tokens to match sequential behavior
                    if (token.isIgnoredToken()) continue;
                    if (token instanceof AcToken) {
                        if (current.length > 0) {
                            blocks.push(current);
                            current = [];
                        }
                    }
                    if (token instanceof EofToken) {
                        if (current.length > 0) blocks.push(current);
                        break;
                    }
                    current.push(token);
                }
                if (current.length > 0) blocks.push(current);
                log('Blocks prepared', { blocks: blocks.length });
                const tasks: ConvertTask[] = blocks.map((block, id) => ({
                    id,
                    lines: block.map((t) => ({ line: t.line ?? (t.tokenized as any).line, lineNumber: (t.tokenized as any).lineNumber })),
                }));
                let features;
                try {
                    features = convertBlocksInNode(tasks, {
                    version: this._config.version,
                    allowedClasses: this._config.allowedClasses,
                    allowedTypes: this._config.allowedTypes,
                    unlimited: this._config.unlimited,
                    targetAltUnit: this._config.targetAltUnit,
                    roundAltValues: this._config.roundAltValues,
                    geometryDetail: this._config.geometryDetail,
                    validateGeometry: this._config.validateGeometry,
                    fixGeometry: this._config.fixGeometry,
                    includeOpenair: this._config.includeOpenair,
                    outputGeometry: this._config.outputGeometry,
                    consumeDuplicateBuffer: this._config.consumeDuplicateBuffer,
                    simplifyToleranceMeters: this._config.simplifyToleranceMeters,
                });
                } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Unknown concurrent conversion error';
                    throw new ParserError({ errorMessage: msg });
                }
                this._geojson = createFeatureCollection(features);
                const result: Partial<ParserResult> = { success: true };
                return result as ParserResult;
            } else {
                // Sequential processing (existing behavior)
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
            }

            // create airspaces as a GeoJSON feature collection and store them internally
            const geojsonAirspaces = this._airspaces.map((value) => {
                return value.asGeoJson({
                    validateGeometry: this._config.validateGeometry,
                    fixGeometry: this._config.fixGeometry,
                    includeOpenair: this._config.includeOpenair,
                    outputGeometry: this._config.outputGeometry,
                    consumeDuplicateBuffer: this._config.consumeDuplicateBuffer,
                    simplifyToleranceMeters: this._config.simplifyToleranceMeters,
                });
            });
            // create the feature collection
            this._geojson = createFeatureCollection(geojsonAirspaces);

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

    async parseAsync(filepath: string): Promise<ParserResult> {
        validateSchema(filepath, z.string().nonempty(), { assert: true, name: 'filepath' });
        this.enforceFileExists(filepath);
        try {
            this.reset();
            const tokenizer = new Tokenizer({
                unlimited: this._config.unlimited,
                targetAltUnit: this._config.targetAltUnit,
                roundAltValues: this._config.roundAltValues,
                version: this._config.version,
                allowedClasses: this._config.allowedClasses,
                allowedTypes: this._config.allowedTypes,
            });
            const tokens = tokenizer.tokenize(filepath);
            const blocks: IToken[][] = [];
            let current: IToken[] = [];
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (token.isIgnoredToken()) continue;
                if (token instanceof AcToken) {
                    if (current.length > 0) {
                        blocks.push(current);
                        current = [];
                    }
                }
                if (token instanceof EofToken) {
                    if (current.length > 0) blocks.push(current);
                    break;
                }
                current.push(token);
            }
            if (current.length > 0) blocks.push(current);
            if (blocks.length === 0) {
                this._geojson = createFeatureCollection([]);
                return { success: true } as ParserResult;
            }
            const { Worker } = await import('node:worker_threads');
            const workerUrl = new URL('./workers/airspace-worker.js', import.meta.url);
            const { cpus } = await import('node:os');
            const concurrency = Math.max(1, Math.min(cpus()?.length || 1, 8));
            const workerCount = Math.min(concurrency, blocks.length);
            const workers: InstanceType<typeof Worker>[] = Array.from({ length: workerCount }, () => new Worker(workerUrl));
            const tasks = blocks.map((block, id) => ({
                id,
                lines: block.map((t) => ({ line: t.line ?? (t.tokenized as any).line, lineNumber: (t.tokenized as any).lineNumber })),
                config: {
                    version: this._config.version,
                    allowedClasses: this._config.allowedClasses,
                    allowedTypes: this._config.allowedTypes,
                    unlimited: this._config.unlimited,
                    targetAltUnit: this._config.targetAltUnit,
                    roundAltValues: this._config.roundAltValues,
                    geometryDetail: this._config.geometryDetail,
                    validateGeometry: this._config.validateGeometry,
                    fixGeometry: this._config.fixGeometry,
                    includeOpenair: this._config.includeOpenair,
                    outputGeometry: this._config.outputGeometry,
                    consumeDuplicateBuffer: this._config.consumeDuplicateBuffer,
                    simplifyToleranceMeters: this._config.simplifyToleranceMeters,
                },
            }));
            const features: any[] = new Array(tasks.length);
            let next = 0;
            await new Promise<void>((resolve, reject) => {
                let remaining = tasks.length;
                const assign = (w: InstanceType<typeof Worker>) => {
                    if (next >= tasks.length) return;
                    const task = tasks[next++];
                    w.postMessage({ type: 'task', payload: task });
                };
                workers.forEach((w) => {
                    w.on('message', (msg: any) => {
                        const { id, feature, error } = msg || {};
                        if (error) {
                            workers.forEach((wk) => void wk.terminate());
                            reject(new ParserError({ errorMessage: String(error) }));
                            return;
                        }
                        if (id != null) {
                            features[id] = feature;
                            remaining--;
                            if (next < tasks.length) assign(w);
                            else if (remaining === 0) resolve();
                        }
                    });
                    w.on('error', (err) => {
                        workers.forEach((wk) => void wk.terminate());
                        reject(new ParserError({ errorMessage: err?.message || 'Worker error' }));
                    });
                    assign(w);
                });
            });
            workers.forEach((w) => void w.terminate());
            const validFeatures = features.filter((f) => f != null);
            this._geojson = createFeatureCollection(validFeatures);
            return { success: true } as ParserResult;
        } catch (err) {
            if (err instanceof ParserError) {
                return { success: false, error: err };
            }
            return { success: false, error: new ParserError({ errorMessage: 'Unhandled parser error' }) };
        }
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

    toGeojson(): FeatureCollection<Polygon | LineString, AirspaceProperties> {
        if (this._geojson == null) {
            throw new Error('No parser result found. Parse something first.');
        }

        return this._geojson;
    }

    toOpenair(): string[] {
        if (this._geojson == null) {
            throw new Error('No parser result found. Parse something first.');
        }

        return geojsonToOpenair(this._geojson, { version: this._config.version });
    }

    protected enforceFileExists(filepath: string): void {
        const exists = fs.existsSync(filepath);
        if (exists === false) {
            throw new Error(`Failed to read file ${filepath}`);
        }
    }

    /**
     * Builds airspace from the current list of airspace tokens.
     */
    protected buildAirspace(): void {
        const factory = new AirspaceFactory({
            geometryDetail: this._config.geometryDetail,
            version: this._config.version,
        });
        const airspace = factory.createAirspace(this._airspaceTokens);
        if (airspace != null) {
            // push new airspace to list
            this._airspaces.push(airspace);
        }
        // reset read airspace tokens
        this._airspaceTokens = [];
    }

    protected reset() {
        this._currentState = ParserStateEnum.START;
        this._airspaces = [];
        this._currentToken = undefined;
        this._airspaceTokens = [];
        this._geojson = undefined;
    }
}
