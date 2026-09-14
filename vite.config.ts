import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'client',
  publicDir: '../public',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // public/bgs/ recebe imagens baixadas direto do Firefly — no Windows o chokidar
    // tenta ler o arquivo antes da escrita/antivírus liberar o lock e derruba o dev
    // server com EBUSY/EPERM. Fundo de tela não precisa de hot-reload, então ignora.
    watch: {
      ignored: ['**/public/bgs/**'],
    },
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/worlds': { target: 'http://localhost:3000', changeOrigin: true },
      '/marketplace': { target: 'http://localhost:3000', changeOrigin: true },
      '/_loom': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    {
      name: 'watch-addons',
      configureServer(server) {
        const appData = process.env.LOCALAPPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
        const dataRoot = path.join(appData, 'LoomVTT-Dev', 'Data', 'marketplace');

        if (fs.existsSync(dataRoot)) {
          server.watcher.add(dataRoot);
          server.watcher.on('change', (file) => {
            if (file.endsWith('.css')) {
              server.ws.send({ type: 'custom', event: 'loom:css-update', data: { file } });
            } else if (file.endsWith('.sqlite') || file.endsWith('.sqlite-journal') || file.endsWith('.sqlite-wal') || file.endsWith('.sqlite-shm')) {
              // Escrita normal de gameplay (editar/travar um pack, criar pasta, mover
              // entry) — o app já propaga isso ao vivo via WebSocket (Signal.broadcast).
              // Recarregar a página inteira aqui derrubava o estado do usuário toda vez
              // que ele mexia no compêndio.
            } else {
              console.log(`[Addon Watcher] Modificado: ${file}`);
              server.ws.send({ type: 'full-reload' });
            }
          });
        }
      }
    }
  ]
});
