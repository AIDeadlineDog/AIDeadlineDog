// Renders the extension icons from the single dog artwork in
// src/shared/dogArt.ts, so the toolbar icon, mascot, and panel all match.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Bundle the TS art module so this script can import it.
execSync(
  'npx esbuild src/shared/dogArt.ts --bundle --format=esm --outfile=.test-dist/dogArt.mjs --log-level=silent',
  { stdio: 'inherit' },
);
const { ICON_SVG } = await import('../.test-dist/dogArt.mjs');

mkdirSync('icons', { recursive: true });
for (const size of [16, 48, 128]) {
  const png = new Resvg(ICON_SVG, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`icons/icon${size}.png`, png);
  console.log(`icons/icon${size}.png (${size}x${size})`);
}
