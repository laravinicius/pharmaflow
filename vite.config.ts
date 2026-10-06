import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import { selectClient, prepareAssets } from './scripts/client-profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const client = await selectClient();
  const paths = await prepareAssets(client);
  const define = { __CLIENT_PROFILE__: JSON.stringify(client) };
  return {
    base: './',
    publicDir: paths.publicDir,
    define,
    build: { outDir: paths.dist },
    plugins: [
      {
        name: 'perfil-do-cliente',
        transformIndexHtml: (html) => html.replace('<title>PIX Farma - Manipulação</title>', `<title>${client.brand.windowTitle}</title>`),
      },
      react(),
      tailwindcss(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: { define, build: { outDir: paths.electron } },
          onstart({ startup }) { startup([path.join(paths.electron, 'main.js'), '--no-sandbox']); },
        },
        preload: {
          input: 'electron/preload.ts',
          vite: { build: { outDir: paths.electron } },
        },
        renderer: {},
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
    },
  };
});
