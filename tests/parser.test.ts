import fs from 'node:fs';
import path from 'node:path';
import appRoot from 'app-root-path';
import { describe, expect, test } from 'vitest';
import { AltitudeUnitEnum } from '../src/altitude-unit.enum.js';
import { OutputGeometryEnum } from '../src/output-geometry.enum.js';
import { Parser } from '../src/parser';
import { ParserVersionEnum } from '../src/parser-version.enum.js';

const ALLOWED_CLASSES_VERSION_1 = [
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
];

describe('Test parse airspace definition blocks', () => {
    test('handle skipped tokens', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });

        expect(() => {
            openairParser.parse('./tests/fixtures/skipped-tokens.txt');
        }).not.toThrow();
    });
    test('handle skipped tokens', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });

        expect(() => {
            openairParser.parse('./tests/fixtures/skipped-tokens.txt');
        }).not.toThrow();
    });
    test('handle ignored lines', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/ignored-only.txt');
        const geojson = openairParser.toGeojson();

        expect(success).toBe(true);
        expect(geojson.features.length).toEqual(0);
    });
    test('handle inline comments', () => {
        const expectedJson = loadParserJsonResult('result-handle-inline-comments.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/airspace-inline-comments.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison

        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with simple polygon geometry', () => {
        const expectedJson = loadParserJsonResult('result-with-simple-polygon.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/polygon.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with simple polygon geometry into LINESTRING geometry', () => {
        const expectedJson = loadParserJsonResult('result-simple-poly-to-linestring.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            outputGeometry: OutputGeometryEnum.LINESTRING,
        });
        const { success } = openairParser.parse('./tests/fixtures/polygon.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with circular geometry', () => {
        const expectedJson = loadParserJsonResult('result-with-circular-geometry.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/circular.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with clockwise arc geometry', () => {
        const expectedJson = loadParserJsonResult('result-arc-cw.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-cw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with counter-clockwise arc geometry', () => {
        const expectedJson = loadParserJsonResult('result-arc-ccw.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-ccw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with arc with angle clockwise', () => {
        const expectedJson = loadParserJsonResult('result-arc-angle-cw.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-angle-cw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with arc with angle counter-clockwise', () => {
        const expectedJson = loadParserJsonResult('result-arc-angle-ccw.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-angle-ccw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with arc with angle and only single VX', () => {
        const expectedJson = loadParserJsonResult('result-arc-angle-single-vx.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-angle-single-vx.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace starting with clockwise and counter-clockwise arc definition', () => {
        const expectedJson = loadParserJsonResult('result-arc-cw-ccw.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/arc-cw-ccw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace starting with arc definition', () => {
        const expectedJson = loadParserJsonResult('result-arc-start.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/arc-first.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse multiple airspace definition blocks', () => {
        const expectedJson = loadParserJsonResult('result-multiple-blocks.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/multiple-airspaces.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse custom airway definition', () => {
        const expectedJson = loadParserJsonResult('result-awy.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/airway.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from received json

        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
});

describe('Format Version 2: Test parse airspace definition blocks', () => {
    test('parse commands', () => {
        const expectedJson = loadParserJsonResult('result-version-2-commands.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/version-2-commands.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from received json - only check properties

        expectedJson.features.map((value) => delete value.geometry);
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);
        geojson.features.map((value) => delete value.geometry);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse activation times', () => {
        const expectedJson = loadParserJsonResult('result-activation-times.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/activation-times.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from received json

        expectedJson.features.map((value) => delete value.geometry);
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);
        geojson.features.map((value) => delete value.geometry);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse activation time by NOTAM', () => {
        const expectedJson = loadParserJsonResult('result-activation-times-none.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/activation-times-none.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from received json
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);
        geojson.features.map((value) => delete value.geometry);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
});

describe('Test optional configuration parameters', () => {
    test('do not round altitude value', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/round-altitude-values.txt');
        const geojson = openairParser.toGeojson();

        expect(success).toBe(true);
        expect(geojson.features?.[0]?.properties?.lowerCeiling?.value).toEqual(1607.611551);
    });
    test('round altitude value', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            roundAltValues: true,
        });
        const { success } = openairParser.parse('./tests/fixtures/round-altitude-values.txt');
        const geojson = openairParser.toGeojson();

        expect(success).toBe(true);
        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.value).toEqual(1608);
    });
    test('keep units if no target altitude unit is specified', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/meter-altitude-unit.txt');
        const geojson = openairParser.toGeojson();

        expect(success).toBe(true);
        expect(geojson?.features?.[0]?.properties?.upperCeiling?.unit).toEqual(AltitudeUnitEnum.FLIGHT_LEVEL);
        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.unit).toEqual(AltitudeUnitEnum.METER);
    });
    test('correct limit validation when converting from ft to m', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            targetAltUnit: AltitudeUnitEnum.METER,
        });
        const { success } = openairParser.parse('./tests/fixtures/check-limits-unit-conversion.txt');
        const geojson = openairParser.toGeojson();

        expect(success).toBe(true);
        expect(geojson?.features?.[0]?.properties?.upperCeiling?.value).toEqual(10667.99965862401);
    });
});

describe('Test parse invalid airspace definition blocks', () => {
    test('single airspace with missing AC tag', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/without-ac.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 3: The first token must be of type 'AC'. Token 'AN' found on line 3."
        );
    });
    test('airspace with invalid coordinates', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/invalid-coordinates.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 14: Error found at line 14: Unknown coordinate definition 'DP 45:49:51 N 008:42:'"
        );
    });
    test('airspace with intersection', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/self-intersecting.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 1: Geometry of airspace 'ED-R10B Todendorf-Putlos MON-SAT+' starting on line 1 is invalid due to self intersection."
        );
    });
    test('airspace with intersection converted into LINESTRING geometry return geometry', () => {
        const expectedJson = loadParserJsonResult('result-invalid-intersect-to-linestring.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            outputGeometry: OutputGeometryEnum.LINESTRING,
        });
        const { success } = openairParser.parse('./tests/fixtures/self-intersecting.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.properties.id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('airspace with insufficient coordinates fails even if fix geometry is set', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/insufficient-coordinates.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 1: Geometry of airspace 'CTR TOO-FEW-POINTS' starting on line 1 has insufficient number of coordinates: 3"
        );
    });
    test('airspace with invalid geometry with self intersection can be fixed', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/self-intersecting.txt');

        expect(success).toBe(true);
        expect(error).toBeUndefined();
    });
    test('airspace with invalid geometry with self intersection passes if not validated', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
            validateGeometry: false,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/self-intersecting.txt');

        expect(success).toBe(true);
        expect(error).toBeUndefined();
    });
    test('airspace with empty name', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/empty-name.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 3: Token 'AC' on line 1 does not allow subsequent token 'AH' on line 3"
        );
    });
    test('airspace with duplicate ceiling definitions are rejected', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/ceiling-definitions-duplicate.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 4: Token 'AL' on line 3 does not allow subsequent token 'AL' on line 4"
        );
    });
    test('airspace with ceiling definitions where AL is greater than AH are rejected', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/ceiling-definitions-al-greater-ah.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual('Error found at line 10: Lower limit must be less than upper limit');
    });
    test('airspace start and end coordinates are not equal', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/start-end-coordinates-not-equal.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 2: Geometry of airspace 'RMZ Rochefort 119.3' starting on line 2 is invalid. First and last Position are not equivalent."
        );
    });
    test('parse laser beam airspace with too small circular geometry', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/laser-beam.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            'Error found at line 6: The polygon dimensions are too small to create a polygon.'
        );
    });
});

