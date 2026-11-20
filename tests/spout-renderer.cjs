'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const LaserMaskZones = require('../app/mask-zones.js');
const LaserVectorEdit = require('../app/vector-edit.js');
const LaserVectorPaths = require('../app/vector-paths.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const js = html.split('<script>')[1].split('</script>')[0];
const noop = () => {};
let onFrame;
const spout = {
  listSources: async () => ({ ok: true, senders: ['Resolume Arena'] }),
  start: async () => ({ ok: true }),
  stop: async () => ({ ok: true }),
  onFrame: listener => { onFrame = listener; },
  onStatus: noop,
};
const ctx2d = {
  setTransform: noop, fillRect: noop, beginPath: noop, moveTo: noop,
  lineTo: noop, strokeRect: noop, stroke: noop, arc: noop, fill: noop, closePath: noop,
  drawImage: noop, putImageData: noop,
  createImageData: (w,h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  getImageData: (w,h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
};
const dom = new Map();
function el() {
  return {
    value: '', checked: false, textContent: '', tagName: 'BUTTON',
    style: { setProperty: noop }, classList: { toggle: noop },
    addEventListener: noop, append: noop, replaceChildren: noop, click: noop,
    pause: noop, load: noop, removeAttribute: noop,
    getContext: () => ctx2d,
    getBoundingClientRect: () => ({ width: 600, height: 360, left: 0, top: 0 }),
  };
}
const document = {
  getElementById: id => { if (!dom.has(id)) dom.set(id, el()); return dom.get(id); },
  querySelectorAll: () => [], createElement: el,
};
const localStorage = { getItem: () => null, setItem: noop };
const environment = vm.createContext({
  document, localStorage,
  window: { devicePixelRatio: 1, addEventListener: noop, prompt: () => 'Scene', confirm: () => true,
    LaserMaskZones, LaserVectorEdit, LaserVectorPaths, laserDesktop: { desktop: false, spout } },
  navigator: {}, performance: { now: () => 1000 }, requestAnimationFrame: noop,
});
const run = code => vm.runInContext(code, environment);

(async () => {
  vm.runInContext(js, environment);
  assert.equal(typeof onFrame, 'function');
  await run("$('spoutRefresh').onclick()");
  assert.match(dom.get('spoutStatus').textContent, /Found 1/);
  dom.get('spoutSource').value = 'Resolume Arena';
  await run("$('spoutStart').onclick()");
  assert.equal(run('videoMode'), 'spout');

  const pixels = new Uint8Array(96 * 54 * 4);
  for (let y = 15; y < 35; y++) for (let x = 20; x < 58; x++) {
    const i = (y * 96 + x) * 4;
    pixels[i] = pixels[i+1] = pixels[i+2] = 255;
    pixels[i+3] = 255;
  }
  onFrame({ w: 96, h: 54, rgba: pixels });
  run("$('blur').value='0';$('threshold').value='120';$('minContour').value='16';$('maxContours').value='40';$('simplify').value='1.5';processVideoFrame(1000)");
  assert.equal(run('inputPaths.length'), 1);
  assert.ok(run('inputPaths[0].length') >= 4);
  run("$('stopVideo').onclick()");
  assert.equal(run('videoMode'), 'none');
  console.log('PASS – Spout IPC payload to actual virtual contour renderer');
})().catch(error => { console.error(error); process.exitCode = 1; });
