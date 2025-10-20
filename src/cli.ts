#!/usr/bin/env node
import fs from 'node:fs';
import { Command } from 'commander';
import type { ParserResult } from './parser.js';
import { Parser } from './parser.js';
import { type ParserVersion, ParserVersionEnum } from './parser-version.enum.js';

const program = new Command();

program
    .requiredOption('--input-filepath <inputFilepath>', 'The input file path to the openAIR file')
    .requiredOption('--output-filepath <outputFilepath>', 'The output filename of the generated geojson file')
    .option('--validate', 'If specified, parser will validate geometries.')
    .option('--fix-geometry', 'If specified, parser will try to fix geometries.')
    .option(
        '--version <version>',
        `Specify OpenAIR format version to parse. Available versions are '${ParserVersionEnum.VERSION_1}' and '${ParserVersionEnum.VERSION_2}' Defaults to '${ParserVersionEnum.VERSION_2}'.`
    )
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

console.log(options);

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
} catch (err) {
    let errorMessage = 'Unknown error occured';
    if (err instanceof Error) {
        errorMessage = err.message;
    }
    console.log(errorMessage);
    process.exit(1);
}
