# OpenAIR Format Parser

A configurable [OpenAIR](http://www.winpilot.com/usersguide/userairspace.asp) format parser for Node.

#Node

```javascript
const Parser = require('@openaip/openair-parser');

/*
 The default parser configuration for reference.
 */
const config = {
    // defines allowed airspace classes used with the AC token
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
    // if true, uses "convexHull" to fix an invalid geometry - note that this potentially alters the original airspace geometry!
    fixGeometry: false,
};

const parser = new Parser(config);
await parser.parse('./path/to/openair-file.txt');
const geojson = parser.toGeoJson();
```

Parser result is a GeoJSON FeatureCollection:

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
                        [10.666666666666666, 54.416666666666664]
                    ]
                ]
            }
        }
    ]
}
```

#CLI

```bash
node cli.js -h

Usage: cli [options]

Options:
  -f, --input-filepath <inFilepath>    The input file path to the openAIR file
  -o, --output-filepath <outFilepath>  The output filename of the generated geojson file
  -V, --validate                       If set to true, validates geometries. Defaults to true.
  -F, --fix-geometry                   If set to true, tries to fix geometries. Defaults to false.
  -h, --help                           output usage information
```

Simple command line usage:

```bash
node cli.js -f ./tests/fixtures/full-airspaces.txt -o test.json
```
