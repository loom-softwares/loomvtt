// CommonJS on purpose (.cjs) so it loads regardless of the project's
// "type": "module" — this is Electron's own main process entrypoint.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// `npm run build`/electron-builder nunca setam NODE_ENV=production no processo
// final — sem isso, LicenseManager.isDevEnvironment() (server/applications/
// licensing/license-manager.ts) cai no fallback `NODE_ENV !== 'production'`
// (undefined !== 'production' = true) e aceita a chave DEV-LOOM-0000 até no
// instalador/AppImage que o usuário final baixa. `app.isPackaged` é a forma
// correta do próprio Electron de distinguir os dois casos.
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';

Menu.setApplicationMenu(null);

let mainWindow = null;

function openWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#0f0d0b',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'dist', 'client', 'images', 'loom-logo.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadURL(`http://localhost:${port}`);
  mainWindow.on('closed', () => { mainWindow = null; });

  // Sem barra de menu (File/Edit/View) = sem atalhos padrão de reload/devtools;
  // repõe só o essencial pra usar como um navegador comum.
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
    else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reload();
    }
  });

  // Checklist de segurança do Electron (electronjs.org/docs/latest/tutorial/security):
  // link http(s) (ex: GitHub de um pacote na loja) abre no navegador padrão do SO,
  // em vez de virar uma BrowserWindow nova sem restrição nenhuma.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // A janela principal nunca deveria sair de localhost — bloqueia qualquer
  // tentativa de navegação pra fora (ex: XSS que injetasse um redirect).
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${port}`)) event.preventDefault();
  });

  // App local não usa câmera/microfone/notificação — nega tudo por padrão.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
}

app.whenReady().then(async () => {
  // The compiled server (client/index.ts → dist/server/index.js) starts
  // listening as a side effect of being imported, then emits 'loom:ready'
  // on `process` once server.listen()'s callback fires.
  process.once('loom:ready', (port) => openWindow(port));

  const serverEntry = path.join(__dirname, '..', 'dist', 'server', 'index.js');
  await import(pathToFileURL(serverEntry).href);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && BrowserWindow.getAllWindows().length === 0) {
    // Server is already running (import is idempotent per-process); just reopen.
    openWindow(process.env.LOOM_PORT || 3000);
  }
});
