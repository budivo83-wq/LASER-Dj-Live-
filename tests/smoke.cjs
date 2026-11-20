'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.equal(pkg.version, '1.2.1');
assert.match(html, /data-workspace-tab="live"/);
assert.match(html, /data-workspace-tab="design"/);
assert.match(html, /data-workspace-tab="show"/);
assert.match(html, /data-workspace-tab="inputs"/);
assert.match(html, /data-workspace-tab="settings"/);
assert.match(html, /setWorkspaceView\('live'\)/);
assert.match(html, /Video → Vector/);
assert.match(html, /CAPTURE WINDOW/);
assert.match(html, /FIND SPOUT/);
assert.match(html, /DEMO INPUT/);
assert.match(html, /Custom virtual blackout zones/);
assert.match(html, /mask-zones\.js/);
assert.match(html, /vector-edit\.js/);
assert.match(html, /vector-paths\.js/);
assert.match(html, /\+ NEW PATH/);
assert.match(html, /Selected path visible/);
assert.match(html, /SELECT \/ MOVE/);
assert.match(html, /INSERT ON LINE/);
assert.match(html, /REDO EDIT/);
assert.match(html, /LaserDJLiveSceneV12/);
assert.match(html, /Contour stability/);
assert.match(html, /HARDWARE OUTPUT (DISABLED|OFF)/);
assert.match(html, /vector-worker\.js/);
assert.doesNotMatch(html, /<script\s+src=["']https?:/);

const outbound = [];
const ctx = {
  self: { postMessage: (...args) => outbound.push(args[0]) },
  Uint8Array, Uint8ClampedArray, Float32Array, Map, Number, Math, ArrayBuffer,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'app/vector-worker.js'), 'utf8'), ctx);

const w = 24, h = 18, px = new Uint8ClampedArray(w * h * 4);
for (let y = 3; y <= 12; y++) for (let x = 4; x <= 15; x++) {
  const i = (y * w + x) * 4;
  px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 255;
}
ctx.self.onmessage({ data: {
  generation: 17, pixels: px.buffer, w, h,
  blur: 0, threshold: 120, minContour: 10, maxContours: 5, simplify: 1,
} });
assert.equal(outbound.length, 1);
assert.equal(outbound[0].generation, 17);
assert.equal(outbound[0].paths.length, 1);
assert.ok(outbound[0].paths[0].length >= 4);
assert.equal(outbound[0].binary.length, w * h);

const faint = brightness => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 3; y <= 12; y++) for (let x = 4; x <= 15; x++) {
    const i = (y * w + x) * 4;
    data[i] = data[i+1] = data[i+2] = brightness;
    data[i+3] = 255;
  }
  return data.buffer;
};
const send = (generation, brightness) => ctx.self.onmessage({ data: {
  generation, pixels: faint(brightness), w, h, blur: 0,
  threshold: 120, hysteresis: 10, minContour: 10, maxContours: 5, simplify: 1,
} });
const center = 8 * w + 8;
send(17, 115); // Still ON: previous frame was bright, 115 >= 120 - 10.
assert.equal(outbound.at(-1).binary[center], 1);
send(17, 105); // OFF: below the lower hysteresis threshold.
assert.equal(outbound.at(-1).binary[center], 0);
send(18, 115); // A new input session starts with a fresh threshold.
assert.equal(outbound.at(-1).binary[center], 0);

console.log('PASS – desktop package, virtual-only output, worker contour test');
