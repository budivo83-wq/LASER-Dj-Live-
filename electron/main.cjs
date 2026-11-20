'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, net, protocol, session } = require('electron');
const { SpoutBridge } = require('./spout-bridge.cjs');

// An application-specific secure origin supports Web Workers and localStorage,
// while avoiding the overly privileged file:// origin.
protocol.registerSchemesAsPrivileged([{
  scheme: 'laserstudio',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);
const APP_ORIGIN = 'laserstudio://app';
const APP_ROOT = path.join(__dirname, '..', 'app');

// Chromium's default disk/GPU cache can be unwritable in managed Windows
// profiles. Keep it in LOCALAPPDATA, away from the portable program folder.
// Preserve localStorage (scene bank and MIDI mappings) on first relocation.
function configureSessionStorage() {
  if (process.platform !== 'win32') return;
  try {
    const previous = app.getPath('sessionData');
    const local = process.env.LOCALAPPDATA;
    if (!local || !path.isAbsolute(local)) return;
    const target = path.join(local, 'LaserDJLive', 'Chromium');
    fs.mkdirSync(target, { recursive: true });
    fs.accessSync(target, fs.constants.W_OK);
    if (path.resolve(previous).toLowerCase() !== path.resolve(target).toLowerCase()) {
      const oldStorage = path.join(previous, 'Local Storage');
      const newStorage = path.join(target, 'Local Storage');
      if (fs.existsSync(oldStorage) && !fs.existsSync(newStorage)) {
        // Do not switch directories if an existing bank cannot be migrated.
        const staging = path.join(target, `.localstorage-import-${process.pid}`);
        fs.cpSync(oldStorage, staging, { recursive: true, force: false, errorOnExist: true });
        fs.renameSync(staging, newStorage);
      }
    }
    app.setPath('sessionData', target);
  } catch (error) {
    console.warn('Could not relocate Chromium cache; keeping original session:', error.message);
  }
}

configureSessionStorage(); // Must run before app.whenReady() / session initialization.

let mainWindow;
let spoutBridge;

function isOurWindow(contents) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && contents === mainWindow.webContents);
}

function installPermissions() {
  const ses = session.defaultSession;

  // The app is offline. Only non-SysEx MIDI and an explicitly selected
  // capture source are available. Nothing can ask for camera/mic/USB/serial.
  ses.setPermissionCheckHandler((contents, permission) => {
    return isOurWindow(contents) && (permission === 'midi' || permission === 'display-capture');
  });
  ses.setPermissionRequestHandler((contents, permission, callback) => {
    callback(isOurWindow(contents) && (permission === 'midi' || permission === 'display-capture'));
  });

  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!mainWindow || mainWindow.isDestroyed() || !request.userGesture ||
        !request.frame || request.frame !== request.frame.top ||
        request.frame?.top?.url !== mainWindow.webContents.getURL()) {
      callback(null);
      return;
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 0, height: 0 },
      });
      const visible = sources.filter(source => source.name.trim().length > 0);
      // Keep Windows' native dialog readable. Prefer Resolume sources.
      visible.sort((a, b) => {
        const rank = source => /resolume|arena|avenue/i.test(source.name) ? 0 :
          source.id.startsWith('window:') ? 1 : 2;
        return rank(a) - rank(b);
      });
      const choices = visible.slice(0, 12);
      if (!choices.length) {
        callback(null);
        return;
      }
      const labels = choices.map(source => source.name.slice(0, 56));
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Laser DJ Live – výběr videovstupu',
        message: 'Vyber okno nebo obrazovku pro Video → Vector',
        detail: 'Vybraný zdroj se použije pouze pro virtuální náhled. Spout ani ILDA výstup nejsou aktivní. Zobrazeno maximálně 12 zdrojů.',
        buttons: [...labels, 'ZRUŠIT'],
        cancelId: labels.length,
        noLink: true,
      });
      callback(response >= 0 && response < choices.length ? { video: choices[response] } : null);
    } catch (error) {
      console.error('Desktop capture failed:', error);
      callback(null);
    }
  });
}

function installSpoutBridge() {
  const receiver = app.isPackaged ?
    path.join(process.resourcesPath, 'spout', 'LaserSpoutReceiver.exe') :
    path.join(__dirname, '..', 'native', 'bin', 'LaserSpoutReceiver.exe');
  spoutBridge = new SpoutBridge(receiver,
    frame => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('spout:frame', frame); },
    status => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('spout:status', status); });

  ipcMain.handle('spout:list', event => isOurWindow(event.sender) ?
    spoutBridge.list() : { ok: false, error: 'Access denied', senders: [] });
  ipcMain.handle('spout:start', (event, sender) => isOurWindow(event.sender) ?
    spoutBridge.start(sender) : { ok: false, error: 'Access denied' });
  ipcMain.handle('spout:stop', event => isOurWindow(event.sender) ?
    spoutBridge.stop() : { ok: false, error: 'Access denied' });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Laser DJ Live 1.2.5 – Virtual Studio',
    width: 1560,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#081018',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  // Never navigate to remote content, open arbitrary popups, or load
  // remote URLs inside the privileged application window.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(APP_ORIGIN + '/index.html');

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Zobrazení', submenu: [
      { role: 'reload', label: 'Obnovit editor' },
      { role: 'togglefullscreen', label: 'Celá obrazovka (F11)' },
      { role: 'resetZoom', label: 'Výchozí přiblížení' },
      { role: 'zoomIn', label: 'Přiblížit' },
      { role: 'zoomOut', label: 'Oddálit' },
    ] },
    { label: 'Soubor', submenu: [{ role: 'quit', label: 'Ukončit' }] },
  ]));
}

app.whenReady().then(() => {
  protocol.handle('laserstudio', request => {
    const uri = new URL(request.url);
    if (uri.host !== 'app' || !['/index.html', '/vector-worker.js', '/mask-zones.js', '/vector-edit.js', '/vector-paths.js'].includes(uri.pathname)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(path.join(APP_ROOT, uri.pathname.slice(1))).href);
  });
  installPermissions();
  installSpoutBridge();
  createWindow();
});

app.on('before-quit', () => spoutBridge?.stop());

app.on('window-all-closed', () => app.quit());

// No access to external network hosts; frontend resources are local only.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
