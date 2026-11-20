'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');

const handlers = {}, events = {};
let currentWindow, dialogResult = 0;
const testCacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'laser-dj-cache-test-'));
const oldStorage = path.join(testCacheRoot, 'old', 'Local Storage');
fs.mkdirSync(oldStorage, { recursive: true });
fs.writeFileSync(path.join(oldStorage, 'bank-test'), 'saved-bank');
let sessionDataPath;

class FakeWindow {
  constructor(options) {
    this.options = options;
    this.webContents = {
      getURL: () => 'laserstudio://app/index.html',
      setWindowOpenHandler: handler => { this.popupHandler = handler; },
      on: (name, handler) => { this['web:' + name] = handler; },
    };
    currentWindow = this;
  }
  isDestroyed() { return false; }
  once(name, handler) { this['once:' + name] = handler; }
  on(name, handler) { this['on:' + name] = handler; }
  show() {}
  loadURL(url) { this.loadedUrl = url; }
}

const fakeElectron = {
  app: {
    whenReady: () => Promise.resolve(),
    on: (name, handler) => { events[name] = handler; },
    quit() {},
    isPackaged: false,
    getPath: name => name === 'sessionData' ? path.join(testCacheRoot, 'old') : testCacheRoot,
    setPath: (name, value) => { if (name === 'sessionData') sessionDataPath = value; },
  },
  BrowserWindow: FakeWindow,
  desktopCapturer: { getSources: async () => [
    { id: 'screen:0', name: 'Screen 1' },
    { id: 'window:1', name: 'Some other window' },
    { id: 'window:2', name: 'Resolume Arena - Output' },
  ] },
  dialog: { showMessageBox: async (_win, opts) => {
    assert.match(opts.message, /Vyber/);
    assert.match(opts.buttons[0], /Resolume/);
    return { response: dialogResult };
  } },
  Menu: { buildFromTemplate: template => template, setApplicationMenu() {} },
  ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
  net: { fetch: async url => ({ resource: url }) },
  protocol: {
    registerSchemesAsPrivileged: schemes => { handlers.schemes = schemes; },
    handle: (_scheme, handler) => { handlers.protocol = handler; },
  },
  session: { defaultSession: {
    setPermissionCheckHandler: handler => { handlers.check = handler; },
    setPermissionRequestHandler: handler => { handlers.request = handler; },
    setDisplayMediaRequestHandler: handler => { handlers.capture = handler; },
  } },
};

const context = vm.createContext({
  require: name => name === 'electron' ? fakeElectron : name === './spout-bridge.cjs' ?
    require('../electron/spout-bridge.cjs') : require(name),
  __dirname: path.join(__dirname, '..', 'electron'),
  console,
  URL,
  Response,
  process: { platform: 'win32', env: { LOCALAPPDATA: testCacheRoot }, pid: 3201 },
});

(async () => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8'), context);
  assert.equal(sessionDataPath, path.join(testCacheRoot, 'LaserDJLive', 'Chromium'));
  assert.equal(fs.readFileSync(path.join(sessionDataPath, 'Local Storage', 'bank-test'), 'utf8'), 'saved-bank');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(currentWindow);
  assert.equal(currentWindow.options.webPreferences.sandbox, true);
  assert.equal(currentWindow.options.webPreferences.contextIsolation, true);
  assert.equal(currentWindow.options.webPreferences.nodeIntegration, false);
  assert.equal(currentWindow.loadedUrl, 'laserstudio://app/index.html');
  assert.equal(handlers.schemes[0].privileges.secure, true);
  assert.match((await handlers.protocol({ url: 'laserstudio://app/vector-worker.js' })).resource, /vector-worker\.js$/);
  assert.match((await handlers.protocol({ url: 'laserstudio://app/mask-zones.js' })).resource, /mask-zones\.js$/);
  assert.match((await handlers.protocol({ url: 'laserstudio://app/vector-edit.js' })).resource, /vector-edit\.js$/);
  assert.match((await handlers.protocol({ url: 'laserstudio://app/vector-paths.js' })).resource, /vector-paths\.js$/);
  assert.equal((await handlers.protocol({ url: 'laserstudio://app/secret.txt' })).status, 404);
  assert.equal(handlers.check(currentWindow.webContents, 'midi'), true);
  assert.equal(handlers.check(currentWindow.webContents, 'midiSysex'), false);
  assert.equal(handlers.check(currentWindow.webContents, 'serial'), false);
  assert.equal(handlers.check(currentWindow.webContents, 'usb'), false);
  assert.equal((await handlers['spout:list']({ sender: {} })).ok, false);
  assert.equal(handlers['spout:start']({ sender: {} }, '').ok, false);
  assert.equal(handlers['spout:stop']({ sender: {} }).ok, false);
  let permission;
  handlers.request(currentWindow.webContents, 'usb', granted => { permission = granted; });
  assert.equal(permission, false);

  const frame = { url: currentWindow.webContents.getURL() };
  frame.top = frame;
  const request = { userGesture: true, frame };
  let captured;
  await handlers.capture(request, stream => { captured = stream; });
  assert.equal(captured.video.id, 'window:2');
  assert.equal(captured.audio, undefined);

  dialogResult = 3; // Three sources + Cancel.
  await handlers.capture(request, stream => { captured = stream; });
  assert.equal(captured, null);

  await handlers.capture({ userGesture: false, frame }, stream => { captured = stream; });
  assert.equal(captured, null);
  assert.equal(currentWindow.popupHandler().action, 'deny');
  console.log('PASS – Electron permissions, window capture picker, cancellation, secure renderer');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  fs.rmSync(testCacheRoot, { recursive: true, force: true });
});
