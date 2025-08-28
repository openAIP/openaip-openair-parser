// Browser Worker implementation for bundlers
import type { Feature, LineString, Polygon } from 'geojson';
import { AirspaceFactory } from '../airspace-factory.js';
import { ParserError } from '../parser-error.js';
import { TokenTypeEnum, type TokenType } from '../tokens/token-type.enum.js';
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

type WorkerTask = {
    id: number;
    lines: { line: string; lineNumber: number }[];
    config: any;
};

const TOKEN_TYPES = Object.values(TokenTypeEnum) as TokenType[];

function tokenizeLines(task: WorkerTask): any[] {
    const { version, allowedClasses, allowedTypes, unlimited, targetAltUnit, roundAltValues } = task.config;
    const tokenizers: any[] = [
        new CommentToken({ tokenTypes: TOKEN_TYPES, version }),
        new SkippedToken({ tokenTypes: TOKEN_TYPES, version }),
        new BlankToken({ tokenTypes: TOKEN_TYPES, version }),
        new AcToken({ tokenTypes: TOKEN_TYPES, version, allowedClasses }),
        new AnToken({ tokenTypes: TOKEN_TYPES, version }),
        new AhToken({ tokenTypes: TOKEN_TYPES, unlimited, targetAltUnit, roundAltValues, version }),
        new AlToken({ tokenTypes: TOKEN_TYPES, unlimited, targetAltUnit, roundAltValues, version }),
        new DpToken({ tokenTypes: TOKEN_TYPES, version }),
        new VdToken({ tokenTypes: TOKEN_TYPES, version }),
        new VxToken({ tokenTypes: TOKEN_TYPES, version }),
        new VwToken({ tokenTypes: TOKEN_TYPES, version }),
        new DcToken({ tokenTypes: TOKEN_TYPES, version }),
        new DbToken({ tokenTypes: TOKEN_TYPES, version }),
        new DaToken({ tokenTypes: TOKEN_TYPES, version }),
        new DyToken({ tokenTypes: TOKEN_TYPES, version }),
        new AyToken({ tokenTypes: TOKEN_TYPES, version, allowedTypes }),
        new AfToken({ tokenTypes: TOKEN_TYPES, version }),
        new AgToken({ tokenTypes: TOKEN_TYPES, version }),
        new AxToken({ tokenTypes: TOKEN_TYPES, version }),
        new AaToken({ tokenTypes: TOKEN_TYPES, version }),
    ];
    const tokens: any[] = [];
    for (const entry of task.lines) {
        const line = entry.line.trim();
        const lineNumber = entry.lineNumber;
        const tokenizer = tokenizers.find((t) => t.canHandle(line));
        if (!tokenizer) throw new ParserError({ lineNumber, errorMessage: `Failed to read line ${lineNumber}. Unknown syntax.` });
        tokens.push(tokenizer.tokenize(line, lineNumber));
    }
    return tokens;
}

function handleTask(task: WorkerTask): { id: number; feature: Feature<Polygon | LineString> | null } {
    const { geometryDetail, version, validateGeometry, fixGeometry, includeOpenair, outputGeometry, consumeDuplicateBuffer, simplifyToleranceMeters } = task.config;
    const tokens = tokenizeLines(task);
    const factory = new AirspaceFactory({ geometryDetail, version });
    const airspace = factory.createAirspace(tokens);
    if (airspace == null) return { id: task.id, feature: null };
    const feature = airspace.asGeoJson({ validateGeometry, fixGeometry, includeOpenair, outputGeometry, consumeDuplicateBuffer, simplifyToleranceMeters });
    return { id: task.id, feature };
}

self.addEventListener('message', (ev: MessageEvent) => {
    const msg: any = ev.data;
    if (msg?.type === 'ready') {
        (self as any).postMessage({ ready: true });
        return;
    }
    if (msg?.type === 'task') {
        try {
            const result = handleTask(msg.payload as WorkerTask);
            (self as any).postMessage(result);
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Unhandled error';
            (self as any).postMessage({ id: (msg.payload as WorkerTask).id, error });
        }
        return;
    }
    if (msg?.type === 'end') {
        (self as any).close?.();
    }
});

