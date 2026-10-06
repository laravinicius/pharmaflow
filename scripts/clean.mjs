import fs from 'node:fs';
import path from 'node:path';
import { root } from './client-profile.mjs';

for (const name of ['dist', 'dist-electron', 'release', '.client-build']) {
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep)) throw new Error('Pasta de limpeza fora do projeto.');
  fs.rmSync(target, { recursive: true, force: true });
}
