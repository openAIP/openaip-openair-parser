import type { Feature, LineString, Polygon } from 'geojson';
import { AirspaceFactory } from '../airspace-factory.js';
import type { AltitudeUnit } from '../altitude-unit.enum.js';
import type { OutputGeometry } from '../output-geometry.enum.js';
import type { ParserVersion } from '../parser-version.enum.js';
import { ParserError } from '../parser-error.js';
import { TokenTypeEnum } from '../tokens/token-type.enum.js';
import { CommentToken } from '../tokens/comment-token.js';
import { SkippedToken } from '../tokens/skipped-token.js';
import { BlankToken } from '../tokens/blank-token.js';
import { AcToken } from '../tokens/ac-token.js';
import { AnToken } from '../tokens/an-token.js';
import { AhToken } from '../tokens/ah-token.js';
import { AlToken } from '../tokens/al-token.js';
import { DpToken } from '../tokens/dp-token.js';
import { VdToken } from '../tokens/vd-token.js';
import { VxToken } from '../tokens/vx-token.js';
import { VwToken } from '../tokens/vw-token.js';
import { DcToken } from '../tokens/dc-token.js';
import { DbToken } from '../tokens/db-token.js';
import { DaToken } from '../tokens/da-token.js';
import { DyToken } from '../tokens/dy-token.js';
import { AyToken } from '../tokens/ay-token.js';
import { AfToken } from '../tokens/af-token.js';
import { AgToken } from '../tokens/ag-token.js';
import { AxToken } from '../tokens/ax-token.js';
import { AaToken } from '../tokens/aa-token.js';
import { EofToken } from '../tokens/eof-token.js';

export type BlockLine = { line: string; lineNumber: number };

export type ConvertTask = {
    id: number;
    lines: BlockLine[];
};

export type ConvertConfig = {
    version: ParserVersion;
    allowedClasses: string[];
    allowedTypes: string[];
    unlimited: number;
    targetAltUnit?: AltitudeUnit;
    roundAltValues: boolean;
    geometryDetail: number;
    validateGeometry: boolean;
    fixGeometry: boolean;
    includeOpenair: boolean;
    outputGeometry: OutputGeometry;
    consumeDuplicateBuffer: number;
    simplifyToleranceMeters?: number;
};

// Node path: do synchronous conversion (Parser API is sync). This mirrors AirspaceFactory usage.
export function convertBlocksInNode(tasks: ConvertTask[], config: ConvertConfig): Feature<Polygon | LineString, any>[] {
    const TOKEN_TYPES = Object.values(TokenTypeEnum);

    const features: Feature<Polygon | LineString, any>[] = [];
    for (const task of tasks) {
        const tokenizers = [
            new CommentToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new SkippedToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new BlankToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new AcToken({ tokenTypes: TOKEN_TYPES, version: config.version, allowedClasses: config.allowedClasses }),
            new AnToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new AhToken({ tokenTypes: TOKEN_TYPES, unlimited: config.unlimited, targetAltUnit: config.targetAltUnit, roundAltValues: config.roundAltValues, version: config.version }),
            new AlToken({ tokenTypes: TOKEN_TYPES, unlimited: config.unlimited, targetAltUnit: config.targetAltUnit, roundAltValues: config.roundAltValues, version: config.version }),
            new DpToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new VdToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new VxToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new VwToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new DcToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new DbToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new DaToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new DyToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new AyToken({ tokenTypes: TOKEN_TYPES, version: config.version, allowedTypes: config.allowedTypes }),
            new AfToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new AgToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new AxToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
            new AaToken({ tokenTypes: TOKEN_TYPES, version: config.version }),
        ];
        const tokens: any[] = [];
        for (const { line, lineNumber } of task.lines) {
            const trimmed = line.trim();
            const t = tokenizers.find((tok: any) => tok.canHandle(trimmed));
            if (!t) throw new ParserError({ lineNumber, errorMessage: `Failed to read line ${lineNumber}. Unknown syntax.` });
            tokens.push(t.tokenize(trimmed, lineNumber));
        }
        // Do not append EOF for single-airspace block processing to avoid accessing undefined tokenized on EOF.
        const factory = new AirspaceFactory({ geometryDetail: config.geometryDetail, version: config.version });
        const airspace = factory.createAirspace(tokens);
        if (airspace == null) continue;
        const feature = airspace.asGeoJson({ validateGeometry: config.validateGeometry, fixGeometry: config.fixGeometry, includeOpenair: config.includeOpenair, outputGeometry: config.outputGeometry, consumeDuplicateBuffer: config.consumeDuplicateBuffer, simplifyToleranceMeters: config.simplifyToleranceMeters });
        features.push(feature);
    }
    return features;
}
