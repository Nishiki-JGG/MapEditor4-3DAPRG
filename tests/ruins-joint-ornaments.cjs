const assert=require('assert/strict'),fs=require('fs'),R=require('../ruins.js'),hashes=require('./fixtures/ruins-before-joint-ornaments.json'),hash=v=>require('crypto').createHash('sha256').update(JSON.stringify(v)).digest('hex');
const kinds=['corner_in','corner_out','tee','end','stairs'],rows=[];
for(const k of [...new Set(Object.keys(hashes).map(k=>k.split(':')[0]))])for(const finish of ['stone','worn'])assert.equal(hash(R.mesh({...R.defaults(k),finish})),hashes[k+':'+finish]);
for(const k of ['wall','wall_broken','wall_ruined','pier','pier_broken','arch','arch_broken','paving','paving_broken'])assert.equal(hash(R.mesh({...R.defaults(k),finish:'carved'})),hashes[k+':carved']);
let probes=0;
for(const kind of kinds)for(let rotation=0;rotation<4;rotation++){
 let p={...R.defaults(kind),rot:rotation*Math.PI/2,id:'ruins_1',finish:'carved'},items=[p];
 if(kind==='stairs'){p.upperId='ruins_2';items.push({...R.defaults('platform'),id:'ruins_2',x:3.5*Math.sin(p.rot),z:3.5*Math.cos(p.rot)});}
 const model={version:1,nextId:3,items};R.validate(model);
 const a=R.mesh(p),b=R.mesh({...p,finish:'stone'});assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.normals,b.normals);assert.notDeepEqual(a.uv,b.uv);assert(a.uv.every(Number.isFinite));
 assert.deepEqual(R.sockets(p),R.sockets({...p,finish:'stone'}));assert.deepEqual(R.mesh(JSON.parse(JSON.stringify(p))),a);
 const plain={...model,items:items.map(q=>({...q,finish:'stone'}))};
 for(let x=-2;x<=2;x+=.2)for(let z=-2;z<=2;z+=.2){assert.deepEqual(R.floor(model,x,z),R.floor(plain,x,z));assert.equal(R.blocked(model,x,z,.25,0,1.6),R.blocked(plain,x,z,.25,0,1.6));probes++;}
 if(!rotation)rows.push({kind,triangles:a.positions.length/9,taggedVertices:a.uv.filter((v,i)=>!(i%2)&&v< -96).length});
}
for(const height of [2.2,8]){const g=R.mesh({...R.defaults('stairs'),height,length:height===8?12:3,finish:'carved'});for(let i=0;i<g.uv.length;i+=2)if(g.uv[i]<-96)assert([5,6,7].includes(Math.floor(g.uv[i+1]/64)),'Stair UV escaped its material region');}
let loop=R.empty();for(const [x,z,rot]of[[-4,-4,0],[4,-4,Math.PI*1.5],[4,4,Math.PI],[-4,4,Math.PI/2]])loop=R.transaction(loop,{type:'put',item:{...R.defaults('corner_in',x,z),rot,finish:'carved'}});
for(const[x,z,rot]of[[0,-4,0],[0,4,0],[-4,0,Math.PI/2],[4,0,Math.PI/2]])loop=R.transaction(loop,{type:'put',item:{...R.defaults('wall',x,z),length:7,rot,finish:'carved'}});
const ends=loop.items.flatMap(R.sockets);for(const e of ends)assert.equal(ends.filter(f=>f.id!==e.id&&Math.hypot(e.x-f.x,e.z-f.z)<1e-6&&e.dx*f.dx+e.dz*f.dz<-.99).length,1);
for(let rot=0;rot<4;rot++){const a={...R.defaults('tee'),finish:'carved',rot:rot*Math.PI/2,id:'ruins_1'},m={version:1,nextId:2,items:[a]};for(const e of R.sockets(a)){const p={...R.defaults('wall',e.x+e.dx*1.08,e.z+e.dz*1.08),finish:'carved',rot:Math.abs(e.dz)>.5?Math.PI/2:0};const q=R.snap(m,p,{grid:true,join:true});assert(q.snapped);assert(R.sockets(q.item).some(f=>Math.hypot(f.x-e.x,f.z-e.z)<1e-6));}}
const result={pass:true,oldMeshesPreserved:true,previousOrnamentsPreserved:true,rotationCases:20,probeCount:probes,closedLoop:true,teeSnaps:12,rows};console.log(result);
