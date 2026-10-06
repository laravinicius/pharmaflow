import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export async function assertUnpublished(client, version) {
  if (!client.distribution.configured) throw new Error(`Distribuição de ${client.id} ainda não habilitada. Configure o repositório e a credencial do CI antes de publicar.`);
  const repo = `${client.distribution.owner}/${client.distribution.releaseRepo}`;
  const tag = `v${version}`;
  const destination = JSON.parse(gh(['api', `repos/${repo}`]));
  const updater = JSON.parse(gh(['api', `repos/${client.distribution.owner}/${client.distribution.repo}`]));
  if (destination.full_name.toLowerCase() !== updater.full_name.toLowerCase()) throw new Error('Publicação e atualização apontam para repositórios diferentes.');
  if (client.id !== 'pix-farma' && destination.full_name.toLowerCase() === 'laravinicius/magisform') throw new Error('O destino da PIX Farma é exclusivo desse perfil.');
  const releases = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`])).flat();
  const tags = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/tags?per_page=100`])).flat();
  if (releases.some(release => release.tag_name === tag) || (client.id !== 'pix-farma' && tags.some(entry => entry.name === tag))) {
    throw new Error(`${repo}: ${tag} já existe. Versões publicadas não podem ser sobrescritas.`);
  }
  if (client.id === 'pix-farma') {
    const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const tagCommit = execFileSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8' }).trim();
    if (currentCommit !== tagCommit) throw new Error('A publicação PIX Farma deve compilar exatamente o commit da tag de versão.');
  }
}

export async function publishClient(client, version, output) {
  // Repete a consulta após o build e cria a release com os arquivos em uma única chamada.
  await assertUnpublished(client, version);
  const files = (await fs.readdir(output)).filter(name => name === 'latest.yml' || name.endsWith('.exe') || name.endsWith('.exe.blockmap'));
  if (files.filter(name => name.endsWith('.exe')).length !== 1 || !files.includes('latest.yml') || files.filter(name => name.endsWith('.blockmap')).length !== 1) {
    throw new Error('A publicação exige um único instalador, latest.yml e blockmap do perfil selecionado.');
  }
  const repo = `${client.distribution.owner}/${client.distribution.releaseRepo}`;
  // O CLI cria inicialmente um rascunho e só o publica após enviar todos os artefatos.
  const args = ['release', 'create', `v${version}`, '--repo', repo, '--title', `${client.brand.name} ${version}`, '--notes', `Atualização ${version} de ${client.brand.name}.`,
    ...files.map(name => path.join(output, name))];
  // No repositório comum a tag já foi validada pelo workflow; não é criada em main por acidente.
  if (client.id === 'pix-farma') args.push('--verify-tag');
  execFileSync('gh', args, { stdio: 'inherit' });
}
