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

/**
 * Reads content of an openAIR formatted file and returns a normalized representation. For convenience,
 * JSON and GeoJSON formatters are included.
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

        /*
        Tokenize the file contents and will result in a list of tokens and a list of syntax
        errors encountered during tokenization. Each token represents a single line and hold a
        "prepared value" if each line, e.g. "DP 52:24:33 N 013:11:02 E" will be converted into
        a object that contains valid coordinate decimals.

        IMPORTANT If syntax errors occur, the parser will return the result of the tokenizer only.
         */
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
