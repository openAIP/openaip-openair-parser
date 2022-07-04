#!/usr/bin/env node

const Parser = require('./src/parser');
const program = require('commander');
const fs = require('node:fs');

program
    .option('-f, --input-filepath <inFilepath>', 'The input file path to the openAIR file')
    .option('-o, --output-filepath <outFilepath>', 'The output filename of the generated geojson file')
    .option('-V, --validate', 'If set to true, validates geometries. Defaults to true.')
    .option('-F, --fix-geometry', 'If set to true, tries to fix geometries. Defaults to false.')
    .parse(process.argv);

(async () => {
    const validateGeometry = program.validateGeometry || true;
    const fixGeometry = program.fixGeometry || false;

    const parser = new Parser({ validateGeometry, fixGeometry });
    try {
        await parser.parse(program.inputFilepath);
        const geojson = parser.toGeojson();
        console.log(`Successfully parsed ${geojson.features.length} airspaces`);
        await fs.writeFileSync(program.outputFilepath, Buffer.from(JSON.stringify(geojson, null, 2), 'utf-8'));
    } catch (e) {
        console.log(e.message);
    }
})();
