#!/usr/bin/env node
import fs from 'node:fs';
import { Command } from 'commander';
import { Parser } from './parser.js';
import type { ParserResult } from './parser.js';

const program = new Command();

program
    .option('-f, --input-filepath <inFilepath>', 'The input file path to the openAIR file')
    .option('-o, --output-filepath <outFilepath>', 'The output filename of the generated geojson file')
    .option('-V, --validate', 'If specified, parser will validate geometries.')
    .option('-F, --fix-geometry', 'If specified, parser will try to fix geometries.')
    .option('-E, --extended-format', 'If set to true, parser expects the extended OpenAIR format. Defaults to false.')
    .parse(process.argv);

interface ProgramOptions {
    inputFilepath: string;
    outputFilepath: string;
    validate?: boolean;
    fixGeometry?: boolean;
    extendedFormat?: boolean;
}

const options = program.opts<ProgramOptions>();
const validateGeometry = options.validate ?? false;
const fixGeometry = options.fixGeometry ?? false;
const extendedFormat = options.extendedFormat ?? false;
const parser = new Parser({ validateGeometry, fixGeometry, extendedFormat });

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
