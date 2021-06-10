const IgnoredLineToken = require('./tokens/ignored-line-token');
const AcToken = require('./tokens/ac-token');
const AnToken = require('./tokens/an-token');
const AhToken = require('./tokens/ah-token');
const AlToken = require('./tokens/al-token');
const DpToken = require('./tokens/dp-token');
const LineByLine = require('n-readlines');
const fs = require('fs');

/**
 * @typedef typedefs.openaipOpenairParser.ParserConfig
 * @param {string} [encoding] - Sets the encoding to use. Defaults to 'utf-8'.
 */

class Tokenizer {
    constructor(config) {
        this._config = config || { encoding: 'utf-8' };
        this._tokenizers = [
            new IgnoredLineToken(),
            new AcToken({ restrictAcClasses: this._config.restrictAcClasses }),
            new AnToken(),
            new AhToken(),
            new AlToken(),
            new DpToken(),
        ];
        this._tokens = [];
        this._currentLine = 0;
        this._errors = [];
    }

    tokenize(filepath) {
        const liner = new LineByLine(filepath);
        let line;

        while ((line = liner.next())) {
            this._currentLine++;
            const linestring = line.toString();

            // find the tokenizer that can handle the current line
            const lineToken = this._tokenizers.find((value) => value.canHandle(linestring));
            if (lineToken == null) {
                // fail hard if unable to find a tokenizer for a specific line
                throw new SyntaxError(`Failed to read line ${this._currentLine}. Unknown syntax.`);
            }

            try {
                lineToken.tokenize(linestring, this._currentLine);
                this._tokens.push(lineToken);
            } catch (e) {
                this._error(line, this._currentLine, e.message);
            }
        }

        return;
    }

    /**
     * @return {{line: string, lineNumber: number, errorMessage: string}[]}
     */
    getErrors() {
        return this._errors;
    }

    _error(line, lineNumber, errorMessage) {
        this._errors.push({
            line,
            lineNumber,
            errorMessage,
        });
    }

    async _enforceFileExists(filepath) {
        const exists = await fs.existsSync(filepath);
        if (!exists) {
            throw new Error(`Failed to read file ${filepath}`);
        }
    }

    /**
     * Resets the tokenizer status.
     */
    _reset() {
        this._currentLine = 0;
    }
}

module.exports = Tokenizer;
