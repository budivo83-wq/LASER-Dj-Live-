'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { SpoutBridge } = require('../electron/spout-bridge.cjs');

const calls = [];
function spawnMock(_exe, args, options) {
  calls.push({ args, options });
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = () => { child.killed = true; child.emit('close', 0); };
  setImmediate(() => {
    if (args[0] === '--list') {
      child.stdout.write('{"type":"sources","senders":["Resolume Arena - Composition",');
      child.stdout.write('"Other Sender"]}\n');
    } else if (args[0] === '--stream') {
      const rgba = Buffer.alloc(96 * 54 * 4);
      rgba.fill(255, 512, 2048);
      const line = JSON.stringify({ type: 'frame', w: 96, h: 54, rgba: rgba.toString('base64') });
      child.stdout.write(line.slice(0, 103));
      child.stdout.write(line.slice(103) + '\n');
    }
  });
  return child;
}

(async () => {
  const frames = [], statuses = [];
  const bridge = new SpoutBridge('mock.exe', frame => frames.push(frame),
    state => statuses.push(state), { spawn: spawnMock, existsSync: () => true });
  const sources = await bridge.list();
  assert.equal(sources.ok, true);
  assert.deepEqual(sources.senders, ['Resolume Arena - Composition', 'Other Sender']);
  assert.equal(calls[0].options.shell, false);
  assert.equal(bridge.start('Resolume Arena - Composition').ok, true);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].rgba.length, 96 * 54 * 4);
  assert.equal(frames[0].rgba[600], 255);
  bridge.stop();
  assert.equal(bridge.start('bad\nname').ok, false);
  const missing = new SpoutBridge('missing.exe', () => {}, () => {}, { existsSync: () => false });
  assert.equal((await missing.list()).ok, false);
  assert.equal(missing.start('').ok, false);
  console.log('PASS – Spout source list, streaming pixel transport, access guards, missing helper');
})().catch(error => { console.error(error); process.exitCode = 1; });