describe('Version 2: Test parse invalid airspace definition blocks', () => {
    test('single airspace with AG and missing AF tag', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/single-airspace-ag-but-missing-af.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual("Error found at line 5: Token 'AG' is present but token 'AF' is missing.");
    });
    test('single airspace with invalid AX tag', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/transponder-code-invalid.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 8: Error found at line 8: Invalid transponder code string 'AX 7891'"
        );
    });
    test('single airspace with missing AL and AH tags', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/missing-ah-al.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            'Error found at line 3: Airspace definition block is missing required tokens: AL, AH, AY'
        );
    });
    test('single airspace with missing AY tag', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/missing-AY.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            'Error found at line 1: Airspace definition block is missing required tokens: AY'
        );
    });
    test('airspace with invalid activation times', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/activation-times-invalid.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            "Error found at line 9: Error found at line 9: Invalid activation times format 'AA 2025-01-02T14:00Z/2025-01-01T15:00Z'. Start date must be before end date."
        );
    });
    test('airspace with invalid activation times with none/none', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/activation-times-invalid-with-none.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error.message).toEqual(
            'Error found at line 9: Additional activation times are not allowed with BY NOTAM activation.'
        );
    });
});

describe('Test parse invalid airspace definition blocks and fix geometry', () => {
    test('airspace with invalid geometry with self intersection can be fixed and is not Multipolygon', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
        });
        const { success } = openairParser.parse('./tests/fixtures/do-not-split-into-multipolygon.txt');
        const { features } = openairParser.toGeojson();
        const { geometry } = features[0];

        expect(success).toBe(true);
        expect(geometry.type).toEqual('Polygon');
    });
    test('airspace fix start and end coordinates if not equal', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
        });
        const { success } = openairParser.parse('./tests/fixtures/start-end-coordinates-not-equal.txt');
        const { features } = openairParser.toGeojson();
        const { geometry } = features[0];

        expect(success).toBe(true);
        expect(geometry.type).toEqual('Polygon');
    });
});

describe('Test output formats', () => {
    test('check correct openair output', () => {
        // read from expected file and remove last "blank line" in file (automatically added by IDE)
        const expected = fs.readFileSync('./tests/fixtures/formats/expected-output-openair.txt', 'utf-8').split('\n');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
        });
        const { success } = openairParser.parse('./tests/fixtures/formats/in-output-openair.txt');
        const openair = openairParser.toOpenair();

        expect(success).toBe(true);
        // make sure to also take "last blank line added by IDE" into account
        expect(removeBlanksAtEof(openair).join('\n')).toEqual(removeBlanksAtEof(expected).join('\n'));
    });
});

function loadParserJsonResult(filename: string) {
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
