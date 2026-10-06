import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { selectClient, clientPaths, builderConfig, root } from './client-profile.mjs';

const [command, ...args] = process.argv.slice(2);
const clientArgs = args.filter(arg => arg.startsWith('--client='));
if (clientArgs.length > 1 || args.some(arg => !arg.startsWith('--client='))) throw new Error('Use --client=<identificador>.');
const client = await selectClient(clientArgs[0]?.slice('--client='.length));
if (!['dev', 'build', 'release', 'check', 'info'].includes(command)) throw new Error('Comando inválido. Use dev, build, release, check ou info.');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const paths = clientPaths(client, pkg.version);
const config = builderConfig(client, pkg.version);
if (command === 'info') {
  console.log(JSON.stringify({ client: client.id, version: pkg.version, desktop: client.desktop, distribution: client.distribution, output: paths.output }, null, 2));
} else {
  const { assertUnpublished } = await import('./release-client.mjs');
  if (command === 'check' || command === 'release') await assertUnpublished(client, pkg.version);
  if (command !== 'check') {
    await fs.mkdir(paths.buildRoot, { recursive: true });
    const configFile = path.join(paths.buildRoot, 'electron-builder.json');
    await fs.writeFile(configFile, JSON.stringify(config, null, 2));
    console.log(`Cliente: ${client.id} | Versão: ${pkg.version} | Saída: ${paths.output}`);
    const run = (entry, parameters) => new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, [path.join(root, entry), ...parameters], {
        cwd: root, stdio: 'inherit', env: { ...process.env, PHARMAFLOW_CLIENT: client.id },
      });
      proc.on('error', reject);
      proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`Comando encerrado com código ${code}.`)));
    });
    if (command === 'dev') await run('node_modules/vite/bin/vite.js', ['--configLoader', 'native', '--port=3000', '--host=0.0.0.0']);
    else {
      await run('node_modules/vite/bin/vite.js', ['build', '--configLoader', 'native']);
      await run('node_modules/electron-builder/cli.js', ['--win', '--x64', '--config', configFile, '--publish', 'never']);
      if (command === 'release') {
        const { publishClient } = await import('./release-client.mjs');
        await publishClient(client, pkg.version, paths.output);
      }
    }
  }
}
