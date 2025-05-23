#!/usr/bin/env node
import fs from 'node:fs';
import { Command } from 'commander';
import { ParserVersionEnum, type ParserVersion } from './parser-version.enum.js';
import { Parser } from './parser.js';
import type { ParserResult } from './parser.js';

const program = new Command();

program
    .option('--input-filepath <inFilepath>', 'The input file path to the openAIR file')
    .option('--output-filepath <outFilepath>', 'The output filename of the generated geojson file')
    .option('--validate', 'If specified, parser will validate geometries.')
    .option('--fix-geometry', 'If specified, parser will try to fix geometries.')
    .option('--version <version>', 'Specify OpenAIR format version to parse. Defaults to 2.')
    .parse(process.argv);

interface ProgramOptions {
    inputFilepath: string;
    outputFilepath: string;
    validate?: boolean;
    fixGeometry?: boolean;
    version?: ParserVersion;
}

const options = program.opts<ProgramOptions>();
const validateGeometry = options.validate ?? false;
const fixGeometry = options.fixGeometry ?? false;
const version = options.version ?? ParserVersionEnum.VERSION_2;
const parser = new Parser({ validateGeometry, fixGeometry, version });

try {
    const result: ParserResult = parser.parse(options.inputFilepath);
    if (result.success === false) {
        console.log(result.error.errorMessage);
        process.exit(1);
    }
    const geojson = parser.toGeojson();
    fs.writeFileSync(options.outputFilepath, Buffer.from(JSON.stringify(geojson, null, 2), 'utf-8'));
    console.log(`Successfully parsed ${geojson.features.length} airspaces`);
    process.exit(0);
} catch (error) {
    console.log(error.message);
    process.exit(1);
}
