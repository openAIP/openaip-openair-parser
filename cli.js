#!/usr/bin/env node

const Parser = require('./src/parser');
const program = require('commander');
const fs = require('node:fs');

program
    .option('-f, --input-filepath <inFilepath>', 'The input file path to the openAIR file')
    .option('-o, --output-filepath <outFilepath>', 'The output filename of the generated geojson file')
    .option('-V, --validate', 'If specified, parser will validate geometries.')
    .option('-F, --fix-geometry', 'If specified, parser will try to fix geometries.')
    .option('-E, --extended-format', 'If set to true, parser expects the extended OpenAIR format. Defaults to false.')
    .option(
        '-D, --debug',
        'If specified, returns a parser error if airspace file cannot be parsed. If not specified, simply returns 1 if parsing fails and 0 if parsing was successful.',
    )
    .parse(process.argv);

(async () => {
    const validateGeometry = program.validate || false;
    const fixGeometry = program.fixGeometry || false;
    const extendedFormat = program.extendedFormat || false;
    const debug = program.debug || false;

    const parser = new Parser({ validateGeometry, fixGeometry, extendedFormat });
    try {
        parser.parse(program.inputFilepath);
        const geojson = parser.toGeojson();
        fs.writeFileSync(program.outputFilepath, Buffer.from(JSON.stringify(geojson, null, 2), 'utf-8'));
        if (debug) console.log(`Successfully parsed ${geojson.features.length} airspaces`);
    } catch (e) {
        if (debug) console.log(e.message);

        return process.exit(1);
    }

    return process.exit(0);
})();
