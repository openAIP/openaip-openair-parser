import { describe, expect, test } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

describe('Parser.parseAsync true parallelism (Node workers)', () => {
    test('parses multiple airspaces using parseAsync', () => {
        execSync('npm run build', { stdio: 'inherit' });
        const repoRoot = process.cwd();
        const input = path.join(repoRoot, 'tests/fixtures/multi-airspace.txt');
        const runner = `
import { Parser } from '../dist/parser.js';
import { ParserVersionEnum } from '../dist/parser-version.enum.js';
const parser = new Parser({ version: ParserVersionEnum.VERSION_1, useWorkers: true, validateGeometry: true, allowedClasses: ['A','B','C','D','E','F','G','R','UNCLASSIFIED'] });
const res = await parser.parseAsync('${input.replace(/\\/g, '\\\\')}');
if (!res.success) { console.error(res.error.errorMessage); process.exit(1); }
const gj = parser.toGeojson();
console.log(gj.features.length);
`;
        const runnerPath = path.join(repoRoot, 'var/parse-async-runner.mjs');
        execSync(`mkdir -p var`, { stdio: 'inherit' });
        require('fs').writeFileSync(runnerPath, runner, 'utf-8');
        const out = execSync(`node ${runnerPath}`, { encoding: 'utf-8' });
        const count = parseInt(out.trim(), 10);
        expect(count).toBeGreaterThanOrEqual(2);
    });
});

