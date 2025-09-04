# OpenAIR Format Parser

A highly configurable [OpenAIR](https://github.com/naviter/seeyou_file_formats/blob/main/OpenAir_File_Format_Support.md) parser for Node. The parser can also
be configured to validate and fix the parsed airspace geometries. Both the original `version 1` and the extended `version 2` of the OpenAIR format are supported.

### Reads original OpenAIR version 1 airspace definitions:

```text
AC R
AN ED-R10B Todendorf-Putlos MON-SAT+
AH 40000ft AMSL
AL GND
DP 54:25:00 N 010:40:00 E
DP 54:25:00 N 010:50:00 E
DP 54:26:00 N 010:53:00 E
DP 54:19:30 N 010:53:00 E
DP 54:15:00 N 010:41:00 E
DP 54:15:19 N 010:40:00 E
DP 54:20:00 N 010:40:00 E
DP 54:25:00 N 010:40:00 E
```

Outputs GeoJSON FeatureCollection:

```json
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "id": "b3836bab-6bc3-48c1-b918-01c2559e26fa",
                "name": "ED-R10B Todendorf-Putlos MON-SAT+",
                "class": "R",
                "upperCeiling": {
                    "value": 40000,
                    "unit": "FT",
                    "referenceDatum": "MSL"
                },
                "lowerCeiling": {
                    "value": 0,
                    "unit": "FT",
                    "referenceDatum": "GND"
                }
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [10.666666666666666, 54.416666666666664],
                        [10.833333333333334, 54.416666666666664],
                        [10.883333333333333, 54.43333333333333],
                        [10.883333333333333, 54.325],
                        [10.683333333333334, 54.25],
                        [10.666666666666666, 54.25527777777778],
                        [10.666666666666666, 54.333333333333336],
                        [10.666666666666666, 54.416666666666664]
                    ]
                ]
            }
        }
    ]
}
```

### Reads extended OpenAIR Version 2 airspace definitions:

```text
AC D
AY TMA
AN TMA Todendorf-Putlos
AF 123.505
AG Todendorf Information
AX 7000
AA 2025-01-01T12:00Z/2025-01-01T13:00Z
AA 2025-01-02T14:00Z/2025-01-01T15:00Z
AA NONE/2025-02-02T12:00Z
AA 2025-03-03T12:00/NONE
AH 40000ft AMSL
AL GND
DP 54:25:00 N 010:40:00 E
DP 54:25:00 N 010:50:00 E
DP 54:26:00 N 010:53:00 E
DP 54:19:30 N 010:53:00 E
DP 54:15:00 N 010:41:00 E
DP 54:15:19 N 010:40:00 E
DP 54:20:00 N 010:40:00 E
DP 54:25:00 N 010:40:00 E
```

Outputs GeoJSON FeatureCollection:

```json
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "id": "b3836bab-6bc3-48c1-b918-01c2559e26fa",
                "name": "TMA Todendorf-Putlos",
                "class": "D",
                "type": "TMA",
                "frequency": {
                    "value": "123.505",
                    "name": "Todendorf Information"
                },
                "transponderCode": 7000,
                "upperCeiling": {
                    "value": 40000,
                    "unit": "FT",
                    "referenceDatum": "MSL"
                },
                "lowerCeiling": {
                    "value": 0,
                    "unit": "FT",
                    "referenceDatum": "GND"
                },
                "byNotam": false,
                "activationTimes": [
                    {
                        "start": "2025-01-01T12:00:00Z",
                        "end": "2025-01-01T13:00:00Z"
                    },
                    {
                        "start": "2025-01-01T14:00:00Z",
                        "end": "2025-01-01T15:00:00Z"
                    },
                    {
                        "end": "2025-02-02T12:00:00Z"
                    },
                    {
                        "start": "2025-03-03T11:00:00Z"
                    }
                ]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [10.666666666666666, 54.416666666666664],
                        [10.833333333333334, 54.416666666666664],
                        [10.883333333333333, 54.43333333333333],
                        [10.883333333333333, 54.325],
                        [10.683333333333334, 54.25],
                        [10.666666666666666, 54.25527777777778],
                        [10.666666666666666, 54.333333333333336],
                        [10.666666666666666, 54.416666666666664]
                    ]
                ]
            }
        }
    ]
}
```

# Install

```shell
npm install @openaip/openair-parser
```

#### ESM only package

This is an ESM only package that requires Node 22 thus allowing CommonJS consumers to `require` it if necessary.

# Usage

```javascript
// import parser
import { Parser } from '@openaip/openair-parser';

/*
 The default parser configuration for reference.
 */
const config = {
    // Defines the OpenAIR format version 2. Defaults to strict version 2 parsing.
    version: 2,
    // Defines a set of allowed values -  default ICAO classes.
    allowedClasses: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'UNCLASSIFIED'],
    // Defines a set of allowed "AY" values if version 2 is used. If empty, allows all used types.
    allowedTypes: [],
    // Flight level value to set for upper ceilings defined as "UNLIMITED"
    unlimited: 999,
    // Defines the level of detail (smoothness) of arc/circular geometries
    geometryDetail: 100,
    // If true, validates each built airspace geometry to be valid/simple geometry - also checks for self intersections
    validateGeometry: true,
    // If true, uses "convexHull" to fix an invalid geometry - note that this may change the original airspace geometry!
    fixGeometry: false,
    // Defines the minimum distance between two points in meters. If two points are closer than this value, they will be merged into one point. Defaults to 0.
    consumeDuplicateBuffer: 0,
    // Sets the output geometry. Can be either "POLYGON" or "LINESTRING". Defaults to "POLYGON". "LINESTRING" can be used
    // to visualize invalid geometry definitions. Note that "validateGeometry" and "fixGeometry" has NO effect on "LINESTRING" geometry output!
    outputGeometry: 'POLYGON',
    // Round altitude values
    roundAltValues: false,
    // If true, the GeoJSON output will contain the original OpenAIR airspace definition block for each airspace.
    // Note that this will considerably increase JSON object size!
    includeOpenair: false,
};

const parser = new Parser(config);
const { success, error } = parser.parse('./path/to/openair-file.txt');
if (success === true) {
    // get parse OpenAIR definitions as validated GeoJSON feature collection
    const geojson = parser.toGeojson();
} else {
    // if not successful, the parser will return a ParserError instance
    const {
        // the name of the airspace where the error occurred
        name,
        // the line number where the error occurred
        lineNumber,
        // the fully build error message for this error
        errorMessage,
        // a LineString geometry that can be used to visualize the invalid geometry
        geometry,
        // if self intersections are found, they are presented as an array of "[lon, lat]"
        selfIntersections,
    } = error;
}
```

## Considerations when parsing big OpenAIR files

OpenAIR files come in different file sizes and some of them are several MBs in size. The parser is able to parse those files in an
efficient way but it will take a considerable amount of time for big files while blocking the main thread.
To drastically reduce the processing time for those files and also parse in a non-blocking way,
Node's **worker threads** or the browser's **web workers** can be used.

### Non-blocking parsing with Node worker threads

Improved parsing logic using Node worker threads. Big files are split into multiple smaller files with a
defined set of airspace definition blocks. Each file is then handed over to a dedicated worker that will
parse the file using the OpenAIP OpenAIR parser.

#### main.js

This is where the main logic and your parsing takes place.

```javascript
import fs from 'node:fs';
import readline from 'readline';
import { Parser } from '@openaip/openair-parser';
import { processWithWorkers } from './worker-manager.js';

/**
 * Split large files into multiple files with a number of defined airspace definition blocks
 * separated by "AC" command.
 * The number of smaller temporary files is directly related to the size of 'blocksPerFile'.
 * Each file equals one worker. Choose 'blocksPerFile' carefully!
 */
async function splitFileIntoBlocks(filepath, blocksPerFile = 500) {
    const fileStream = fs.createReadStream(filepath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    let currentBlock = '';
    let blockCount = 0;
    let fileIndex = 1;
    const splitFiles = [];
    for await (const line of rl) {
        if (line.trim().startsWith('AC')) {
            if (currentBlock) {
                if (blockCount >= blocksPerFile) {
                    const splitFilePath = `./var/airspace_${fileIndex}.txt`;
                    splitFiles.push(splitFilePath);
                    fs.writeFileSync(splitFilePath, currentBlock);
                    fileIndex++;
                    blockCount = 0;
                    currentBlock = '';
                }
                blockCount++;
            }
        }
        currentBlock += line + '\n';
    }
    // write remaining blocks to file
    if (currentBlock) {
        const splitFilePath = `./var/airspace_${fileIndex}.txt`;
        splitFiles.push(splitFilePath);
        fs.writeFileSync(splitFilePath, currentBlock);
    }

    return splitFiles;
}

async function main() {
    // filepath to the huge source OpenAIR file
    const filepath = './var/huge-openair-file.txt';
    const config = {
        // adjust config to your needs
        fixGeometry: true,
    };

    try {
        // split the file into smaller chunks
        const splitFiles = await splitFileIntoBlocks(filepath);
        // process all files with workers and receive a GeoJSON FeatureCollection
        const featureCollection = await processWithWorkers(splitFiles, config);
        // clean up split files
        splitFiles.forEach((file) => fs.unlinkSync(file));
    } catch (error) {
        console.error('Error in worker processing:', error);
    }
}
```

#### worker-manager.js

Simple wrapper for worker related util functions

```javascript
import { Worker } from 'node:worker_threads';

/**
 * Initializes a defined worker with required configuration and awaits the
 * worker response.
 */
function createWorker(filepath, config) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./worker.js', {
            workerData: { filepath, config },
        });
        worker.on('message', (message) => {
            const { result } = message;
            resolve(result);
        });
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}
```

#### worker.js

Worker file that will parse a single file with the OpenAIR parser.

```javascript
import { parentPort, workerData } from 'worker_threads';
import { Parser } from '@openaip/openair-parser';

// 'workerData' is the data passed from the main thread
const { filepath, config } = workerData;

function parseOpenairFile(filepath) {
    const parser = new Parser({
        // adjust parser config depending on what is passed in with 'config'
        fixGeometry: config.fixGeometry,
    });
    // parse the temporary 'smaller' file
    const result = parser.parse(filepath);
    if (result.success === true) {
        const collection = parser.toGeojson();

        return collection.features;
    } else {
        throw Error(result.error);
    }
}

const result = parseOpenairFile(filepath);

// send the result back to the main thread
if (parentPort) {
    parentPort.postMessage({ result });
}
```

# CLI

CLI tooling is available. Following options exists:

Options:

    --input-filepath <inFilepath>    The input file path to the openAIR file.
    --output-filepath <outFilepath>  The output filename of the generated geojson file.
    --validate                       If set to true, validates geometries. Defaults to true.
    --fix-geometry                   If set to true, tries to fix geometries. Note that this may change the original airspace geometry! Defaults to false.
    --version <version>              Specify OpenAIR format version to parse. Defaults to 2.

Simple command line usage:

```bash
node cli.js --input-filepath ./tests/fixtures/full-airspaces.txt --output-filepath test.json
```

# Version 2: Extended OpenAIR Format

The original OpenAIR `version 1` format specification has multiple shortcomings to meet today's demand to reflect the various types of existing airspaces
and provide additional metadata on them. To overcome some of these shortcomings, a joint effort has been made to move forward and define an advanced OpenAIR `version 2` format
that introduces several new commands. Please find the full [OpenAIR format specification](https://github.com/naviter/seeyou_file_formats/blob/main/OpenAir_File_Format_Support.md) here which is maintained
by Naviter.

### Version 2 Format Commands:

#### AY

A required command that specifies the airspace type, e.g. "TMA", "CTR" or "TMZ". Unlike in the original format, the `AC` command must now only be used to specify the airspace `ICAO class`. If airspace has no type, i.e. is only ICAO class, the `AY` should be set to `UNCLASSIFIED`. The `AY` command must be placed directly after the `AC` command.

#### AF

An optional command that specifies the frequency of a ground station that provides information on the defined airspace. The `AF` should be placed directly before or after the `AG` command. The proposed best order is `AF`, then `AG`.

#### AG

An optional command that specifies the ground station name. **May not be used without the `AF` command**. The `AG` must be placed directly before or after the `AF` command. The proposed best order is `AF`, then `AG`.

#### AX

An optional command that specifies the required/recommended transponder setting for this airspace, e.g. `7000`.

#### AA

Allows definition of activation times. Use [ISO8601](https://en.wikipedia.org/wiki/ISO_8601) time interval format to express the time when the airspace is active. Only the time interval format is allowed and must be specified in UTC (Zulu) time, no local or time offsets are supported. `NONE` token can be used to indicate the unspecified start or end time of the airspace activation. Use `NONE` exclusively to indicate that this airspace activation is not yet known and is announced later, e.g. _by a NOTAM_.

Define activation times:

```text
AA 2025-01-01T12:00Z/2025-01-01T13:00Z
AA 2025-01-01T14:00Z/2025-01-01T15:00Z
AA NONE/2025-02-02T12:00Z
AA 2025-03-03T12:00/NONE
```

Or indicate activation by NOTAM:

```text
AA NONE
```

# Migration to OpenAIR Parser Version 2

The new version 2 of the OpenAIR Parser is a complete rewrite with lots of improvements and fixes but it also introduces **several breaking changes**! Please note the following most relevant changes:

#### Use Version 2 By Default

The parser is now configured to use `version 2` by default. If you want to parse `version 1` OpenAIR files, configure the parser explicitly to fallback to `version 1` parsing.

#### Strict Altitude Unit Parsing

The parser is now very strict and will not implicitly assume a default altitude unit. It will now reject parsing if an unknown altitude syntax is encountered. For example,
in `version 1` the parser implicitly assumed `FEET` as the default altitude unit when the unit was not set on an altitude definition, e.g. `2000 MSL`. This is no longer
possible. An altitude definition `2000 MSL` will now result in a parser error!

#### Strict Altitude Reference Parsing

The parser now only allows the defined set of altitude references defined in the `version 2` format definition (this is the same as in `version 1`). Please see the set of defined
altitude references here for [lower altitude](https://github.com/naviter/seeyou_file_formats/blob/main/OpenAir_File_Format_Support.md#al-lower-altitude-limit) and [upper altitude](https://github.com/naviter/seeyou_file_formats/blob/main/OpenAir_File_Format_Support.md#ah-upper-altitude-limit).

#### Removed Support For The AI Command

The support for the AI command has been removed. This was introduced to help automated systems to track changes to internal airspaces done in external files by
injecting a unique identifier into each exported OpenAIR airspace definition. Although very helpful in some (primarily automation related) use-cases, this command
would put too much maintenance overhead on airspace source file maintainers with very little benefit and thus has been removed.

#### Activation Times

The new `version 2` adds support for activation times. If specified, the activation times are available as an array of `{ start: string, end: string }` literals in the
airspace feature properties. Additionally, the properties will contain a new field `byNotam` which will be set to true if `NONE` is exclusively used in the OpenAIR definition. If `byNotam` is `true`, the `activationTimes` property will not be present!

# Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

# License

This project is licensed under the MIT License - see the [license.txt](license.txt) file for details.

# Issues

If you find a bug or have a feature request, please open an issue on the [GitHub repository](https://github.com/openAIP/openaip-openair-parser/issues).
