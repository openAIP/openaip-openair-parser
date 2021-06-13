#!/usr/bin/env node

const Parser = require('./src/parser');
const program = require('commander');
const fs = require('fs');

program
    .option('-f, --input-filepath <inFilepath>', 'The input file path to the openAIR file')
    .option('-o, --output-filepath <outFilepath>', 'The output filename of the generated geojson file')
    .option(
        '-V, --validate-geometry',
        'If set to true, validates geometries. Defaults to true.',
        true
    )
    .option(
        '-F, --fix-geometry',
        'If set to true, tries to fix geometries. Defaults to false.',
        false
    )
    .parse(process.argv);

(async () => {

    // console.log(program);
    console.log(program.validateGeometry);
    console.log(program.fixGeometry);

    const parser = new Parser({ validateGeometry: program.validateGeometry, fixGeometry: program.fixGeometry });
    try {
        await parser.parse(program.inputFilepath);
        const geojson = parser.toGeojson();
        await fs.writeFileSync(program.outputFilepath, Buffer.from(JSON.stringify(geojson, null, 2), 'utf-8'));
    } catch (e) {
        console.log(e.message);
    }
})();
