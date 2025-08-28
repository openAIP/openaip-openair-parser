import { describe, expect, test } from 'vitest';
import path from 'node:path';
import { Parser } from '../src/parser.js';
import { ParserVersionEnum } from '../src/parser-version.enum.js';

describe('Concurrent parsing abstraction (Node path)', () => {
    test('parses multiple airspaces using node promise abstraction', () => {
        process.env.OPENAIR_WORKER_DEBUG = '1';
        const repoRoot = process.cwd();
        const input = path.join(repoRoot, 'tests/fixtures/multi-airspace.txt');
        const parser = new Parser({
            version: ParserVersionEnum.VERSION_1,
            useWorkers: true,
            validateGeometry: true,
            allowedClasses: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'R', 'UNCLASSIFIED'],
        });
        const res = parser.parse(input);
        if (!res.success) {
            throw new Error(res.error.errorMessage);
        }
        const gj = parser.toGeojson();
        expect(gj.features.length).toBeGreaterThanOrEqual(2);
    });
});
