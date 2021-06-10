const Tokenizer = require('./tokenizer');

/**
 * @typedef typedefs.openaipOpenairParser.ParserConfig
 * @param {string} [encoding] - Sets the encoding to use. Defaults to 'utf-8'.
 * @param {string[]} [restrictAcClasses] - A list of allowed AC classes. If AC class found in AC definition is not found in this list, the parser will throw an error.
 * @param {number} [unlimited] - Defines the flight level to set if an airspace ceiling is defined with "unlimited". Defaults to 999;
 */

/**
 * @typedef typedefs.openaipOpenairParser.ParserResult
 * @param {boolean} success - If true, parsing was successful, false if not.
 * @param {Array} errors - A list of errors. Empty if parsing was successful.
 */

class Parser {
    /**
     * @param {typedefs.openaipOpenairParser.ParserConfig} [config] - The parser configuration
     */
    constructor(config) {
        this._config = config || { encoding: 'utf-8' };
    }

    /**
     * Tries to parse the file content.
     *
     * @param filepath
     * @return {Promise<typedefs.openaipOpenairParser.ParserResult>}
     */
    async parse(filepath) {
        // reset the parser status before reading new file
        this._reset();

        const tokenizer = new Tokenizer(this._config);
        await tokenizer.tokenize(filepath);

        // abort if tokenizer has syntax errors at this point
        if (tokenizer.hasErrors()) {
            const errors = tokenizer.getErrors();

            return {
                success: errors.length === 0,
                errors: errors,
            };
        }

        return {
            success: true,
            errors: [],
        };
    }

    /**
     * Resets the parser state.
     */
    _reset() {
        this._errors = [];
    }
}

module.exports = Parser;
