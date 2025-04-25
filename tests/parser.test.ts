import fs from 'node:fs';
import path from 'node:path';
import appRoot from 'app-root-path';
import type { FeatureCollection } from 'geojson';
import { describe, expect, test } from 'vitest';
import { AltitudeUnitEnum } from '../src/altitude-unit.enum.js';
import { OutputFormatEnum } from '../src/output-format.enum.js';
import { OutputGeometryEnum } from '../src/output-geometry.enum.js';
import { Parser } from '../src/parser';

describe('test parse complete airspace definition blocks', () => {
    test('handle skipped tokens', () => {
        const openairParser = new Parser();

        expect(() => {
            openairParser.parse('./tests/fixtures/skipped-tokens.txt');
        }).not.toThrow();
    });
    test('handle ignored lines', () => {
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/ignored-only.txt');
        const geojson = openairParser.toGeojson();

        expect(success).toBe(true);
        expect(geojson.features.length).toEqual(0);
    });
    test('handle inline comments', () => {
        const expectedJson = loadJsonFixture('handle-inline-comments.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/airspace-inline-comments.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with simple polygon geometry', () => {
        const expectedJson = loadJsonFixture('aspc-with-simple-polygon.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/polygon-airspace.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with simple polygon geometry into LINESTRING geometry', () => {
        const expectedJson = loadJsonFixture('simple-poly-to-linestring.json');
        const openairParser = new Parser({ outputGeometry: OutputGeometryEnum.LINESTRING });
        const { success } = openairParser.parse('./tests/fixtures/polygon-airspace.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with circular geometry', () => {
        const expectedJson = loadJsonFixture('aspc-with-circular-geometry.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/circular-airspace.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    // TODO fix this !? Or is this an edge case that should be handled manually in the file , i.e. bigger radius!?
    test('parse laser beam airspace with very small circular geometry', () => {
        const expectedJson = loadJsonFixture('aspc-with-very-small-circular-geometry.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/laser-beam-airspace.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        (geojson as FeatureCollection).features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with clockwise arc geometry', () => {
        const expectedJson = loadJsonFixture('aspc-clockwise-arc.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/arc-clockwise-airspace.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with counter-clockwise arc geometry', () => {
        const expectedJson = loadJsonFixture('aspc-ccw-arc.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/arc-counterclockwise-airspace.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with arc/angle geometry', () => {
        const expectedJson = loadJsonFixture('aspc-arc-angle.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/arc-angle-airspace.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        (geojson as FeatureCollection).features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace starting with clockwise and counter-clockwise arc definition', () => {
        const expectedJson = loadJsonFixture('aspc-cw-ccw-start.json');
        const openairParser = new Parser({ validateGeometry: false, fixGeometry: false });
        const { success } = openairParser.parse('./tests/fixtures/arc-clockwise-counterclockwise-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        (geojson as FeatureCollection).features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace starting with arc definition', () => {
        const expectedJson = loadJsonFixture('aspc-arc-start.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/arc-first-airspace.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        (geojson as FeatureCollection).features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse multiple airspace definition blocks', () => {
        const expectedJson = loadJsonFixture('aspc-multiple-blocks.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/multiple-airspaces.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        (geojson as FeatureCollection).features.map((value) => delete value.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse custom airway definition', () => {
        const expectedJson = loadJsonFixture('aspc-awy.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/airway.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from expected json
        expectedJson.features.map((value) => delete value.id);
        expectedJson.features.map((value) => delete value.geometry);
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.geometry);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse extended format tags', () => {
        const expectedJson = loadJsonFixture('aspc-extended-format-tags.json');
        const openairParser = new Parser({ extendedFormat: true });
        const { success } = openairParser.parse('./tests/fixtures/extended-format-tags.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from expected json
        expectedJson.features.map((value) => delete value.id);
        expectedJson.features.map((value) => delete value.geometry);
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.geometry);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
});

describe('test optional configuration parameters', () => {
    test('do not round altitude value', () => {
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/round-altitude-values.txt');
        expect(success).toBe(true);
        expect(outputFormat).toBe(OutputFormatEnum.GEOJSON);
        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.value).toEqual(1607.611551);
    });
    test('round altitude value', () => {
        const openairParser = new Parser({ roundAltValues: true });
        const { success } = openairParser.parse('./tests/fixtures/round-altitude-values.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.value).toEqual(1608);
    });
    test('use default altitude unit', () => {
        const openairParser = new Parser({ defaultAltUnit: AltitudeUnitEnum.ft, targetAltUnit: AltitudeUnitEnum.m });
        openairParser.parse('./tests/fixtures/use-default-altitude-unit.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.unit).toEqual('M');
    });
    test('keep units if no target altitude unit is specified', () => {
        const openairParser = new Parser({ defaultAltUnit: AltitudeUnitEnum.m });
        openairParser.parse('./tests/fixtures/meter-altitude-unit.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.upperCeiling?.unit).toEqual('FL');
        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.unit).toEqual('M');
    });
    test('correct limit validation when converting from ft to m', () => {
        const openairParser = new Parser({ defaultAltUnit: AltitudeUnitEnum.ft, targetAltUnit: AltitudeUnitEnum.m });
        openairParser.parse('./tests/fixtures/check-limits-unit-conversion.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.upperCeiling?.value).toEqual(10667.99965862401);
    });
});

describe('test parse invalid airspace definition blocks', () => {
    test('single airspace with missing AC tag', () => {
        const openairParser = new Parser();

        expect(() => {
            openairParser.parse('./tests/fixtures/single-airspace-without-ac-tag.txt');
        }).toThrow("Error found at line 3: The first token must be of type 'AC'. Token 'AN' found on line 3.");
    });

    test('airspace with invalid coordinates', () => {
        const openairParser = new Parser();

        expect(() => {
            openairParser.parse('./tests/fixtures/invalid-coordinates-airspace.txt');
        }).toThrow(
            "Error found at line 14: Error found at line 14: Unknown coordinate definition 'DP 45:49:51 N 008:42:'"
        );
    });

    test('airspace with intersection', () => {
        const openairParser = new Parser();

        expect(() => {
            openairParser.parse('./tests/fixtures/self-intersecting-airspaces.txt');
        }).toThrow(
            "Error found at line 2: Geometry of airspace 'ED-R10B Todendorf-Putlos MON-SAT+' starting on line 2 is invalid due to self intersection."
        );
    });

    test('airspace with intersection converted into LINESTRING geometry return geometry', () => {
        const expectedJson = loadJsonFixture('invalid-intersect-to-linestring.json');
        const openairParser = new Parser({ outputGeometry: OutputGeometryEnum.LINESTRING });
        openairParser.parse('./tests/fixtures/self-intersecting-airspaces.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });

    test('airspace with insufficient coordinates fails even if fix geometry is set', () => {
        const openairParser = new Parser({ fixGeometry: true });

        expect(() => {
            openairParser.parse('./tests/fixtures/insufficient-coordinates-airspace.txt');
        }).toThrow(
            "Error found at line 1: Geometry of airspace 'CTR TOO-FEW-POINTS' starting on line 1 has insufficient number of coordinates: 3"
        );
    });

    test('airspace with invalid geometry with self intersection can be fixed', () => {
        const openairParser = new Parser({ fixGeometry: true });
        openairParser.parse('./tests/fixtures/self-intersecting-airspaces.txt');

        expect(() => {
            openairParser.toGeojson();
        }).not.toThrow();
    });

    test('airspace with invalid geometry with self intersection passes if not validated', () => {
        const openairParser = new Parser({ fixGeometry: false, validateGeometry: false });

        expect(() => {
            openairParser.parse('./tests/fixtures/circular-invalid-airspace.txt');
        }).not.toThrow();
    });

    test('airspace with empty name', () => {
        const openairParser = new Parser();

        expect(() => {
            openairParser.parse('./tests/fixtures/empty-name.txt');
        }).toThrow("Error found at line 3: Token 'AC' on line 1 does not allow subsequent token 'AH' on line 3");
    });

    test('airspace with duplicate ceiling definitions are rejected', () => {
        const openairParser = new Parser();

        expect(() => {
            openairParser.parse('./tests/fixtures/duplicate-ceiling-definitions.txt');
        }).toThrow("Error found at line 4: Token 'AL' on line 3 does not allow subsequent token 'AL' on line 4");
    });

    test('airspace start and end coordinates are not equal', () => {
        const openairParser = new Parser();

        expect(() => {
            openairParser.parse('./tests/fixtures/airspace-start-end-coordinates-not-equal.txt');
        }).toThrow(
            "Error found at line 2: Geometry of airspace 'RMZ Rochefort 119.3' starting on line 2 is invalid. First and last Position are not equivalent."
        );
    });

    test('single airspace with AG and missing AF tag', () => {
        const openairParser = new Parser({ extendedFormat: true });

        expect(() => {
            openairParser.parse('./tests/fixtures/single-airspace-ag-but-missing-af.txt');
        }).toThrow("Error found at line 5: Token 'AG' is present but token 'AF' is missing.");
    });

    test('single airspace with invalid TP tag', () => {
        const openairParser = new Parser({ extendedFormat: true });

        expect(() => {
            openairParser.parse('./tests/fixtures/invalid-transponder-code.txt');
        }).toThrow("Error found at line 9: Error found at line 9: Invalid transponder code string 'TP 7891'");
    });

    test('single airspace with missing AL and AH tags', () => {
        const openairParser = new Parser({ extendedFormat: true });

        expect(() => {
            openairParser.parse('./tests/fixtures/single-airspace-missing-ah-al-tag.txt');
        }).toThrow('Error found at line 3: Airspace definition block is missing required tokens: AL, AH');
    });

    test('single airspace in extended format with missing AY tag', () => {
        const openairParser = new Parser({ extendedFormat: true });

        expect(() => {
            openairParser.parse('./tests/fixtures/single-airspace-extended-format-missing-AY-tag.txt');
        }).toThrow('Error found at line 1: Airspace definition block is missing required tokens: AY');
    });
});

describe('test parse invalid airspace definition blocks and fix geometry', () => {
    test('airspace with invalid geometry with self intersection can be fixed and is not Multipolygon', () => {
        const openairParser = new Parser({ fixGeometry: true });
        openairParser.parse('./tests/fixtures/do-not-split-into-multipolygon.txt');
        const { features } = openairParser.toGeojson();
        const { geometry } = features[0];

        expect(geometry.type).toEqual('Polygon');
    });
    test('airspace fix start and end coordinates if not equal', () => {
        const openairParser = new Parser({ fixGeometry: true });
        openairParser.parse('./tests/fixtures/airspace-start-end-coordinates-not-equal.txt');
        const { features } = openairParser.toGeojson();
        const { geometry } = features[0];

        expect(geometry.type).toEqual('Polygon');
    });
});

describe('test formats', () => {
    test('check correct openair output', () => {
        // read from expected file and remove last "blank line" in file (automatically added by IDE)
        const expected = fs.readFileSync('./tests/fixtures/formats/expected-output-openair.txt', 'utf-8').split('\n');
        const openairParser = new Parser({ fixGeometry: true });
        openairParser.parse('./tests/fixtures/formats/in-output-openair.txt');
        const openair = openairParser.toOpenair();

        // make sure to also take "last blank line added by IDE" into account
        expect(removeBlanksAtEof(openair).join('\n')).toEqual(removeBlanksAtEof(expected).join('\n'));
    });
});

function loadJsonFixture(filename: string) {
    const filePath = path.resolve(`${appRoot}/tests/fixtures/results/${filename}`);
    const fileContent = fs.readFileSync(filePath);

    return JSON.parse(fileContent.toString());
}

/**
 * Takes a list of string and removes all blank lines at the end of the list.
 */
function removeBlanksAtEof(lines: string[]): string[] {
    let lastLine = lines[lines.length - 1];
    if (lastLine.trim() === '') {
        lines.pop();
        lastLine = lines[lines.length - 1];
    }

    return lines;
}
