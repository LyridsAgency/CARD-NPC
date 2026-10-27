// Empaquette la carte 3D (three.js inclus, sans CDN) dans assets/.
// Usage : cd tools && npm install && node build.mjs
import { build } from 'esbuild';

await build({
  entryPoints: ['src/ecru-carte-3d.js'],
  outfile: '../assets/ecru-carte-3d.js',
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  legalComments: 'eof',
  banner: { js: '/* ECRU — carte 3D. Généré par tools/build.mjs, ne pas modifier à la main. three.js © MIT */' },
});
console.log('assets/ecru-carte-3d.js prêt');
