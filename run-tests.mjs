// Bundles the TS test files with esbuild, then runs them via node --test.
import * as esbuild from 'esbuild';
import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const entries = globSync('tests/*.test.ts');
rmSync('.test-dist/tests', { recursive: true, force: true });
await esbuild.build({
  entryPoints: entries,
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  outdir: '.test-dist/tests',
  logLevel: 'silent',
});
const built = globSync('.test-dist/tests/*.test.js');
const result = spawnSync('node', ['--test', ...built], { stdio: 'inherit' });
process.exit(result.status ?? 1);
