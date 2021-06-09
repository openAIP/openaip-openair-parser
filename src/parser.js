const Tokenizer = require('./tokenizer');

/**
 * @typedef typedefs.openaipOpenairParser.ParserConfig
 * @param {string} [encoding] - Sets the encoding to use. Defaults to 'utf-8'.
 * @param {string[]} [restrictAcClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 */

class Parser {
    /**
     * @param {typedefs.openaipOpenairParser.ParserConfig} [config] - The parser configuration
     */
    constructor(config) {
        this._config = config || { encoding: 'utf-8' };
        this._errors = [];
    }

    /**
     * Tries to parse the file content.
     *
     * @param filepath
     * @return {Promise<void>}
     */
    async parse(filepath) {
        // reset the parser status before reading new file
        this._reset();

        const tokenizer = new Tokenizer(this._config);
        await tokenizer.tokenize(filepath);
        this._errors = tokenizer.getErrors();

        return;
    }

    /**
     * @return {{line: string, lineNumber: integer, errorMessage: string}[]}
     */
    getErrors() {
        return this._errors;
    }

    /**
     * Resets the parser status.
     */
    _reset() {
        this._errors = [];
    }
}

module.exports = Parser;
