const assert=require('assert/strict'),b=require('../terrain/saved-boundary.js');
const f={nx:11,nz:11,x0:-.25,z0:-.25},edge=[-.15,-.1,.1,-.1,.1,.15,-.15,.15],dist=Float32Array.from({length:121},(_,k)=>Math.min(...Array.from({length:4},(_,i)=>Math.hypot(edge[2*i]-(f.x0+(k%11)*.05),edge[2*i+1]-(f.z0+Math.floor(k/11)*.05)))));dist[60]=0;
const p=b.pack({dist,edge},f),v=b.open(p,f);for(let i=0;i<dist.length;i++)assert.equal(b.distanceAt(v,f,i),dist[i]);assert(b.valid(v,121));assert(!b.valid({...v},121));
const bad={...p,tree:p.tree.slice()};bad.tree[0]=bad.tree[1];assert.throws(()=>b.open(bad,f));assert.throws(()=>b.open({...p,correctionAt:Uint32Array.of(99),correctionValues:Float64Array.of(1)},f));console.log('saved boundary: exact distances / invalid tree and correction rejected');
