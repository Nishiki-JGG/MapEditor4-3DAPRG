const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),R=require('../ruins.js'),oldHashes=require('./fixtures/ruins-existing-meshes-before-paving.json');
const env={height:()=>0,half:32,agent:{maxStep:.3}},rows=[],probes=[];
for(const kind of ['paving','paving_broken']){
 const p={...R.defaults(kind),id:'ruins_1'},m={version:1,nextId:2,items:[p]},g=R.mesh(p);R.validate(m,env);assert.deepEqual(R.validate(JSON.parse(JSON.stringify(m)),env),m);
 assert.throws(()=>R.validate(m,{...env,agent:{maxStep:.05}}));for(const key of ['length','width','height'])assert.throws(()=>R.transaction(m,{type:'put',item:{...p,[key]:p[key]+.5}},env));
 for(let i=0;i<g.positions.length;i+=9){const a=g.positions.slice(i,i+3),b=g.positions.slice(i+3,i+6),c=g.positions.slice(i+6,i+9),u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(n.reduce((s,v,k)=>s+v*g.normals[i+k],0)>0);}
 for(let x=-1.1;x<=1.11;x+=.07)for(let z=-1.1;z<=1.11;z+=.07){const f=R.floor(m,x,z),y=f?.y||0;assert.equal(R.blocked(m,x,z,.25,y,1.6),false,'Low paving must not become a wall at narrow joints/edges');probes.push({kind,x,z:-z,y,hit:!!f});}
 for(const rot of[0,Math.PI/2,Math.PI,Math.PI*1.5])for(const [x,z]of[[2,0],[-2,0],[0,2],[0,-2]])for(const options of[{grid:true,join:false},{grid:false,join:true},{grid:true,join:true}]){const item={...p,id:undefined,x:x+.1,z:z+.1,rot},q=R.snap(m,item,options);assert.ok(Math.abs(q.item.x-x)<1e-8&&Math.abs(q.item.z-z)<1e-8);R.transaction(m,{type:'put',item:q.item},env);}
 const base={...R.defaults('platform'),height:1,id:'ruins_2'},supported={...p,supportId:base.id};R.validate({version:1,nextId:3,items:[base,supported]},env);assert.equal(R.resolved(supported,{items:[base,supported]}).y,1);
 assert.throws(()=>R.transaction(m,{type:'put',item:{...p,id:undefined}},env));
 const wall={...R.defaults('wall'),id:'ruins_2',x:2,height:.12};assert.equal(R.snap(m,{...wall,x:2.1},{join:true}).snapped,false);
 rows.push({kind,triangles:g.positions.length/9});
}
for(const [kind,h]of Object.entries(oldHashes))assert.equal(crypto.createHash('sha256').update(JSON.stringify(R.mesh(R.defaults(kind)))).digest('hex'),h,'Old mesh changed '+kind);
console.log({pass:true,rows,surfaceProbes:probes.length,snapCases:96,oldGeometryUnchanged:true});
