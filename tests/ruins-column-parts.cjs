const fs=require('fs'),assert=require('assert/strict'),R=require('../ruins.js'),crypto=require('crypto');
const env={height:()=>0,half:32,agent:{maxStep:.5}},rows=[],hashes=require('./fixtures/ruins-before-column-parts.json');
for(const [key,h] of Object.entries(hashes)){const [kind,finish]=key.split(':');assert.equal(crypto.createHash('sha256').update(JSON.stringify(R.mesh({...R.defaults(kind),finish}))).digest('hex'),h);}
function add(m,kind,extra={}){return R.transaction(m,{type:'put',item:{...R.defaults(kind),finish:'carved',...extra}},env)}
let probes=[];
for(const kind of R.COLUMN_PARTS)for(const rot of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const height of (kind==='column_shaft'?[1.2,2.28,4]:[R.defaults(kind).height])){
 const p={...R.defaults(kind),height,rot,finish:'carved',id:'ruins_1'},m={version:1,nextId:2,items:[p]},g=R.mesh(p);R.validate(m,env);
 assert(g.positions.every(Number.isFinite)&&g.uv.every(Number.isFinite)&&g.normals.every(Number.isFinite));
 assert.equal(Math.min(...g.positions.filter((_,i)=>i%3===1)),0);assert(Math.abs(Math.max(...g.positions.filter((_,i)=>i%3===1))-height)<1e-8);
 for(let i=0;i<g.positions.length;i+=9){const a=g.positions.slice(i,i+3),b=g.positions.slice(i+3,i+6),c=g.positions.slice(i+6,i+9),u=b.map((v,k)=>v-a[k]),v=c.map((w,k)=>w-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert(n.reduce((s,v,k)=>s+v*g.normals[i+k],0)>1e-12);}
 assert.deepEqual(g.positions,R.mesh({...p,finish:'stone'}).positions);assert.equal(R.surfaceVariant(p),R.surfaceVariant({...p,id:'ruins_99'}));
 for(let x=-.48;x<=.48;x+=.08)for(let z=-.48;z<=.48;z+=.08){const f=R.floor(m,x,z);if(f&&rot===0&&height===R.defaults(kind).height)probes.push({kind,x,z:-z,y:f.y});}
 if(rot===0)rows.push({kind,height,triangles:g.positions.length/9});
}
let m=add(R.empty(),'column_base');let s=R.snap(m,{...R.defaults('column_shaft'),x:.12,z:.12,finish:'carved'},{join:true,grid:true});assert(s.snapped);m=R.transaction(m,{type:'put',item:s.item},env);let cap=R.snap(m,{...R.defaults('column_capital'),x:.1,z:0,finish:'carved'},{join:true,grid:true});assert(cap.snapped);m=R.transaction(m,{type:'put',item:cap.item},env);
assert.equal(m.items.length,3);assert(Math.abs(R.resolved(m.items[2],m).y-2.62)<1e-8);assert.equal(R.resolved(m.items[2],m).x,0);
assert.throws(()=>R.transaction(m,{type:'delete',id:'ruins_1'},env));assert.throws(()=>R.transaction(m,{type:'delete',id:'ruins_2'},env));
const noJoin=R.snap(m,{...R.defaults('column_capital'),x:0,z:0},{join:false,grid:true});assert(!noJoin.snapped&&!noJoin.item.mountId);
const occupied=R.snap(m,R.defaults('column_shaft'),{join:true,grid:true});assert(!occupied.snapped&&occupied.reason);
const before=JSON.stringify(m);assert.throws(()=>add(m,'column_capital',{mountId:'ruins_2'}));assert.equal(JSON.stringify(m),before);
assert.throws(()=>R.transaction(m,{type:'put',item:{...m.items[2],mountId:'ruins_1'}},env));assert.throws(()=>R.transaction(m,{type:'put',item:{...m.items[1],mountId:'ruins_3'}},env));assert.throws(()=>R.transaction(m,{type:'put',item:{...m.items[2],mountId:'missing'}},env));
let moved=R.transaction(m,{type:'put',item:{...m.items[0],x:2,z:1}},env);assert.equal(R.resolved(moved.items[2],moved).x,2);assert.equal(R.resolved(moved.items[2],moved).z,1);
let tall=R.transaction(moved,{type:'put',item:{...moved.items[1],height:4}},env);assert(Math.abs(R.resolved(tall.items[2],tall).y-4.34)<1e-8);
let obstacle=add(m,'platform',{x:3,z:0,length:2,width:2,height:2.2,finish:'stone'});assert.throws(()=>R.transaction(obstacle,{type:'put',item:{...obstacle.items[0],x:3}},env));assert.equal(R.resolved(obstacle.items[2],obstacle).x,0);
const saved=JSON.parse(JSON.stringify(tall));assert.deepEqual(R.validate(saved,env),tall);const e=R.exportData(saved,24,65,()=>0);assert(Math.abs(e.items[2].position[1]-4.34)<1e-8);assert.equal(e.authoring.items[2].mountId,'ruins_2');
assert.equal(R.blocked(m,0,0,.25,.5,1.6),true);assert.equal(R.blocked(m,1,0,.25,0,1.6),false);
const off=add(R.empty(),'column_base',{x:.1});assert(!R.snap(off,R.defaults('column_shaft'),{join:true,grid:true}).snapped);assert(R.snap(off,R.defaults('column_shaft'),{join:true,grid:false}).snapped);
for(const k of ['column_base','column_capital'])assert.throws(()=>add(R.empty(),k,{height:.5}));

const result={pass:true,oldCases:Object.keys(hashes).length,rows,raySamples:probes.length,typedStack:true,moveHeightDeleteCollisionAtomic:true,gridJoinPriority:true,saveExport:true,oldSourceRejects:true};console.log(result);
