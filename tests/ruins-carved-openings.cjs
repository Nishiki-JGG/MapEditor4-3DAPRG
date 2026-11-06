const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),R=require('../ruins.js'),baseline=require('./fixtures/ruins-before-carved-openings.json');
let previous=0,cases=0;const oldHashes={};
for(const [key,expected] of Object.entries(baseline)){const [kind,finish]=key.split(':'),g=R.mesh({...R.defaults(kind),finish});assert.equal(crypto.createHash('sha256').update(JSON.stringify(g)).digest('hex'),expected,key);previous++;}
for(const kind of ['opening','opening_broken'])for(const height of [2.2,3,4])for(const rot of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
 const p={...R.defaults(kind),height,rot,finish:'carved'},g=R.mesh(p),plain=R.mesh({...p,finish:'stone'});assert(g.positions.length>0);assert.deepEqual(g.positions,plain.positions);assert.deepEqual(g.normals,plain.normals);assert.notDeepEqual(g.uv,plain.uv);assert(g.uv.every(Number.isFinite));
 let m=R.transaction(R.empty(),{type:'put',item:p});assert(!R.blocked(m,0,0,.25,0,1.6));const x=Math.cos(rot)*1.5,z=-Math.sin(rot)*1.5;assert(R.blocked(m,x,z,.25,0,1.6));
 const socket=R.sockets(m.items[0])[1],w={...R.defaults('wall',socket.x+Math.cos(rot)*1.02,socket.z-Math.sin(rot)*1.02),height,rot,finish:'carved'};
 for(const settings of [{grid:true,join:true},{grid:false,join:true},{grid:true,join:false}]){const snap=R.snap(m,w,settings),next=R.transaction(m,{type:'put',item:snap.item});assert.equal(next.items.length,2);}
 const saved=JSON.stringify(m);assert.deepEqual(R.exportData(JSON.parse(saved),24,33,()=>0),R.exportData(m,24,33,()=>0));assert.equal(JSON.stringify(m),saved);cases++;
}
const result={pass:true,previousMeshesUnchanged:previous,rotatedHeightCases:cases,shapeNormalsCollidersUnchanged:true,gridAndJoin:true,formalRoundTrip:true,oldReaderRuntimeTest:false,oldUnity:'prior source whitelist rejects new carved opening; old binary not executed',rows:['opening','opening_broken'].map(kind=>({kind,triangles:R.mesh({...R.defaults(kind),finish:'carved'}).positions.length/9}))};
console.log(result);
