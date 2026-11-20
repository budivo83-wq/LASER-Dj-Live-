'use strict';

const fs = require('node:fs');
const { spawn } = require('node:child_process');

const W = 96, H = 54, PIXELS = W * H * 4, MAX_LINE = 100_000;

class SpoutBridge {
  constructor(executable, onFrame = () => {}, onStatus = () => {}, dependencies = {}) {
    this.executable = executable;
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.spawn = dependencies.spawn || spawn;
    this.existsSync = dependencies.existsSync || fs.existsSync;
    this.child = null;
    this.generation = 0;
  }

  available() { return this.existsSync(this.executable); }

  async list() {
    if (!this.available()) return { ok: false, senders: [], error: 'Spout receiver EXE není sestavený. Použij DEMO nebo CAPTURE WINDOW.' };
    return new Promise(resolve => {
      let ended = false, buffer = '', sources = null;
      let child;
      const finish = result => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        if (child && !child.killed) child.kill();
        resolve(result);
      };
      const timer = setTimeout(() => finish({ ok: false, senders: [], error: 'Vypršel čas pro načtení Spout zdrojů.' }), 4000);
      try {
        child = this.spawn(this.executable, ['--list'], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        child.on('error', error => finish({ ok: false, senders: [], error: error.message }));
        child.stdout.on('data', chunk => {
          buffer += chunk.toString('utf8');
          if (buffer.length > MAX_LINE) return finish({ ok: false, senders: [], error: 'Neplatná odpověď přijímače.' });
          for (const line of buffer.split('\n')) {
            try {
              const msg = JSON.parse(line);
              if (msg.type === 'sources' && Array.isArray(msg.senders)) {
                sources = msg.senders.filter(s => typeof s === 'string' && s.length > 0 && s.length <= 256).slice(0, 64);
              }
              if (msg.type === 'error') return finish({ ok: false, senders: [], error: String(msg.message).slice(0, 250) });
            } catch { /* May be incomplete JSONL line. */ }
          }
          if (sources) finish({ ok: true, senders: sources });
        });
        child.on('close', code => finish(sources ? { ok: true, senders: sources } :
          { ok: false, senders: [], error: `Spout receiver skončil (kód ${code}).` }));
      } catch (error) {
        finish({ ok: false, senders: [], error: error.message });
      }
    });
  }

  start(sender) {
    if (typeof sender !== 'string' || sender.length > 256 || /[\r\n\0]/.test(sender)) {
      return { ok: false, error: 'Neplatný název Spout zdroje.' };
    }
    if (!this.available()) return { ok: false, error: 'Chybí nativní Spout receiver EXE.' };
    this.stop();
    const generation = ++this.generation;
    const args = ['--stream', '--fps', '20'];
    if (sender) args.push('--sender', sender);
    let child;
    try {
      child = this.spawn(this.executable, args, { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      return { ok: false, error: error.message };
    }
    this.child = child;
    let tail = '';
    let failures = 0;
    child.stdout.on('data', chunk => {
      if (generation !== this.generation) return;
      tail += chunk.toString('utf8');
      let separator;
      while ((separator = tail.indexOf('\n')) !== -1) {
        const line = tail.slice(0, separator); tail = tail.slice(separator + 1);
        if (line.length > MAX_LINE) { this.stop(); return; }
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'frame' && msg.w === W && msg.h === H && typeof msg.rgba === 'string' &&
              msg.rgba.length <= Math.ceil(PIXELS / 3) * 4 + 4) {
            const rgba = Buffer.from(msg.rgba, 'base64');
            if (rgba.length === PIXELS) this.onFrame({ w: W, h: H, rgba: new Uint8Array(rgba) });
          } else if (['status', 'error'].includes(msg.type)) {
            this.onStatus({ type: msg.type, message: String(msg.message || '').slice(0, 250),
              sender: String(msg.sender || '').slice(0, 256) });
          }
          failures = 0;
        } catch {
          if (++failures > 10) { this.onStatus({ type: 'error', message: 'Chybná data Spout přijímače.' }); this.stop(); return; }
        }
      }
      if (tail.length > MAX_LINE) { this.onStatus({ type: 'error', message: 'Přijímač překročil limit dat.' }); this.stop(); }
    });
    child.on('error', error => {
      if (generation === this.generation) this.onStatus({ type: 'error', message: error.message });
    });
    child.on('close', code => {
      if (generation !== this.generation) return;
      this.child = null;
      this.onStatus({ type: 'status', message: `Spout přijímač skončil (${code}).` });
    });
    return { ok: true };
  }

  stop() {
    ++this.generation;
    const child = this.child;
    this.child = null;
    if (child && !child.killed) child.kill();
    return { ok: true };
  }
}

module.exports = { SpoutBridge, FRAME_WIDTH: W, FRAME_HEIGHT: H };
