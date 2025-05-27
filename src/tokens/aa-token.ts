import { z } from 'zod';
import { ParserError } from '../parser-error';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

export const BY_NOTAM_ACTIVATION = 'BY_NOTAM';

type Activation = {
    // ISO 8601 date-time format
    start?: string;
    // ISO 8601 date-time format
    end?: string;
};

type Metadata = { activation: Activation | typeof BY_NOTAM_ACTIVATION };

/**
 * Tokenizes "AA" token value which is a sequence of at least one AA command and possible
 * subsequent AA commands directly following the first AA command.
 */
export class AaToken extends AbstractLineToken<Metadata> {
    static type: TokenType = TokenTypeEnum.AA;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is AA line e.g. "AA 2023-12-16T12:00Z/2023-12-16T13:00Z" or "NONE/2023-12-16T13:00Z" or "AA 2023-12-16T12:00Z/NONE" or "NONE"
        return /^AA\s+.*$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new AaToken({ tokenTypes: this._tokenTypes, version: this._version });
        // keep original line
        token._line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const linePartActivationWindow = line.replace(/^AA\s+/, '');
        // split activation window into start and end
        const activationParts = linePartActivationWindow.split('/');
        // handle "NONE" case
        if (activationParts.length === 1 && activationParts[0] === 'NONE') {
            token._tokenized = {
                line,
                lineNumber,
                metadata: { activation: BY_NOTAM_ACTIVATION },
            };
            return token;
        }
        const start = activationParts[0];
        const end = activationParts[1];
        // validate activation times string
        const isValidStart = this.isValidActivationTime(start);
        const isValidEnd = this.isValidActivationTime(end);
        if (isValidStart === false || isValidEnd === false) {
            throw new ParserError({
                lineNumber,
                errorMessage: `Invalid activation times format found at '${line}'. Start and end must be in ISO 8601 date-time format or NONE.`,
            });
        }
        const startDate = start === 'NONE' ? undefined : this.removeMilliseconds(start);
        const endDate = end === 'NONE' ? undefined : this.removeMilliseconds(end);
        if (startDate == null && endDate == null) {
            throw new ParserError({
                lineNumber,
                errorMessage: `Invalid activation times format found at '${line}'. At least one of the start or end must be specified or only NONE.`,
            });
        }
        // validate start and end, start must be before end
        if (startDate != null && endDate != null && startDate >= endDate) {
            throw new ParserError({
                lineNumber,
                errorMessage: `Invalid activation times format '${line}'. Start date must be before end date.`,
            });
        }
        const time: Partial<Activation> = {};
        if (startDate != null) {
            time.start = startDate;
        }
        if (endDate != null) {
            time.end = endDate;
        }
        token._tokenized = {
            line,
            lineNumber,
            metadata: { activation: time },
        };

        return token;
    }

    private isValidActivationTime(activationTime: string): boolean {
        if (activationTime === 'NONE') {
            return true;
        }
        try {
            // parse the activation time as ISO 8601 date-time format that MUST be in UTC, i.e "ZULU" time
            // e.g. "2023-12-16T12:00Z" or "2023-12-16T12:00:00Z"
            const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z$/;
            if (iso8601Regex.test(activationTime) === false) {
                return false;
            }
            // try to parse the activation time as ISO 8601 date-time format
            const date = new Date(activationTime);

            return isNaN(date.getTime()) === false;
        } catch (err) {
            return false;
        }
    }

    private removeMilliseconds(isoString: string): string {
        const date = new Date(isoString);
        return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.AA,
            TokenTypeEnum.AF,
            TokenTypeEnum.AG,
            TokenTypeEnum.AL,
            TokenTypeEnum.AH,
            TokenTypeEnum.SKIPPED,
            TokenTypeEnum.DP,
            TokenTypeEnum.VW,
            TokenTypeEnum.VX,
            TokenTypeEnum.VD,
            TokenTypeEnum.AX,
        ];
    }
}
