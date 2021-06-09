const BaseLineToken = require('./base-line-token');
const checkTypes = require('check-types');

/**
 * @typedef typedefs.openaipOpenairParser.AcTokenizer
 * @param {string[]} [restrictAcClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 */

/**
 * A default list of allowed airspace classes that are common in openair files.
 *
 * @type {string[]}
 */
const defaultClasses = [
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
    'D',
    'Q',
    'WAVE',
    'GLIDING',
    'RMZ',
    'TMZ',
    'CTR',
];

/**
 * Tokenizes "AC" airspace class definitions.
 */
class AcToken extends BaseLineToken {
    /**
     * @param {typedefs.openaipOpenairParser.AcTokenizer} config
     */
    constructor(config) {
        const { restrictAcClasses } = config || {};

        super();

        this._restrictAcClasses = restrictAcClasses || defaultClasses;
    }

    canHandle(line) {
        checkTypes.assert.string(line);

        // is AC line e.g. "AC D"
        return /^AC\s+.*$/.test(line);
    }

    tokenize(line, lineNumber) {
        checkTypes.assert.string(line);
        checkTypes.assert.integer(lineNumber);

        // remove the AC part of the string to get the airspace class
        const linePartClass = line.replace(/^AC\s+/, '');

        // check restricted classes
        if (!this._restrictAcClasses.includes(linePartClass)) {
            throw new SyntaxError(`Unknown airspace class ${linePartClass}.`);
        }

        return { line, lineNumber, class: linePartClass };
    }
}

module.exports = AcToken;
