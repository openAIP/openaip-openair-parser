import { z } from 'zod';
import { validateSchema } from '../validate-schema.js';
import { AbstractLineToken, type IToken } from './abstract-line-token.js';
import { TokenTypeEnum, type TokenType } from './token-type.enum.js';

type Metadata = {
    // radius in meters
    radius: number;
    startBearing: number;
    endBearing: number;
};

/**
 * Tokenizes "DA" airspace arc definition token.
 */
export class DaToken extends AbstractLineToken<Metadata> {
    public static TYPE: TokenType = TokenTypeEnum.DA;

    canHandle(line: string): boolean {
        // IMPORTANT only validate string - string MAY be empty
        validateSchema(line, z.string(), { assert: true, name: 'line' });

        // is DA line e.g. "DA 0.25,-57,123" as well as "DA 0.25,57.56,270.5"
        return /^DA\s+([+-]?\d*(\.\d+)?),\s*([+-]?\d*(\.\d+)?),\s*([+-]?\d*(\.\d+)?)$/.test(line);
    }

    tokenize(line: string, lineNumber: number): IToken {
        validateSchema(line, z.string().nonempty(), { assert: true, name: 'line' });
        validateSchema(lineNumber, z.number(), { assert: true, name: 'lineNumber' });

        const token = new DaToken({ tokenTypes: this.tokenTypes, version: this.version });
        // keep original line
        token.line = line;
        // remove inline comments
        line = line.replace(/\s?\*.*/, '');
        const arcPartsDefinition = line.replace(/^DA\s+/, '');
        // DA arc definition has three parts: "radius,angelStart,angleEnd" => radius is in NM
        const arcParts = arcPartsDefinition.split(',');
        arcParts.map((value) => value.trim());
        const [radius, angleStart, angleEnd] = arcParts;
        // angle to bearing
        const startBearing = this.toBearing(parseFloat(angleStart));
        const endBearing = this.toBearing(parseFloat(angleEnd));
        // convert radius to meters
        const radiusM = parseFloat(radius) * 1852;
        // convert angles to bearings
        token.tokenized = {
            line,
            lineNumber,
            metadata: {
                radius: radiusM,
                startBearing: startBearing,
                endBearing: endBearing,
            },
        };

        return token;
    }

    getAllowedNextTokens(): TokenType[] {
        return [
            TokenTypeEnum.BLANK,
            TokenTypeEnum.COMMENT,
            TokenTypeEnum.DA,
            TokenTypeEnum.DP,
            TokenTypeEnum.VD,
            TokenTypeEnum.VX,
            TokenTypeEnum.SKIPPED,
        ];
    }

    protected toBearing(angle: number): number {
        angle = parseFloat(angle.toString());

        let bearing = angle % 360;
        if (bearing < 0) bearing += 360;

        return bearing;
    }
}
