import fs from 'node:fs';
import path from 'node:path';
import { area, distance, kinks, polygon } from '@turf/turf';
import appRoot from 'app-root-path';
import type { Feature, Polygon } from 'geojson';
import { describe, expect, test, vi } from 'vitest';
import { AltitudeUnitEnum } from '../src/altitude-unit.enum.js';
import { OutputGeometryEnum } from '../src/output-geometry.enum.js';
import { Parser } from '../src/parser.js';
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
        const expectedJson = loadParserJsonResult('inline-comments-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/inline-comments.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison

        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with simple polygon geometry', () => {
        const expectedJson = loadParserJsonResult('polygon-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/polygon.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with simple polygon geometry into LINESTRING geometry', () => {
        const expectedJson = loadParserJsonResult('polygon-to-linestring-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            outputGeometry: OutputGeometryEnum.LINESTRING,
        });
        const { success } = openairParser.parse('./tests/fixtures/polygon.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with circular geometry', () => {
        const expectedJson = loadParserJsonResult('circular-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/circular.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with small circular geometry', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/small-circle.txt');
        const { features } = openairParser.toGeojson();
        const coordinates = (features[0].geometry as Polygon).coordinates[0] as [number, number][];

        expect(success).toBe(true);
        // with the default geometry detail of 100, a circle is created with 100 points + 1 closing point - independent of its radius
        expect(coordinates).toHaveLength(101);
        // polygon ring is closed
        expect(coordinates[0]).toEqual(coordinates[coordinates.length - 1]);
        // all points are placed on the defined circle radius of 0.05 NM (~92.6 m) around the center coordinate
        const centerCoordinate: [number, number] = [8.48, 49 + 3 / 60 + 46 / 3600];
        for (const coordinate of coordinates) {
            const distanceToCenter = distance(centerCoordinate, coordinate, { units: 'meters' });
            expect(distanceToCenter).toBeGreaterThan(91);
            expect(distanceToCenter).toBeLessThan(94);
        }
        // the circle area is preserved - the geometry is not thinned out to a low-detail polygon
        const circleArea = area(features[0] as Feature<Polygon>);
        expect(circleArea).toBeGreaterThan(0.998 * Math.PI * 92.6 ** 2);
    });
    test('parse laser beam airspace with micro circular geometry', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/laser-beam.txt');
        const { features } = openairParser.toGeojson();
        const coordinates = (features[0].geometry as Polygon).coordinates[0] as [number, number][];

        expect(success).toBe(true);
        // even a micro circle with a radius of 0.00161 NM (~3 m) keeps the full geometry detail and is not rejected
        expect(coordinates).toHaveLength(101);
        expect(coordinates[0]).toEqual(coordinates[coordinates.length - 1]);
        // all points are placed on the defined circle radius of ~3 m around the center coordinate
        const centerCoordinate: [number, number] = [12 + 37 / 60 + 50 / 3600, 35 + 31 / 60 + 6 / 3600];
        for (const coordinate of coordinates) {
            const distanceToCenter = distance(centerCoordinate, coordinate, { units: 'meters' });
            expect(distanceToCenter).toBeGreaterThan(2);
            expect(distanceToCenter).toBeLessThan(4);
        }
        const circleArea = area(features[0] as Feature<Polygon>);
        expect(circleArea).toBeGreaterThan(25);
    });
    test('parse airspace with clockwise arc geometry', () => {
        const expectedJson = loadParserJsonResult('arc-cw-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-cw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with counter-clockwise arc geometry', () => {
        const expectedJson = loadParserJsonResult('arc-ccw-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-ccw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with arc with angle clockwise', () => {
        const expectedJson = loadParserJsonResult('arc-angle-cw-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-angle-cw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with arc with angle counter-clockwise', () => {
        const expectedJson = loadParserJsonResult('arc-angle-ccw-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-angle-ccw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace with arc with angle and only single VX', () => {
        const expectedJson = loadParserJsonResult('arc-angle-single-vx-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-angle-single-vx.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace starting with clockwise and counter-clockwise arc definition', () => {
        const expectedJson = loadParserJsonResult('arc-cw-ccw-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-cw-ccw.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse airspace starting with arc definition', () => {
        const expectedJson = loadParserJsonResult('arc-first-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/arc-first.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse custom airway definition', () => {
        const expectedJson = loadParserJsonResult('awy-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/airway.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from received json

        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
});

describe('Format Version 2: Test parse airspace definition blocks', () => {
    test('parse airspace with optional AY type command', () => {
        expectFixtureToMatchExpectedResult('ay.txt', 'ay-result.json');
    });
    test('parse airspace without AY type command', () => {
        expectFixtureToMatchExpectedResult('ay-missing.txt', 'ay-missing-result.json');
    });
    test('parse airspace with AF frequency command and missing optional AG ground station', () => {
        expectFixtureToMatchExpectedResult('af-only.txt', 'af-only-result.json');
    });
    test('parse airspace with AF frequency before AG ground station command', () => {
        expectFixtureToMatchExpectedResult('af-before-ag.txt', 'af-before-ag-result.json');
    });
    test('parse airspace with AG ground station before AF frequency command', () => {
        expectFixtureToMatchExpectedResult('ag-before-af.txt', 'ag-before-af-result.json');
    });
    test('parse airspace with AF and AG commands after altitude commands', () => {
        expectFixtureToMatchExpectedResult('af-ag-after-altitude.txt', 'af-ag-after-altitude-result.json');
    });
    test('parse airspace with AF and AG commands in arbitrary order', () => {
        expectFixtureToMatchExpectedResult('af-ag-arbitrary-order.txt', 'af-ag-arbitrary-order-result.json');
    });
    test('parse airspace with multiple AA activation windows including open intervals', () => {
        expectFixtureToMatchExpectedResult('aa-multiple.txt', 'aa-multiple-result.json');
    });
    test('parse airspace with all version 2 commands', () => {
        expectFixtureToMatchExpectedResult('version2-all-commands.txt', 'version2-all-commands-result.json');
    });
    test('parse activation times', () => {
        const expectedJson = loadParserJsonResult('activation-times-result.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/activation-times.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from received json

        expectedJson.features.map((value: any) => delete value.geometry);
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);
        geojson.features.map((value: any) => delete value.geometry);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse activation time by NOTAM', () => {
        const expectedJson = loadParserJsonResult('activation-times-none-result.json');
        const openairParser = new Parser();
        const { success } = openairParser.parse('./tests/fixtures/activation-times-none.txt');
        const geojson = openairParser.toGeojson();
        // remove unnecessary props from received json
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);
        geojson.features.map((value: any) => delete value.geometry);

        expect(success).toBe(true);
        expect(geojson).toEqual(expectedJson);
    });
    test('parse activation times and warn if expired', () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const openairParser = new Parser({ warnIfExpired: true });
        const { success } = openairParser.parse('./tests/fixtures/version-2-warn-if-expired.txt');

        expect(success).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledTimes(3);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('WARN: Expired activation end date'));
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
    test('convert to default units if no target altitude unit is specified', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/meter-altitude-unit.txt');
        const geojson = openairParser.toGeojson();

        expect(success).toBe(true);
        expect(geojson?.features?.[0]?.properties?.upperCeiling?.unit).toEqual(AltitudeUnitEnum.FLIGHT_LEVEL);
        expect(geojson?.features?.[0]?.properties?.lowerCeiling?.unit).toEqual(AltitudeUnitEnum.FEET);
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
        expect(error?.message).toEqual(
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
        expect(error?.message).toEqual(
            "Error found at line 14: Error found at line 14: Unknown coordinate definition 'DP 45:49:51 N 008:42:'"
        );
    });
    test('airspace with slef-intersection', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/self-intersecting.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual(
            "Error found at line 1: Geometry of airspace 'PARC/RESERVE  PYRENNEES 1000M/SOL' starting on line 1 is invalid due to self intersection."
        );
    });
    test('airspace with intersection converted into LINESTRING geometry return geometry', () => {
        const expectedJson = loadParserJsonResult('convert-self-intersecting-to-linestring-result.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            outputGeometry: OutputGeometryEnum.LINESTRING,
        });
        const { success } = openairParser.parse('./tests/fixtures/self-intersecting.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

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
        expect(error?.message).toEqual(
            "Error found at line 1: Geometry of airspace 'CTR TOO-FEW-POINTS' starting on line 1 has insufficient number of coordinates: 3"
        );
    });
    test('airspace with invalid geometry with self intersection can be fixed', () => {
        const expectedJson = loadParserJsonResult('fixed-self-intersecting.json');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/self-intersecting.txt');
        const geojson = openairParser.toGeojson();
        // remove properties for comparison
        geojson.features.map((value) => delete value.id);
        geojson.features.map((value) => delete (value.properties as any).id);

        expect(success).toBe(true);
        expect(error).toBeUndefined();
        expect(geojson).toEqual(expectedJson);
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
        expect(error?.message).toEqual(
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
        expect(error?.message).toEqual(
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
        expect(error?.message).toEqual('Error found at line 10: Lower limit must be less than upper limit');
    });
    test('airspace start and end coordinates are not equal', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/start-end-coordinates-not-equal.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual(
            "Error found at line 2: Geometry of airspace 'RMZ Rochefort 119.3' starting on line 2 is invalid. First and last Position are not equivalent."
        );
    });
    test('parse airspace with zero radius circle geometry', () => {
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/circle-radius-zero.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual("Error found at line 6: Error found at line 6: Invalid circle radius '0'");
    });
    test('airspace with coordinate minutes set to 60 are rejected', () => {
        // read from expected file and remove last "blank line" in file (automatically added by IDE)
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/coordinate-minutes-60.txt');
        expect(success).toBe(false);
        expect(error?.message).toBeDefined;
        expect(error?.message).toBe(
            "Error found at line 6: Error found at line 6: Unknown coordinate definition 'DP 42:60:57 N 000:60:00 W'"
        );
    });
    test('airspace with coordinate seconds set to 60 are rejected', () => {
        // read from expected file and remove last "blank line" in file (automatically added by IDE)
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
            fixGeometry: true,
        });
        const { success, error } = openairParser.parse('./tests/fixtures/coordinate-seconds-60.txt');
        expect(success).toBe(false);
        expect(error?.message).toBeDefined;
        expect(error?.message).toBe(
            "Error found at line 6: Error found at line 6: Unknown coordinate definition 'DP 42:00:60 N 001:00:60 W'"
        );
    });
});

describe('Version 2: Test parse invalid airspace definition blocks', () => {
    test('single airspace with AG and missing AF tag', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/single-airspace-ag-but-missing-af.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual("Error found at line 5: Token 'AG' is present but token 'AF' is missing.");
    });
    test('single airspace with invalid AX tag', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/transponder-code-invalid.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual(
            "Error found at line 8: Error found at line 8: Invalid transponder code string 'AX 7891'"
        );
    });
    test('single airspace with missing AL and AH tags', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/missing-ah-al.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual(
            'Error found at line 3: Airspace definition block is missing required tokens: AL, AH'
        );
    });
    test('airspace with invalid activation times', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/activation-times-invalid.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual(
            "Error found at line 9: Error found at line 9: Invalid activation times format 'AA 2025-01-02T14:00Z/2025-01-01T15:00Z'. Start date must be before end date."
        );
    });
    test('airspace with invalid activation times with none', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/activation-times-invalid-with-none.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual(
            'Error found at line 9: Additional activation times are not allowed with BY NOTAM activation.'
        );
    });
    test('airspace with invalid activation times with deprecated none/none', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/activation-times-invalid-with-none-none.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual(
            `Error found at line 8: Error found at line 8: Invalid activation times format found at 'AA NONE/NONE'. At least one of the start or end must be specified or only NONE.`
        );
    });
    test('airspace with invalid flight level declaration missing number', () => {
        const openairParser = new Parser();
        const { success, error } = openairParser.parse('./tests/fixtures/flight-level-missing-number.txt');

        expect(success).toBe(false);
        expect(error).toBeDefined();
        expect(error?.message).toEqual(
            `Error found at line 6: Error found at line 6: Unknown altitude definition 'FL'`
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

// See https://github.com/openAIP/openaip-openair-parser/issues/53 - duplicate point removal must never alter the
// defined geometry. Only points that repeat their direct predecessor are removed, a point the outline passes again
// later is kept.
describe('Test duplicate point removal does not alter the defined geometry', () => {
    test('airspace with consecutive duplicate points is valid and reduced to the plain square', () => {
        // VALID input - the repeated point directly follows itself, i.e. it is a zero-length edge
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/duplicate-points-consecutive.txt');
        const feature = openairParser.toGeojson().features[0] as Feature<Polygon>;
        const outline = feature.geometry.coordinates[0];

        expect(success).toBe(true);
        expect(outline.length).toEqual(5);
        expect(Math.abs(area(feature) - getIntendedArea(SQUARE_OUTER_RING, []))).toBeLessThan(AREA_TOLERANCE);
    });
    test('airspace with seam encoded hole defined outer ring first keeps all revisited points if not validated', () => {
        const feature = parseUnvalidatedPolygon('seam-hole-outer-ring-first.txt');
        const outline = feature.geometry.coordinates[0];

        // all 11 defined points are kept - previously the 2nd visits of P and Q were removed, cutting a quarter away
        expect(outline.length).toEqual(11);
        // the hole is defined opposite to the outer ring, so the area of the raw outline is outer square minus hole
        expect(Math.abs(area(feature) - SEAM_HOLE_OUTER_RING_FIRST_AREA)).toBeLessThan(AREA_TOLERANCE);
    });
    test('airspace with seam encoded hole defined hole first keeps all revisited points if not validated', () => {
        const feature = parseUnvalidatedPolygon('seam-hole-hole-first.txt');

        // all 22 defined points are kept - the area is NOT asserted: the hole is defined in the same direction as the
        // outer ring, so the area of the raw outline is outer ring PLUS hole
        expect(feature.geometry.coordinates[0].length).toEqual(22);
    });
});

// OpenAir has no record for an inner ring - an airspace with a hole is written with a "seam": the outline runs from
// the outer ring to the hole, around the hole, back along the same edge, and on around the outer ring. The outline
// touches itself at both ends of each seam, i.e. it is INVALID and rejected by default. With "fixGeometry" it is
// converted into a single simple "keyhole" polygon whose bridge return path is offset by 1m.
describe('Test airspace with seam encoded holes', () => {
    test('airspace with seam encoded hole defined outer ring first is rejected by default', () => {
        expectRejectedDueToSelfIntersection('seam-hole-outer-ring-first.txt', 'Square with a hole');
    });
    test('airspace with seam encoded hole defined outer ring first is fixed into a keyhole polygon', () => {
        const { geometry, geometryArea } = parseFixedSimplePolygon('seam-hole-outer-ring-first.txt');

        // same number of points as defined - only the 2nd visits of P and Q are moved by 1m
        expect(geometry.coordinates[0].length).toEqual(11);
        expect(Math.abs(geometryArea - SEAM_HOLE_OUTER_RING_FIRST_AREA)).toBeLessThan(AREA_TOLERANCE);
    });
    test('airspace with seam encoded hole defined hole first is rejected by default', () => {
        expectRejectedDueToSelfIntersection('seam-hole-hole-first.txt', 'Frankfurt');
    });
    test('airspace with seam encoded hole defined hole first is fixed into a keyhole polygon', () => {
        const { geometryArea } = parseFixedSimplePolygon('seam-hole-hole-first.txt');

        expect(Math.abs(geometryArea - SEAM_HOLE_HOLE_FIRST_AREA)).toBeLessThan(AREA_TOLERANCE);
    });
    test('airspace with two seam encoded holes is rejected by default', () => {
        expectRejectedDueToSelfIntersection('seam-two-holes.txt', 'Square with two holes');
    });
    test('airspace with two seam encoded holes is fixed into a keyhole polygon', () => {
        const { geometryArea } = parseFixedSimplePolygon('seam-two-holes.txt');
        const intendedArea = getIntendedArea(SQUARE_OUTER_RING, [
            rectangle(dm(50, 7), dm(8, 3), dm(50, 3), dm(8, 8)),
            rectangle(dm(50, 7), dm(8, 12), dm(50, 3), dm(8, 17)),
        ]);

        expect(Math.abs(geometryArea - intendedArea)).toBeLessThan(AREA_TOLERANCE);
    });
});

// A loop that touches the outer ring at a single vertex - without a seam - makes the outline touch itself at that
// vertex, i.e. it is INVALID and rejected by default. With "fixGeometry", a loop inside the outer ring is a hole and
// becomes a keyhole, a loop outside the outer ring is NOT a hole and is discarded.
describe('Test airspace with loops touching the outer ring', () => {
    test('airspace with hole touching the outer ring is rejected by default', () => {
        expectRejectedDueToSelfIntersection(
            'hole-touching-outer-ring.txt',
            'Square with a hole touching the outer ring'
        );
    });
    test('airspace with hole touching the outer ring is fixed into a keyhole polygon', () => {
        const { geometryArea } = parseFixedSimplePolygon('hole-touching-outer-ring.txt');
        const hole = [
            [dm(8, 10), dm(50, 10)],
            [dm(8, 13), dm(50, 6)],
            [dm(8, 7), dm(50, 6)],
            [dm(8, 10), dm(50, 10)],
        ];

        expect(Math.abs(geometryArea - getIntendedArea(SQUARE_OUTER_RING, [hole]))).toBeLessThan(AREA_TOLERANCE);
    });
    test('airspace with lobe touching the outer ring is rejected by default', () => {
        expectRejectedDueToSelfIntersection(
            'lobe-touching-outer-ring.txt',
            'Square with a lobe touching the outer ring'
        );
    });
    test('airspace with lobe touching the outer ring is fixed into its largest loop, not into a keyhole polygon', () => {
        const { geometry, geometryArea } = parseFixedSimplePolygon('lobe-touching-outer-ring.txt');

        // the lobe is discarded, the square is kept and NOT reduced by the lobe area
        expect(geometry.coordinates[0].length).toEqual(5);
        expect(Math.abs(geometryArea - getIntendedArea(SQUARE_OUTER_RING, []))).toBeLessThan(AREA_TOLERANCE);
    });
});

describe('Test output formats', () => {
    test('check correct openair output', () => {
        // read from expected file and remove last "blank line" in file (automatically added by IDE)
        const expected = fs.readFileSync('./tests/fixtures/expected-output-openair.txt', 'utf-8').split('\n');
        const openairParser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            allowedClasses: ALLOWED_CLASSES_VERSION_1,
        });
        const { success } = openairParser.parse('./tests/fixtures/in-output-openair.txt');
        const openair = openairParser.toOpenair();

        expect(success).toBe(true);
        // make sure to also take "last blank line added by IDE" into account
        expect(removeBlanksAtEof(openair).join('\n')).toEqual(removeBlanksAtEof(expected).join('\n'));
    });
});

// maximum allowed deviation from the intended area in m2 - covers the hairline channel of a keyhole polygon
const AREA_TOLERANCE = 0.1 * 1000 * 1000;

/**
 * Converts degrees and minutes into decimal degrees.
 */
function dm(degrees: number, minutes: number): number {
    return degrees + minutes / 60;
}

/**
 * Creates a closed rectangular ring from its north-west and south-east corner.
 */
function rectangle(north: number, west: number, south: number, east: number): number[][] {
    return [
        [west, north],
        [west, south],
        [east, south],
        [east, north],
        [west, north],
    ];
}

// outer ring 50:10N-50:00N / 008:00E-008:20E shared by the hole fixtures
const SQUARE_OUTER_RING = rectangle(dm(50, 10), dm(8, 0), dm(50, 0), dm(8, 20));
// intended area of "seam-hole-outer-ring-first.txt" - outer square minus the hole, 387.9 km2
const SEAM_HOLE_OUTER_RING_FIRST_AREA = getIntendedArea(SQUARE_OUTER_RING, [
    rectangle(dm(50, 7), dm(8, 7), dm(50, 3), dm(8, 13)),
]);
// intended area of "seam-hole-hole-first.txt" - 1471.9 km2 outer ring minus the 443.9 km2 hole (Frankfurt CTR)
const SEAM_HOLE_HOLE_FIRST_AREA = 1028.0 * 1000 * 1000;

/**
 * Returns the area in m2 of a polygon with holes, i.e. the area the OpenAir definition is meant to describe.
 */
function getIntendedArea(outerRing: number[][], holes: number[][][]): number {
    return area(polygon([outerRing, ...holes]));
}

/**
 * Parses the given fixture with "fixGeometry" and asserts that the result is a single simple polygon without
 * revisited vertices and self intersections.
 */
/**
 * Parses the given fixture with the default configuration and asserts that it is rejected due to self intersection.
 */
function expectRejectedDueToSelfIntersection(fixtureFilename: string, airspaceName: string) {
    const openairParser = new Parser({
        version: ParserVersionEnum.VERSION_1,
        allowedClasses: ALLOWED_CLASSES_VERSION_1,
    });
    const { success, error } = openairParser.parse(`./tests/fixtures/${fixtureFilename}`);

    expect(success).toBe(false);
    expect(error?.message).toEqual(
        `Error found at line 1: Geometry of airspace '${airspaceName}' starting on line 1 is invalid due to self intersection.`
    );
}

/**
 * Parses the given fixture without geometry validation and returns the unaltered polygon.
 */
function parseUnvalidatedPolygon(fixtureFilename: string): Feature<Polygon> {
    const openairParser = new Parser({
        version: ParserVersionEnum.VERSION_1,
        allowedClasses: ALLOWED_CLASSES_VERSION_1,
        validateGeometry: false,
    });
    const { success } = openairParser.parse(`./tests/fixtures/${fixtureFilename}`);
    expect(success).toBe(true);

    return openairParser.toGeojson().features[0] as Feature<Polygon>;
}

function parseFixedSimplePolygon(fixtureFilename: string): { geometry: Polygon; geometryArea: number } {
    const openairParser = new Parser({
        version: ParserVersionEnum.VERSION_1,
        allowedClasses: ALLOWED_CLASSES_VERSION_1,
        fixGeometry: true,
    });
    const { success, error } = openairParser.parse(`./tests/fixtures/${fixtureFilename}`);
    expect(error).toBeUndefined();
    expect(success).toBe(true);
    const feature = openairParser.toGeojson().features[0] as Feature<Polygon>;
    const { geometry } = feature;

    expect(geometry.type).toEqual('Polygon');
    expect(geometry.coordinates.length).toEqual(1);
    const vertices = geometry.coordinates[0].slice(0, -1).map((coord) => coord.join(','));
    expect(new Set(vertices).size).toEqual(vertices.length);
    expect(kinks(feature).features).toEqual([]);

    return { geometry, geometryArea: area(feature) };
}

function loadParserJsonResult(filename: string) {
    const filePath = path.resolve(`${appRoot}/tests/fixtures/${filename}`);
    const fileContent = fs.readFileSync(filePath);

    return JSON.parse(fileContent.toString());
}

/**
 * Parses the given fixture file (relative to "tests/fixtures") and asserts that parsing succeeds and that the
 * resulting GeoJSON properties match the expected result JSON file. Geometry and internal ids are removed before
 * comparison - only properties are checked.
 */
function expectFixtureToMatchExpectedResult(fixtureFilename: string, expectedResultFilename: string) {
    const expectedJson = loadParserJsonResult(expectedResultFilename);
    const openairParser = new Parser();
    const { success } = openairParser.parse(`./tests/fixtures/${fixtureFilename}`);
    const geojson = openairParser.toGeojson();
    // remove unnecessary props from received json - only check properties

    expectedJson.features.map((value: any) => delete value.geometry);
    geojson.features.map((value) => delete value.id);
    geojson.features.map((value) => delete (value.properties as any).id);
    geojson.features.map((value: any) => delete value.geometry);

    expect(success).toBe(true);
    expect(geojson).toEqual(expectedJson);
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
