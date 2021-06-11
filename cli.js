#!/usr/bin/env node

const Parser = require('./src/parser');
const program = require('commander');
const fs = require('fs');

program
    .option('-f, --input-filepath <inFilepath>', 'The input file path to the openAIR file')
    .option('-o, --output-filepath <outFilepath>', 'The output filename of the generated geojson file')
    .parse(process.argv);

(async () => {
    const parser = new Parser();
    const result = await parser.parse(program.inputFilepath);

    const { success, errors, geojson } = result;
    if (success) {
        await fs.writeFileSync(program.outputFilepath, Buffer.from(JSON.stringify(geojson, null, 2), 'utf-8'));
    } else {
        for (const error of errors) {
            console.log(error);
        }
    }
})();
