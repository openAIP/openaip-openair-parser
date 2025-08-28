import { parentPort } from 'node:worker_threads';
import type { Feature, LineString, Polygon } from 'geojson';
import { AirspaceFactory } from '../airspace-factory.js';
import { AltitudeUnitEnum, type AltitudeUnit } from '../altitude-unit.enum.js';
import { OutputGeometryEnum, type OutputGeometry } from '../output-geometry.enum.js';
import { ParserError } from '../parser-error.js';
import { ParserVersionEnum, type ParserVersion } from '../parser-version.enum.js';
import type { IToken } from '../tokens/abstract-line-token.js';
import { AaToken } from '../tokens/aa-token.js';
import { AcToken } from '../tokens/ac-token.js';
import { AfToken } from '../tokens/af-token.js';
import { AgToken } from '../tokens/ag-token.js';
import { AhToken } from '../tokens/ah-token.js';
import { AlToken } from '../tokens/al-token.js';
import { AnToken } from '../tokens/an-token.js';
import { AxToken } from '../tokens/ax-token.js';
import { AyToken } from '../tokens/ay-token.js';
import { BlankToken } from '../tokens/blank-token.js';
import { CommentToken } from '../tokens/comment-token.js';
import { DaToken } from '../tokens/da-token.js';
import { DbToken } from '../tokens/db-token.js';
import { DcToken } from '../tokens/dc-token.js';
import { DpToken } from '../tokens/dp-token.js';
import { DyToken } from '../tokens/dy-token.js';
import { EofToken } from '../tokens/eof-token.js';
import { SkippedToken } from '../tokens/skipped-token.js';
import { TokenTypeEnum, type TokenType } from '../tokens/token-type.enum.js';
import { VdToken } from '../tokens/vd-token.js';
import { VwToken } from '../tokens/vw-token.js';
import { VxToken } from '../tokens/vx-token.js';

type WorkerTask = {
    id: number;
    lines: { line: string; lineNumber: number }[];
    config: {
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
};

type WorkerResult = {
    id: number;
    feature: Feature<Polygon | LineString> | null;
};

if (parentPort == null) {
    throw new Error('Worker must be started as a worker thread');
}

const TOKEN_TYPES = Object.values(TokenTypeEnum) as TokenType[];
const debug = process.env.OPENAIR_WORKER_DEBUG === '1';
const log = (...args: unknown[]) => {
    if (debug) console.log('[Worker]', ...args);
};

function tokenizeLines(task: WorkerTask): IToken[] {
    const {
        version,
        allowedClasses,
        allowedTypes,
        unlimited,
        targetAltUnit,
        roundAltValues,
    } = task.config;

    const tokenizers: IToken[] = [
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
        // version 2 tokens
        new AyToken({ tokenTypes: TOKEN_TYPES, version, allowedTypes }),
        new AfToken({ tokenTypes: TOKEN_TYPES, version }),
        new AgToken({ tokenTypes: TOKEN_TYPES, version }),
        new AxToken({ tokenTypes: TOKEN_TYPES, version }),
        new AaToken({ tokenTypes: TOKEN_TYPES, version }),
    ];

    const tokens: IToken[] = [];
    for (const entry of task.lines) {
        const line = entry.line.trim();
        const lineNumber = entry.lineNumber;
        const tokenizer = tokenizers.find((t) => t.canHandle(line));
        if (tokenizer == null) {
            throw new ParserError({ lineNumber, errorMessage: `Failed to read line ${lineNumber}. Unknown syntax.` });
        }
        let token: IToken;
        try {
            token = tokenizer.tokenize(line, lineNumber);
        } catch (err) {
            let errorMessage = 'Unknown error occured';
            if (err instanceof Error) errorMessage = err.message;
            throw new ParserError({ lineNumber, errorMessage });
        }
        tokens.push(token);
    }
    // Do not append EOF for single-airspace block processing
    return tokens;
}

async function handleTask(task: WorkerTask): Promise<WorkerResult> {
    const {
        geometryDetail,
        version,
        validateGeometry,
        fixGeometry,
        includeOpenair,
        outputGeometry,
        consumeDuplicateBuffer,
        simplifyToleranceMeters,
    } = task.config;

    log('Handle task start', { id: task.id, lines: task.lines.length });
    const tokens = tokenizeLines(task);
    const factory = new AirspaceFactory({ geometryDetail, version });
    const airspace = factory.createAirspace(tokens);
    if (airspace == null) return { id: task.id, feature: null };

    const feature = airspace.asGeoJson({
        validateGeometry,
        fixGeometry,
        includeOpenair,
        outputGeometry,
        consumeDuplicateBuffer,
        simplifyToleranceMeters,
    });
    log('Handle task done', { id: task.id });
    return { id: task.id, feature };
}

let resultPort: any = parentPort;
let notifyArray: Int32Array | undefined;

parentPort.on('message', async (
    msg:
        | { type: 'init'; port: any }
        | { type: 'task'; payload: WorkerTask }
        | { type: 'end' }
) => {
    try {
        if (msg.type === 'init') {
            log('Init received');
            // @ts-ignore - MessagePort from main thread
            resultPort = msg.port ?? parentPort;
        } else if (msg.type === 'task') {
            log('Task received', { id: msg.payload.id });
            const result = await handleTask(msg.payload);
            resultPort!.postMessage(result);
        } else if (msg.type === 'end') {
            // graceful shutdown
            try { (resultPort as any)?.close?.(); } catch {}
            try { parentPort!.close(); } catch {}
        }
    } catch (err) {
        if (err instanceof ParserError) {
            parentPort!.postMessage({ id: (msg as any)?.payload?.id ?? -1, error: err.toString() });
        } else if (err instanceof Error) {
            parentPort!.postMessage({ id: (msg as any)?.payload?.id ?? -1, error: err.message });
        } else {
            parentPort!.postMessage({ id: (msg as any)?.payload?.id ?? -1, error: 'Unhandled error' });
        }
    }
});
