const fs=require('fs'),assert=require('assert/strict'),R=require('../ruins.js');
const env={height:()=>0,half:32,agent:{maxStep:.5}},results=[];
for(const kind of ['pier','pier_broken'])for(const H of[1.2,1.8,3,4]){
 const p={...R.defaults(kind),height:H,id:'ruins_1'},m={version:1,nextId:2,items:[p]};R.validate(m,env);assert.deepEqual(R.validate(JSON.parse(JSON.stringify(m)),env),m);
 const g=R.mesh(p);assert.ok(g.positions.every(Number.isFinite)&&g.normals.every(Number.isFinite));assert.ok(g.positions.length>0);
 for(let i=0;i<g.positions.length;i+=9){const a=g.positions.slice(i,i+3),b=g.positions.slice(i+3,i+6),c=g.positions.slice(i+6,i+9),u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(n.reduce((s,v,k)=>s+v*g.normals[i+k],0)>0);}
 assert.equal(R.blocked(m,0,0,.25,0,1.6),true);assert.equal(R.blocked(m,1,0,.25,0,1.6),false);assert.ok(Math.abs(Math.min(...g.positions.filter((_,i)=>i%3===1)))<1e-10);
 assert.throws(()=>R.transaction(m,{type:'put',item:{...p,length:2}},env));assert.throws(()=>R.transaction(m,{type:'put',item:{...p,height:5}},env));
 const snapped=R.snap(R.empty(),{...p,x:.17,z:.12},{grid:true,join:true});assert.ok(Math.abs(snapped.item.x)<1e-10);assert.ok(Math.abs(snapped.item.z)<1e-10);
 const exp=R.exportData(m,24,65,()=>0);assert.equal(exp.items[0].kind,kind);assert.equal(exp.items[0].positions.length,g.positions.length);
 results.push({kind,height:H,triangles:g.positions.length/9});
}
// Equal type/dimensions use one geometry cache variant regardless of saved ID.
for(const kind of ['pier','pier_broken']){assert.equal(R.surfaceVariant({...R.defaults(kind),id:'ruins_1'}),0);assert.equal(R.surfaceVariant({...R.defaults(kind),id:'ruins_99'}),0);}
const probes=[];for(const kind of ['pier','pier_broken']){const p={...R.defaults(kind),id:'ruins_1'},m={version:1,nextId:2,items:[p]};for(let x=-.48;x<=.481;x+=.08)for(let z=-.48;z<=.481;z+=.08){const f=R.floor(m,x,z);if(f)probes.push({kind,x,z:-z,y:f.y});}}
assert.ok(probes.length>300);console.log(JSON.stringify({pass:true,results,raySamples:probes.length,sharedVariant:true}));

// Regression: intersecting bevel planes must close the plinth, not expose its underside.
{const p={...R.defaults('pier_broken'),id:'ruins_1'};assert.ok(R.floor({version:1,nextId:2,items:[p]},.4,-.32).y>.32);}
