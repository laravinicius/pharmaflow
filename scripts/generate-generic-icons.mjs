// Gera logos genéricos (cruz de farmácia) para versões sem marca de cliente.
// Uso: node scripts/generate-generic-icons.mjs
import fs from 'fs';
import sharp from 'sharp';

const SIZE = 512;
const cross = (color) => `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="2" width="4" height="20" rx="2" fill="${color}"/>
  <rect x="2" y="10" width="20" height="4" rx="2" fill="${color}"/>
</svg>`;

const black = Buffer.from(cross('%23000000'));
const white = Buffer.from(cross('%23FFFFFF'));

await sharp(black).png().toFile('public/logo_nobg.png');
await sharp(white).png().toFile('public/logo_white_nobg.png');
console.log('✔ Logos genéricos gerados em public/ (logo_nobg.png e logo_white_nobg.png)');
fs.rmSync('public/logo_nobg.webp', { force: true });
fs.rmSync('public/logo_white_nobg.webp', { force: true });
console.log('✔ WebP antigos removidos');