import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { selectClient, builderConfig, clientPaths, root } from './client-profile.mjs';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
await assert.rejects(() => selectClient('nao-existe'), /Cliente inválido/);
await assert.rejects(() => selectClient('../generic'), /Cliente inválido/);
const pix = await selectClient('pix-farma');
const generic = await selectClient('generic');
assert.deepEqual(pix.modules, generic.modules);
assert.deepEqual(pix.rules, generic.rules);
assert.equal((await selectClient()).id, 'pix-farma');
for (const client of [pix, generic]) {
  const paths = clientPaths(client, pkg.version);
  const archive = path.join(paths.output, 'win-unpacked/resources/app.asar');
  const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString());
  assert.equal(metadata.name, client.desktop.packageName);
  assert.equal(metadata.productName, client.desktop.productName);
  assert.equal(metadata.version, pkg.version);
  const html = asar.extractFile(archive, 'dist/index.html').toString();
  assert.ok(html.includes(`<title>${client.brand.windowTitle}</title>`));
  const main = asar.extractFile(archive, 'dist-electron/main.js').toString();
  assert.ok(main.includes(client.desktop.appId));
  assert.ok(main.includes(client.desktop.userDataDirectory));
  const updater = await fs.readFile(path.join(paths.output, 'win-unpacked/resources/app-update.yml'), 'utf8');
  assert.ok(updater.includes(`repo: ${client.distribution.repo}`));
  assert.ok(updater.includes(`updaterCacheDirName: ${client.desktop.updaterCacheDirName}`));
  const manifest = await fs.readFile(path.join(paths.output, 'latest.yml'), 'utf8');
  const installer = client.desktop.artifactName.replace('${version}', pkg.version).replace('${ext}', 'exe');
  assert.ok(manifest.includes(installer));
  const installerBytes = await fs.readFile(path.join(paths.output, installer));
  const checksum = crypto.createHash('sha512').update(installerBytes).digest('base64');
  assert.ok(manifest.includes(checksum), 'latest.yml deve corresponder ao instalador');
  await fs.access(path.join(paths.output, installer + '.blockmap'));
  for (const source of new Set([client.assets.logo, client.assets.logoFallback, client.assets.logoWhite, client.assets.symbol, client.assets.symbolWhite].filter(Boolean))) {
    assert.equal(hash(asar.extractFile(archive, path.join('dist', 'brand', path.basename(source)))), hash(await fs.readFile(path.join(root, source))));
  }
  const icon = asar.extractFile(archive, 'dist/icon.ico');
  assert.equal(icon.readUInt16LE(2), 1);
  assert.ok(Array.from({ length: icon.readUInt16LE(4) }, (_, i) => icon[6 + i * 16] || 256).includes(256));
  const files = asar.listPackage(archive);
  const renderer = files.filter(file => /dist[\\/]assets[\\/].*\.js$/.test(file)).map(file => asar.extractFile(archive, file.replace(/^[\\/]/, '')).toString()).join('\n');
  assert.ok(renderer.includes(client.messages.whatsappReady.split('\n')[1]));
  if (client.id === 'generic') {
    assert.ok(!renderer.includes('Jardim Paulista'));
    assert.ok(!files.some(file => file.includes('logo_nobg')));
    await fs.access(path.join(paths.dist, 'fonts/vollkorn.woff'));
  }
  assert.equal(builderConfig(client, pkg.version).publish.repo, client.distribution.repo);
  console.log(`${client.id}: identidade, assets, ícone 256, mensagem, updater, instalador e checksum OK.`);
}
console.log('Seleção inválida bloqueada; módulos/regras preservados; perfis de atualização separados.');
