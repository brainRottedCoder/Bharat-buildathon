import esbuild from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  absWorkingDir: HERE,
  entryPoints: ['composition/main.jsx'],
  outfile: 'composition/bundle.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  jsxImportSource: 'react',
  conditions: ['production'],
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    '@agniguard/logic': join(HERE, '../logic/src/index.ts'),
  },
  logLevel: 'info',
});
