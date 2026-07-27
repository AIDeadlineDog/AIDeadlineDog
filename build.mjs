import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const options = {
  entryPoints: {
    background: 'src/background/serviceWorker.ts',
    content: 'src/content/index.ts',
    panel: 'src/panel/panel.ts',
    options: 'src/options/options.ts',
  },
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outdir: 'dist',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
};

function copyStatic() {
  cpSync('manifest.json', 'dist/manifest.json');
  cpSync('src/content/content.css', 'dist/content.css');
  cpSync('src/panel/panel.html', 'dist/panel.html');
  cpSync('src/panel/panel.css', 'dist/panel.css');
  cpSync('src/options/options.html', 'dist/options.html');
  cpSync('src/options/options.css', 'dist/options.css');
  cpSync('icons', 'dist/icons', { recursive: true });
  cpSync('_locales', 'dist/_locales', { recursive: true });
}

if (watch) {
  const ctx = await esbuild.context(options);
  copyStatic();
  await ctx.watch();
  console.log('watching…');
} else {
  await esbuild.build(options);
  copyStatic();
  console.log('build complete → dist/');
}
