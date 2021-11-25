# OpenAIR Format Parser

A highly configurable [OpenAIR](http://www.winpilot.com/usersguide/userairspace.asp) parser for Node. The parser can also
be configured to validate and fix defined geometry.

Reads OpenAIR airspace definitions:

```text
AC R
AN ED-R10B Todendorf-Putlos MON-SAT+
AH 40000ft MSL
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

Install
=
```shell
npm install @openaip/openair-parser
```

Node
=

```javascript
const Parser = require('@openaip/openair-parser');

/*
 The default parser configuration for reference.
 */
const config = {
    // accepted airspace classes for the AC token
    airspaceClasses: [
        // default ICAO classes
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        // classes commonly found in openair files
        'R',
        'Q',
        'D',
        'P',
        'GP',
        'WAVE',
        'W',
        'GLIDING',
        'RMZ',
        'TMZ',
        'CTR',
    ],
    // flight level value to set for upper ceilings defined as "UNLIMITED"
    unlimited: 999,
    // defines the level of detail (smoothness) of arc/circular geometries
    geometryDetail: 100,
    // if true, validates each built airspace geometry to be valid/simple geometry - also checks for self intersections
    validateGeometry: true,
    // if true, uses "convexHull" to fix an invalid geometry - note that this may change the original airspace geometry!
    fixGeometry: false,
    // If true, the GeoJSON output will contain the original OpenAIR airspace definition block for each airspace. Note that this will considerably increase JSON object size!
    includeOpenair: false,
    // By default, parser uses 'ft' (feet) as the default unit if not explicitly defined in AL/AH definitions. Allowed units are: 'ft' and 'm'.
    defaultAltUnit: 'ft',
    // Defines the target unit to convert to.  Allowed units are: 'ft' and 'm'.
    targetAltUnit: 'ft',
    // round altitude values
    roundAltValues: false,
};

const parser = new Parser(config);
await parser.parse('./path/to/openair-file.txt');
const geojson = parser.toGeoJson();
```

CLI
=

```bash
node cli.js -h

Usage: cli [options]

Options:
  -f, --input-filepath <inFilepath>    The input file path to the openAIR file
  -o, --output-filepath <outFilepath>  The output filename of the generated geojson file
  -V, --validate                       If set to true, validates geometries. Defaults to true.
  -F, --fix-geometry                   If set to true, tries to fix geometries. Note that this may change the original airspace geometry! Defaults to false.
  -h, --help                           output usage information
```

Simple command line usage:

```bash
node cli.js -f ./tests/fixtures/full-airspaces.txt -o test.json
```
