# OpenAIR Format Parser

A highly configurable [OpenAIR](http://www.winpilot.com/usersguide/userairspace.asp) parser for Node. The parser can also
be configured to validate and fix defined geometries. The parser supports the **original** v1 and the **extended** v2 OpenAIR format.
For more informations on the v2 extended format, please see the Naviter format specification here: [https://github.com/naviter/seeyou_file_formats/blob/main/OpenAir_File_Format_Support.md](https://github.com/naviter/seeyou_file_formats/blob/main/OpenAir_File_Format_Support.md).

### Reads **original OpenAIR** airspace definitions with `extendedFormat: false`:

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

### Reads **extended OpenAIR** airspace definitions with `extendedFormat: true`:

```text
AC D
AY TMA
AN TMA Todendorf-Putlos
AI b3836bab-6bc3-48c1-b918-01c2559e26fa
AF 123.505
AG Todendorf Information
AX 7000
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
                "id": "b3836bab-6bc3-48c1-b918-01c2559e26fa",
                "name": "TMA Todendorf-Putlos",
                "class": "D",
                "type": "TMA",
                "frequency": {
                    "value": "123.505",
                    "name": "Todendorf Information"
                },
                "transponderCode": "7000",
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

# Install

```shell
npm install -g @openaip/openair-parser
```

# Node

```javascript
const Parser = require('@openaip/openair-parser');

/*
 The default parser configuration for reference.
 */
const config = {
    // Defines allowed airspace classes used with the AC token. This configuration option only applies if the
    // standard "non-extended" format is used, i.e. with the config parameter "extendedFormat: false".
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
        'P',
        'GP',
        'WAVE',
        'W',
        'GLIDING',
        'RMZ',
        'TMZ',
        'CTR',
    ],
    // If "true" the parser will try to parse the extended OpenAIR-Format that contains additional tags
    // "AY", "AF", "AG", "TP" and "AI". If true, config parameters "allowedClassValues" and "allowedTypeValues" are
    // mandatory.
    extendedFormat: false,
    // defines a set of allowed values if the extended format is used -  default ICAO classes.
    extendedFormatClasses: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'UNCLASSIFIED'],
    // Defines a set of allowed "AY" values if the extended format is used. Otherwise, allows all used types.
    extendedFormatTypes: [],
    // flight level value to set for upper ceilings defined as "UNLIMITED"
    unlimited: 999,
    // defines the level of detail (smoothness) of arc/circular geometries
    geometryDetail: 100,
    // if true, validates each built airspace geometry to be valid/simple geometry - also checks for self intersections
    validateGeometry: true,
    // if true, uses "convexHull" to fix an invalid geometry - note that this may change the original airspace geometry!
    fixGeometry: false,
    // Sets the output geometry. Can be either "POLYGON" or "LINESTRING". Defaults to "POLYGON". "LINESTRING" can be used
    // to visualize invalid geometry definitions. Note that "validateGeometry" and "fixGeometry" has NO effect on "LINESTRING" geometry output!
    outputGeometry: 'POLYGON',
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
const geojson = parser.toGeojson();
```

# Extended OpenAIR Format

The **original** OpenAIR format specification has multiple shortcomings to meet today's demand to reflect the various types of existing airspaces
and provide additional metadata. To overcome these shortcomings, an **extended** OpenAIR format is introduced that has several new tags.

### Extended Format Tags:

#### AI

An optional tag that specifies a unique identifier string for each airspace, e.g. a [UUID v4](https://en.wikipedia.org/wiki/Universally_unique_identifier). The _AI_ value must stay the same for each airspace throughout different versions if the file. The _AI_ tag must be placed either before or directly after the _AN_ tag. Placing the _AI_ tag before the _AN_ tag is preferred

#### AY

A required tag that specifies the airspace type, e.g. "TMA", "CTR" or "TMZ". Unlike in the original format, the _AC_ tag must now only be used to specify the airspace _ICAO class_. If airspace has no type, i.e. is only ICAO class, the _AY_ should be set to `UNCLASSIFIED`. The _AY_ tag must be placed directly after the _AC_ tag.

#### AF

An optional tag that specifies the frequency of a ground station that provides information on the defined airspace. The _AF_ should be placed directly before or after the _AG_ tag. The proposed best order is _AF_, then _AG_.

#### AG

An optional tag that specifies the ground station name. **May not be used without the _AF_ tag**. The _AG_ must be placed directly before or after the _AF_ tag. The proposed best order is _AF_, then _AG_.

#### TP

An optional tag that specifies the required/recommended transponder setting for this airspace.

### Original To Extended Format Conversion

To easily convert original OpenAIR to the extended format you can use our [OpenAIR Fixer Tool](https://github.com/openAIP/openaip-openair-fix-format). The tool will
inject the required _AI_ token for each airspace definition block that does not have it already. Additionally the tools takes care of tag order.

# CLI

```bash
node cli.js -h

Usage: cli [options]

Options:
  -f, --input-filepath <inFilepath>    The input file path to the openAIR file.
  -o, --output-filepath <outFilepath>  The output filename of the generated geojson file.
  -V, --validate                       If set to true, validates geometries. Defaults to true.
  -F, --fix-geometry                   If set to true, tries to fix geometries. Note that this may change the original airspace geometry! Defaults to false.
  -E, --extended-format                If set to true, parser expects the extended OpenAIR format. Defaults to false.
  -h, --help                           Output usage information.
```

Simple command line usage:

```bash
node cli.js -f ./tests/fixtures/full-airspaces.txt -o test.json
```
