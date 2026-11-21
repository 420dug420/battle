// Builds the single-file pages in dist/: game.html (the campaign), arena.html (combat test), animator.html, armor-mock.html.
// Each page is a template with a marker replaced by an esbuild bundle (one file, works when opened from disk or published as an artifact).
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const bundle = async entry => (await esbuild.build({ entryPoints: [entry], bundle: true, format: 'iife', write: false, target: 'es2020', minify: false, legalComments: 'none' })).outputFiles[0].text
  .replace(/<\/script/gi, '<\\/script');                     // never close the inline <script> early
mkdirSync('dist', { recursive: true });
const page = (tpl, marker, js, out) => {
  const t = readFileSync(tpl, 'utf8'); if (!t.includes(marker)) throw new Error(marker + ' missing in ' + tpl);
  writeFileSync(out, t.split(marker).join(js)); console.log(out, (readFileSync(out).length / 1024).toFixed(0) + ' KB');
};
const rig = await bundle('animator/entry.js');
page('game/template.html', '/*BUNDLE*/', await bundle('game/app.js'), 'dist/arena.html');
page('campaign/template.html', '/*BUNDLE*/', await bundle('campaign/app.js'), 'dist/game.html');
page('animator/template.html', '/*MODEL3D*/', rig, 'dist/animator.html');
page('armor/mock.template.html', '/*MODEL3D*/', rig, 'dist/armor-mock.html');
