'use strict';
const assert = require('node:assert/strict');
const Paths = require('../app/vector-paths.js');

const red=Paths.makePath('Red','#ff0000');
assert.deepEqual(red,{name:'Red',color:'#ff0000',enabled:true,closed:false,points:[]});
const original=[{...red,points:[[0,0],[1,1]]}];
const copy=Paths.validate(original);
copy[0].points[0][0]=.5;
assert.equal(original[0].points[0][0],0,'validation clones user geometry');

const old={color:'#12AB34',custom:[[-.4,.2],[.4,.2]],closed:false};
const upgraded=Paths.upgradeLayer(old);
assert.equal(upgraded.length,1);
assert.equal(upgraded[0].color,'#12AB34');
assert.deepEqual(upgraded[0].points,[[-.4,.2],[.4,.2]]);
assert.deepEqual(old.custom,[],'old coordinates must not reappear after deleting the new path');
assert.equal(Paths.countPoints(upgraded),2);

const expectInvalid=p=>assert.throws(()=>Paths.validate(p));
expectInvalid([]);
expectInvalid(Array.from({length:17},()=>Paths.makePath()));
expectInvalid([{...red,color:'blue'}]);
expectInvalid([{...red,enabled:1}]);
expectInvalid([{...red,name:'a'.repeat(41)}]);
expectInvalid([{...red,points:[[Infinity,0]]}]);
expectInvalid([{...red,points:[[1.01,0]]}]);
expectInvalid([{...red,points:[[0]]}]);
expectInvalid([{...red,points:[]},null]);
expectInvalid([{...red,points:Array.from({length:800},()=>[0,0])},{...red,points:Array.from({length:201},()=>[0,0])}]);
assert.throws(()=>Paths.upgradeLayer({vectorPaths:[{...red,points:[[NaN,0]]}]}));

console.log('PASS – multiple vector paths, V11 migration, geometry validation and point budget');
