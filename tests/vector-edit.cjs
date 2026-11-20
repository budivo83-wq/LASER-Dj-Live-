'use strict';
const assert = require('node:assert/strict');
const Vector = require('../app/vector-edit.js');

assert.deepEqual(Vector.point(1.8,-2),[1,-1]);
assert.deepEqual(Vector.point(.19,-.19,true),[.25,-.25]);
assert.deepEqual(Vector.point(.06,.07,true),[0,.125]);
assert.equal(Vector.point(NaN,0),null);
assert.equal(Vector.point(Infinity,0),null);

const line=[[-.7,0],[.7,0]];
assert.equal(Vector.vertexHit(line,[-.69,.01],600,360),0);
assert.equal(Vector.vertexHit(line,[0,0],600,360),-1);
let hit=Vector.segmentHit(line,[0,.025],600,360,false);
assert.ok(hit);
assert.equal(hit.after,1);
assert.ok(Math.abs(hit.point[0])<.00001&&Math.abs(hit.point[1])<.00001);
assert.equal(Vector.segmentHit(line,[0,.5],600,360,false),null);
assert.equal(Vector.segmentHit([[0,0],[0,0]],[0,0],600,360,false),null);

// Closing edge is a genuine insertion target, after the final existing vertex.
const triangle=[[-.6,-.6],[.6,-.6],[0,.6]];
hit=Vector.segmentHit(triangle,[-.3,0],600,360,true);
assert.ok(hit);
assert.equal(hit.after,3);
assert.equal(Vector.segmentHit(triangle,[-.3,0],600,360,false),null);

for(const [name,count,closed] of [['star',10,true],['hexagon',6,true],['wave',29,false]]){
  const shape=Vector.preset(name);
  assert.equal(shape.points.length,count);
  assert.equal(shape.closed,closed);
  assert.ok(shape.points.every(p=>p.length===2&&p.every(v=>Number.isFinite(v)&&v>=-1&&v<=1)));
}
assert.equal(Vector.preset('not-a-preset'),null);
const first=Vector.preset('star');first.points[0][0]=.123;
assert.notEqual(Vector.preset('star').points[0][0],.123);
console.log('PASS – vector editor geometry, snapping, hit-tests and templates');
