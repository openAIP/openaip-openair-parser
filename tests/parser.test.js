const Parser = require('../src/parser');

describe('test tokenize ignored line', () => {
    test('handle ignored lines', async () => {
        const openairParser = new Parser();
        const result = await openairParser.parse('./tests/fixtures/ignored-only.txt');

        expect(result.success).toBe(true);
    });
});

describe('test tokenize AC line', () => {
    test('read AC definitions', async () => {
        const openairParser = new Parser();
        const result = await openairParser.parse('./tests/fixtures/ac-definitions.txt');

        expect(result.success).toBe(true);
    });

    test('read AC definition with restricted classes', async () => {
        const classes = ['R', 'RMZ', 'TMZ'];

        const openairParser = new Parser({ restrictAcClasses: classes });
        const result = await openairParser.parse('./tests/fixtures/ac-definitions.txt');

        expect(result.success).toBe(false);
        expect(result.errors.length).toBe(2);
    });

    test('read AC definition with invalid classes', async () => {
        const openairParser = new Parser();
        const result = await openairParser.parse('./tests/fixtures/ac-definitions-invalid.txt');

        expect(result.success).toBe(false);
        expect(result.errors.length).toBe(2);
    });
});

describe('test tokenize AH/AL lines', () => {
    test('read AH definitions', async () => {
        const openairParser = new Parser();
        const result = await openairParser.parse('./tests/fixtures/ah-definitions.txt');

        expect(result.success).toBe(true);
    });
});

describe('test tokenize DP lines', () => {
    test('read DP definitions', async () => {
        const openairParser = new Parser();
        const result = await openairParser.parse('./tests/fixtures/dp-definitions.txt');

        expect(result.success).toBe(true);
    });
});

describe('parse airspace definitions', () => {
    test('parse simple airspace definition', async () => {
        const openairParser = new Parser();
        const result = await openairParser.parse('./tests/fixtures/simple-airspace.txt');

        expect(result.success).toBe(true);
    });

    test('parse circle airspace definition', async () => {
        const openairParser = new Parser();
        const result = await openairParser.parse('./tests/fixtures/circle-airspace.txt');

        expect(result.success).toBe(true);
    });

    test('parse arc airspace definition', async () => {
        const openairParser = new Parser();
        const result = await openairParser.parse('./tests/fixtures/arc-airspace.txt');

        expect(result.success).toBe(true);
    });
});
