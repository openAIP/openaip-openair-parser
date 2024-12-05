const Parser = require('../src/parser');
const outputGeometries = require('../src/output-geometry');
const fs = require('node:fs');
const viteTest = await import('vitest');
const { describe, test, expect } = viteTest;

describe('test parse complete airspace definition blocks', () => {
    test('handle skipped tokens', async () => {
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/skipped-tokens.txt');

        expect(() => {
            openairParser.toGeojson();
        }).not.toThrow();
    });
    test('handle ignored lines', async () => {
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/ignored-only.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson.features.length).toEqual(0);
    });
    test('handle inline comments', async () => {
        const expectedJson = require('./fixtures/results/handle-inline-comments');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/airspace-inline-comments.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with simple polygon geometry', async () => {
        const expectedJson = require('./fixtures/results/aspc-with-simple-polygon');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/polygon-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with simple polygon geometry into LINESTRING geometry', async () => {
        const expectedJson = require('./fixtures/results/simple-poly-to-linestring');
        const openairParser = new Parser({ outputGeometry: outputGeometries.LINESTRING });
        await openairParser.parse('./tests/fixtures/polygon-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with circular geometry', async () => {
        const expectedJson = require('./fixtures/results/aspc-with-circular-geometry');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/circular-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse laser beam airspace with very small circular geometry', async () => {
        const expectedJson = require('./fixtures/results/aspc-with-very-small-circular-geometry');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/laser-beam-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with clockwise arc geometry', async () => {
        const expectedJson = require('./fixtures/results/aspc-clockwise-arc');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/arc-clockwise-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with counter-clockwise arc geometry', async () => {
        const expectedJson = require('./fixtures/results/aspc-ccw-arc');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/arc-counterclockwise-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with arc/angle geometry', async () => {
        const expectedJson = require('./fixtures/results/aspc-arc-angle');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/arc-angle-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace starting with clockwise and counter-clockwise arc definition', async () => {
        const expectedJson = require('./fixtures/results/aspc-cw-ccw-start');
        const openairParser = new Parser({ validateGeometry: false, fixGeometry: false });
        await openairParser.parse('./tests/fixtures/arc-clockwise-counterclockwise-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace starting with arc definition', async () => {
        const expectedJson = require('./fixtures/results/aspc-arc-start');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/arc-first-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse multiple airspace definition blocks', async () => {
        const expectedJson = require('./fixtures/results/aspc-multiple-blocks');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/multiple-airspaces.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse custom airway definition', async () => {
        const expectedJson = require('./fixtures/results/aspc-awy');
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/airway.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('parse extended format tags', async () => {
        const expectedJson = require('./fixtures/results/aspc-extended-format-tags');
        const openairParser = new Parser({ extendedFormat: true });
        await openairParser.parse('./tests/fixtures/extended-format-tags.txt');
        const geojson = openairParser.toGeojson();

        // remove unnecessary props from expected json
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.geometry);

        expect(geojson).toEqual(expectedJson);
    });
});

describe('test optional configuration parameters', () => {
    test('do not round altitude value', async () => {
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/round-altitude-values.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.value).toEqual(1607.611551);
    });
    test('round altitude value', async () => {
        const openairParser = new Parser({ roundAltValues: true });
        await openairParser.parse('./tests/fixtures/round-altitude-values.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.value).toEqual(1608);
    });
    test('use default altitude unit', async () => {
        const openairParser = new Parser({ defaultAltUnit: 'm', targetAltUnit: 'm' });
        await openairParser.parse('./tests/fixtures/use-default-altitude-unit.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.unit).toEqual('M');

    });
    test('keep units if no target altitude unit is specified', async () => {
        const openairParser = new Parser({ defaultAltUnit: 'm' });
        await openairParser.parse('./tests/fixtures/meter-altitude-unit.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.upperCeiling?.unit).toEqual('FL');
        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.unit).toEqual('M');
    });
    test('correct limit validation when converting from ft to m', async () => {
        const openairParser = new Parser({ defaultAltUnit: 'ft', targetAltUnit: 'm' });
        await openairParser.parse('./tests/fixtures/check-limits-unit-conversion.txt');
        const geojson = openairParser.toGeojson();

        expect(geojson?.features?.[0]?.properties?.upperCeiling?.value).toEqual(10667.99965862401);
    });
});

describe('test parse invalid airspace definition blocks', () => {
    test('single airspace with missing AC tag', async () => {
        const openairParser = new Parser();

        await expect(openairParser.parse('./tests/fixtures/single-airspace-without-ac-tag.txt')).rejects.toThrow(
            "Error found at line 3: The first token must be of type 'AC'. Token 'AN' found on line 3.",
        );
    });
    test('airspace with invalid coordinates', async () => {
        const openairParser = new Parser();

        await expect(openairParser.parse('./tests/fixtures/invalid-coordinates-airspace.txt')).rejects.toThrow(
            "Error found at line 14: Error found at line 14: Unknown coordinate definition 'DP 45:49:51 N 008:42:'",
        );
    });
    test('airspace with intersection', async () => {
        const openairParser = new Parser();

        await expect(openairParser.parse('./tests/fixtures/self-intersecting-airspaces.txt')).rejects.toThrow(
            "Error found at line 1: Geometry of airspace 'CHARLO, NB CAE' starting on line 1 is invalid due to a self intersection at '46.13311111111111,-67.78122222222223'",
        );
    });
    test('airspace with intersection into LINESTRING geometry return geometry', async () => {
        const expectedJson = require('./fixtures/results/invalid-intersect-to-linestring');
        const openairParser = new Parser({ outputGeometry: outputGeometries.LINESTRING });
        await openairParser.parse('./tests/fixtures/self-intersecting-airspaces.txt');
        const geojson = openairParser.toGeojson();
        // remove feature id for comparison
        expectedJson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedJson);
    });
    test('airspace with insufficient coordinates fails even if fix geometry is set', async () => {
        const openairParser = new Parser({ fixGeometry: true });

        await expect(openairParser.parse('./tests/fixtures/insufficient-coordinates-airspace.txt')).rejects.toThrow(
            "Error found at line 1: Geometry of airspace 'CTR TOO-FEW-POINTS' starting on line 1 has insufficient number of coordinates: 3",
        );
    });
    test('airspace with invalid geometry with self intersection can be fixed', async () => {
        const openairParser = new Parser({ fixGeometry: true });
        await openairParser.parse('./tests/fixtures/self-intersecting-airspaces.txt');

        expect(() => {
            openairParser.toGeojson();
        }).not.toThrow();
    });
    test('airspace with invalid geometry with self intersection passes if not validated', async () => {
        const expectedGeojson = require('./fixtures/results/invalid-self-intersect-passes-if-not-validated');
        const openairParser = new Parser({ fixGeometry: false, validateGeometry: false });
        await openairParser.parse('./tests/fixtures/circular-invalid-airspace.txt');
        const geojson = openairParser.toGeojson();

        // remove feature id for comparison
        expectedGeojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete value.id);

        expect(geojson).toEqual(expectedGeojson);
    });
    test('airspace with empty name', async () => {
        const openairParser = new Parser();

        await expect(openairParser.parse('./tests/fixtures/empty-name.txt')).rejects.toThrow(
            "Error found at line 3: Token 'AC' on line 1 does not allow subsequent token 'AH' on line 3",
        );
    });
    test('airspace with duplicate ceiling definitions are rejected', async () => {
        const openairParser = new Parser();

        await expect(openairParser.parse('./tests/fixtures/duplicate-ceiling-definitions.txt')).rejects.toThrow(
            "Error found at line 4: Token 'AL' on line 3 does not allow subsequent token 'AL' on line 4",
        );
    });
    test('airspace start and end coordinates are not equal', async () => {
        const openairParser = new Parser();

        await expect(
            openairParser.parse('./tests/fixtures/airspace-start-end-coordinates-not-equal.txt'),
        ).rejects.toThrow(
            "Error found at line 2: Geometry of airspace 'RMZ Rochefort 119.3' starting on line 2 is invalid. First and last Position are not equivalent.",
        );
    });
    test('single airspace with AG and missing AF tag', async () => {
        const openairParser = new Parser({ extendedFormat: true });

        await expect(openairParser.parse('./tests/fixtures/single-airspace-ag-but-missing-af.txt')).rejects.toThrow(
            "Error found at line 5: Token 'AG' is present but token 'AF' is missing.",
        );
    });
    test('single airspace with invalid TP tag', async () => {
        const openairParser = new Parser({ extendedFormat: true });

        await expect(openairParser.parse('./tests/fixtures/invalid-transponder-code.txt')).rejects.toThrow(
            "Error found at line 9: Error found at line 9: Invalid transponder code string 'TP 7891'",
        );
    });
    test('single airspace with missing AL and AH tags', async () => {
        const openairParser = new Parser({ extendedFormat: true });

        await expect(openairParser.parse('./tests/fixtures/single-airspace-missing-ah-al-tag.txt')).rejects.toThrow(
            'Error found at line 3: Airspace definition block is missing required tokens: AL, AH',
        );
    });
    test('single airspace in extended format with missing AY tag', async () => {
        const openairParser = new Parser({ extendedFormat: true });

        await expect(
            openairParser.parse('./tests/fixtures/single-airspace-extended-format-missing-AY-tag.txt'),
        ).rejects.toThrow('Error found at line 1: Airspace definition block is missing required tokens: AY');
    });
});

describe('test parse invalid airspace definition blocks and fix geometry', () => {
    test('airspace with invalid geometry with self intersection can be fixed and is not Multipolygon', async () => {
        const openairParser = new Parser({ fixGeometry: true });
        await openairParser.parse('./tests/fixtures/do-not-split-into-multipolygon.txt');
        const { features } = openairParser.toGeojson();
        const { geometry } = features[0];

        expect(geometry.type).toEqual('Polygon');
    });
    test('airspace fix start and end coordinates if not equal', async () => {
        const openairParser = new Parser({ fixGeometry: true });
        await openairParser.parse('./tests/fixtures/airspace-start-end-coordinates-not-equal.txt');
        const { features } = openairParser.toGeojson();
        const { geometry } = features[0];

        expect(geometry.type).toEqual('Polygon');
    });
});

describe('test formats', () => {
    test('check correct openair output', async () => {
        // read from expected file and remove last "blank line" in file (automatically added by IDE)
        const expected = await fs
            .readFileSync('./tests/fixtures/formats/expected-output-openair.txt', 'utf-8')
            .split('\n');

        const openairParser = new Parser({ fixGeometry: true });
        await openairParser.parse('./tests/fixtures/formats/in-output-openair.txt');
        const openair = openairParser.toOpenair();

        // make sure to also take "last blank line added by IDE" into account
        expect(removeBlanksAtEof(openair).join('\n')).toEqual(removeBlanksAtEof(expected).join('\n'));
    });
});

/**
 * Takes a list of string and removes all blank lines at the end of the list.
 *
 * @param {string[]} lines
 * @return {string[]}
 */
function removeBlanksAtEof(lines) {
    let lastLine = lines[lines.length - 1];
    if (lastLine.trim() === '') {
        lines.pop();
        lastLine = lines[lines.length - 1];
    }

    return lines;
}
