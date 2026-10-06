import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function loadProfiles() {
  const result = await build({ entryPoints: [path.join(root, 'config/clients/index.ts')], bundle: true, write: false, format: 'esm', platform: 'node' });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).CLIENT_PROFILES;
}

export async function selectClient(id = process.env.PHARMAFLOW_CLIENT ?? 'pix-farma') {
  const profiles = await loadProfiles();
  if (!Object.hasOwn(profiles, id)) throw new Error(`Cliente inválido: "${id}". Disponíveis: ${Object.keys(profiles).join(', ')}.`);
  const client = profiles[id];
  if (client.id !== id || !/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Identificador de perfil inconsistente.');
  if (Object.values(client.modules).some(value => value !== true)) throw new Error('Desativar módulos exige implementar a disponibilidade na interface e no IPC.');
  if (!Number.isFinite(client.rules.inactivityTimeoutMs) || client.rules.inactivityTimeoutMs <= 0) throw new Error('Tempo de inatividade inválido.');
  if (id !== 'pix-farma') {
    const pix = profiles['pix-farma'];
    if (client.distribution.owner.toLowerCase() === pix.distribution.owner.toLowerCase() && [client.distribution.repo, client.distribution.releaseRepo].some(repo => [pix.distribution.repo.toLowerCase(), pix.distribution.releaseRepo.toLowerCase()].includes(repo.toLowerCase()))) {
      throw new Error('Outro cliente não pode publicar no destino da PIX Farma.');
    }
  }
  for (const other of Object.values(profiles)) {
    if (other.id === id) continue;
    for (const key of ['appId', 'packageName', 'productName', 'userDataDirectory', 'executableName', 'artifactName', 'updaterCacheDirName']) {
      if (client.desktop[key].toLowerCase() === other.desktop[key].toLowerCase()) throw new Error(`${id} e ${other.id} compartilham ${key}. Use uma identidade própria.`);
    }
    if (client.distribution.owner.toLowerCase() === other.distribution.owner.toLowerCase() && client.distribution.releaseRepo.toLowerCase() === other.distribution.releaseRepo.toLowerCase()) {
      throw new Error('Perfis diferentes precisam de destinos de distribuição separados.');
    }
  }
  return client;
}

export function clientPaths(client, version) {
  const buildRoot = path.join(root, '.client-build', client.id);
  return { buildRoot, publicDir: path.join(buildRoot, 'public'), dist: path.join(buildRoot, 'dist'), electron: path.join(buildRoot, 'dist-electron'),
    output: path.join(root, 'release', client.id, version) };
}

export async function prepareAssets(client) {
  const paths = clientPaths(client, '');
  if (!/^[a-z][a-z0-9-]*$/.test(client.id) || !paths.publicDir.startsWith(path.join(root, '.client-build') + path.sep)) throw new Error('Diretório de assets fora das saídas de clientes.');
  await fs.rm(paths.publicDir, { recursive: true, force: true });
  await fs.mkdir(path.join(paths.publicDir, 'brand'), { recursive: true });
  for (const source of new Set([client.assets.logo, client.assets.logoFallback, client.assets.logoWhite, client.assets.symbol, client.assets.symbolWhite].filter(Boolean))) {
    await fs.copyFile(path.join(root, source), path.join(paths.publicDir, 'brand', path.basename(source)));
  }
  const iconPath = path.join(paths.publicDir, 'icon.ico');
  if (path.extname(client.assets.icon) === '.ico') {
    await fs.copyFile(path.join(root, client.assets.icon), iconPath);
  } else {
    // Converte o mesmo símbolo do site para ICO Windows, incluindo a resolução 256 exigida pelo NSIS.
    const sizes = [256, 128, 64, 48, 32, 16];
    const images = await Promise.all(sizes.map(size => sharp(path.join(root, client.assets.icon), { density: 384 }).resize(size, size).png().toBuffer()));
    const header = Buffer.alloc(6 + sizes.length * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    images.forEach((image, index) => {
      const entry = 6 + index * 16;
      header[entry] = sizes[index] === 256 ? 0 : sizes[index];
      header[entry + 1] = header[entry];
      header.writeUInt16LE(1, entry + 4);
      header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(image.length, entry + 8);
      header.writeUInt32LE(offset, entry + 12);
      offset += image.length;
    });
    await fs.writeFile(iconPath, Buffer.concat([header, ...images]));
  }
  for (const source of client.assets.fonts) {
    await fs.mkdir(path.join(paths.publicDir, 'fonts'), { recursive: true });
    await fs.copyFile(path.join(root, source), path.join(paths.publicDir, 'fonts', path.basename(source)));
  }
  // As fontes pertencem somente ao perfil que as utiliza.
  const fontCss = client.visual.style === 'website' ? `
@font-face { font-family: 'Atkinson Hyperlegible Next'; src: url('./fonts/atkinson-hyperlegible-next.woff') format('woff'); font-weight: 200 800; font-display: swap; }
@font-face { font-family: Vollkorn; src: url('./fonts/vollkorn.woff') format('woff'); font-weight: 400 900; font-display: swap; }
` : "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');\n";
  await fs.writeFile(path.join(paths.publicDir, 'client.css'), fontCss);
  return paths;
}

export function builderConfig(client, version) {
  const paths = clientPaths(client, version);
  return {
    appId: client.desktop.appId, productName: client.desktop.productName,
    electronDist: 'node_modules/electron/dist', forceCodeSigning: false,
    directories: { output: paths.output },
    files: [
      'package.json',
      { from: paths.dist, to: 'dist', filter: ['**/*'] },
      { from: paths.electron, to: 'dist-electron', filter: ['**/*'] },
    ],
    extraMetadata: { name: client.desktop.packageName, productName: client.desktop.productName, main: 'dist-electron/main.js' },
    publish: { provider: 'github', owner: client.distribution.owner, repo: client.distribution.repo, releaseType: 'release' },
    win: { icon: path.join(paths.publicDir, 'icon.ico'), executableName: client.desktop.executableName,
      artifactName: client.desktop.artifactName, target: ['dir', 'nsis'] },
  };
}
