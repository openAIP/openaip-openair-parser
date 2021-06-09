const Parser = require('../src/parser');

describe('test tokenize ignored line', () => {
    test('handle ignored lines', async () => {
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/ignored-only.txt');

        expect(true).toEqual(true);
    });
});

describe('test tokenize AC line', () => {
    test('read AC definitions', async () => {
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/ac-definitions.txt');

        expect(openairParser.getErrors().length).toBe(0);
    });
    test('read AC definition with restricted classes', async () => {
        const classes = ['R', 'RMZ', 'TMZ'];

        const openairParser = new Parser({ restrictAcClasses: classes });
        await openairParser.parse('./tests/fixtures/ac-definitions.txt');

        // file contains 2 not allowed classes
        expect(openairParser.getErrors().length).toBe(2);
    });
    test('read AC definition with invalid classes', async () => {
        const openairParser = new Parser();
        await openairParser.parse('./tests/fixtures/ac-definitions-invalid.txt');

        // file contains 2 not allowed classes
        expect(openairParser.getErrors().length).toBe(2);
    });
});
