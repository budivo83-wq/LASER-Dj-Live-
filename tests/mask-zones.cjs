'use strict';

const assert = require('node:assert/strict');
const { normalizedRect, sanitizeZones, contains, crosses } = require('../app/mask-zones.js');

const zone = normalizedRect({ x: .25, y: .3 }, { x: -.25, y: -.3 });
assert.deepEqual(zone, { x1: -.25, y1: -.3, x2: .25, y2: .3 });
assert.equal(contains(zone, 0, 0), true);
assert.equal(contains(zone, .6, 0), false);
assert.equal(crosses(zone, -.9, 0, .9, 0), true);
assert.equal(crosses(zone, -.9, .8, .9, .8), false);
assert.equal(crosses(zone, -.9, -.9, .9, .9), true);
assert.equal(crosses(zone, .5, -.5, .5, .5), false);
assert.equal(normalizedRect({ x: .5, y: 0 }, { x: .51, y: .4 }), null);
assert.equal(sanitizeZones([{ x1: -9, y1: -9, x2: 9, y2: 9 }, {}, null]).length, 1);
assert.deepEqual(sanitizeZones([{ x1: -9, y1: -9, x2: 9, y2: 9 }])[0],
  { x1: -1, y1: -1, x2: 1, y2: 1 });
assert.equal(sanitizeZones(Array(50).fill(zone)).length, 16);
console.log('PASS – normalized zones, crossings, bounded import, invalid data');
