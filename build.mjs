// Builds the website into docs/ (what GitHub Pages serves).
// It only writes app.js, styles.css and index.html; docs/data and docs/images are never touched.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] ?? d;
const out = arg('out', 'docs');
const api = arg('api', 'https://api.github.com');
const watch = process.argv.includes('--watch');

fs.mkdirSync(out, { recursive: true });
fs.copyFileSync('src/index.html', path.join(out, 'index.html'));
fs.copyFileSync('docs/fudy-logo.png', path.join(out, 'fudy-logo.png'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

const opts = {
  entryPoints: { app: 'src/main.tsx', styles: 'src/styles.css' },
  bundle: true, minify: !watch, sourcemap: watch, outdir: out, target: ['es2020'], jsx: 'automatic', logLevel: 'info',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"', __GH_API__: JSON.stringify(api) },
};
if (watch) { const ctx = await esbuild.context(opts); await ctx.watch(); } else await esbuild.build(opts);
