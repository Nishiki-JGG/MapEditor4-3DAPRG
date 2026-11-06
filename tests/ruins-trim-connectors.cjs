const assert=require('assert/strict'),fs=require('fs'),crypto=require('crypto'),R=require('../ruins.js'),baseline=require('./fixtures/ruins-before-trim-connectors.json');let probes=0;const hashes={},rows=[];
for(const [key,hash] of Object.entries(baseline)){const[kind,finish]=key.split(':');const g=R.mesh({...R.defaults(kind),finish});assert.equal(crypto.createHash('sha256').update(JSON.stringify(g)).digest('hex'),hash,key);hashes[key]=hash;}
for(const kind of R.TRIM_PARTS)for(const height of [.1,.3,1])for(const rot of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const p={...R.defaults(kind),height,rot,id:'ruins_1',finish:'carved'},m={version:1,nextId:2,items:[p]};R.validate(m);const g=R.mesh(p),plain=R.mesh({...p,finish:'stone'});assert.deepEqual(g.positions,plain.positions);assert.deepEqual(g.normals,plain.normals);assert(g.uv.every(Number.isFinite));assert.notDeepEqual(g.uv,plain.uv);assert.deepEqual(R.mesh(JSON.parse(JSON.stringify(p))),g);
 for(const e of R.sockets(p)){const n={...R.defaults('edge',e.x+e.dx*1.08,e.z+e.dz*1.08),height,rot:Math.abs(e.dz)>.5?Math.PI/2:0,finish:'carved'},s=R.snap(m,n,{grid:true,join:true});assert(s.snapped);R.transaction(m,{type:'put',item:s.item});}
 for(let x=-1;x<=1;x+=.1)for(let z=-1;z<=1;z+=.1){assert.equal(R.blocked(m,x,z,.2,.02,1.6),R.blocked({...m,items:[{...p,finish:'stone'}]},x,z,.2,.02,1.6));probes++;}
 for(let i=0;i<g.uv.length;i+=2)if(g.uv[i]<-96){assert([13,15,16].includes(Math.floor(g.uv[i+1]/64)));assert(Math.abs(g.uv[i]+128-plain.uv[i])<1e-10);assert(Math.abs(g.uv[i+1]-Math.floor(g.uv[i+1]/64)*64-16-plain.uv[i+1])<1e-10);}
 if(rot===0)rows.push({kind,height,triangles:g.positions.length/9});
}
// A closed square of four corner modules and four straight edges.
let m=R.empty();for(const[x,z,rot]of[[-2,-2,0],[2,-2,Math.PI*1.5],[2,2,Math.PI],[-2,2,Math.PI/2]])m=R.transaction(m,{type:'put',item:{...R.defaults('edge_corner',x,z),rot,finish:'carved'}});
for(const[x,z,rot]of[[0,-2,0],[0,2,0],[-2,0,Math.PI/2],[2,0,Math.PI/2]])m=R.transaction(m,{type:'put',item:{...R.defaults('edge',x,z),length:3,rot,finish:'carved'}});
const endpoints=m.items.flatMap(R.sockets);for(const e of endpoints)assert.equal(endpoints.filter(f=>f.id!==e.id&&Math.hypot(e.x-f.x,e.z-f.z)<1e-6&&e.dx*f.dx+e.dz*f.dz<-.99).length,1);
assert(!R.blocked(m,0,0,.2,0,1.6));assert(R.blocked(m,2,0,.2,0,1.6));assert(R.blocked(m,2,2,.2,0,1.6));
assert.throws(()=>R.validate({version:1,nextId:2,items:[{...R.defaults('edge_corner'),length:2,id:'ruins_1'}]}));
assert.deepEqual(R.exportData(JSON.parse(JSON.stringify(m)),24,33,()=>0),R.exportData(m,24,33,()=>0));
console.log({pass:true,oldCases:Object.keys(hashes).length,collisionProbes:probes,closedLoopEndpoints:endpoints.length,rows});
