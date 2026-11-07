// Legacy center-line fixtures intentionally use free placement; cell-aligned grid joins are covered by ruins-cell-grid.cjs.
const fs=require('fs'),assert=require('assert/strict'),R=require('../ruins.js'),crypto=require('crypto'),oldHashes=require('./fixtures/ruins-existing-meshes-before-arch.json');
const env={height:()=>0,half:32,agent:{maxStep:.5}},results=[];
for(const kind of ['arch','arch_broken'])for(const length of[3,4,6,8])for(const height of[3.2,3.5,5]){
 const p={...R.defaults(kind),length,height,id:'ruins_1'},m={version:1,nextId:2,items:[p]};R.validate(m,env);assert.deepEqual(R.validate(JSON.parse(JSON.stringify(m)),env),m);
 const g=R.mesh(p);assert.ok(g.positions.length>0&&g.positions.every(Number.isFinite)&&g.normals.every(Number.isFinite));
 for(let i=0;i<g.positions.length;i+=9){const a=g.positions.slice(i,i+3),b=g.positions.slice(i+3,i+6),c=g.positions.slice(i+6,i+9),u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(n.reduce((s,v,k)=>s+v*g.normals[i+k],0)>0);}
 for(const rot of[0,Math.PI/2,Math.PI,Math.PI*1.5]){const q={...p,rot},model={...m,items:[q]},c=Math.cos(rot),s=Math.sin(rot);for(let z=-1.2;z<=1.21;z+=.1)for(const x of[-.6,0,.6])assert.equal(R.blocked(model,x*c+z*s,-x*s+z*c,.25,0,1.6),false);assert.equal(R.blocked(model,1.2*c,-1.2*s,.2,.01,1.6),true);}
 assert.equal(R.floor(m,0,0),null,'Overhead arch must not become a walking floor');
 assert.equal(R.blocked(m,0,0,.1,0,height),kind==='arch','Intact crown blocks excessive head height; broken crown is absent');
 const wall={...R.defaults('wall'),id:'ruins_2',length:2,height,x:length/2+1},attached={...m,nextId:3,items:[p,wall]};R.validate(attached,env);
 const snapped=R.snap(m,{...wall,id:undefined,x:wall.x+.16},{grid:false,join:true});assert.equal(snapped.snapped,true);assert.ok(Math.abs(snapped.item.x-wall.x)<1e-9);
 const wrong=R.snap(m,{...wall,id:undefined,height:height-.5},{grid:false,join:true});assert.equal(wrong.snapped,false);
 assert.throws(()=>R.transaction(m,{type:'put',item:{...p,width:1}},env));assert.throws(()=>R.transaction(m,{type:'put',item:{...p,height:2.5}},env));
 assert.equal(R.exportData(m,24,65,()=>0).items[0].positions.length,g.positions.length);results.push({kind,length,height,triangles:g.positions.length/9});
}
for(const [kind,hash]of Object.entries(oldHashes))assert.equal(crypto.createHash('sha256').update(JSON.stringify(R.mesh(R.defaults(kind)))).digest('hex'),hash,'Old mesh changed: '+kind);
const probes=[];
for(const kind of ['arch','arch_broken']){const p={...R.defaults(kind),id:'ruins_1'},g=R.exportData({version:1,nextId:2,items:[p]},24,65,()=>0).items[0];for(let x=-1.93;x<=1.94;x+=.11)for(let y=.07;y<3.48;y+=.11){let front=null;for(let i=0;i<g.positions.length;i+=9){const a=g.positions.slice(i,i+3),b=g.positions.slice(i+3,i+6),c=g.positions.slice(i+6,i+9),D=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(D)<1e-10)continue;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/D,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/D,w=1-u-v;if(Math.min(u,v,w)>=-1e-9){const z=u*a[2]+v*b[2]+w*c[2];if(front===null||z<front)front=z;}}probes.push({kind,x,y,hit:front!==null,z:front??0});}}
const ground=[];{const p={...R.defaults('arch_broken'),id:'ruins_1'},m={version:1,nextId:2,items:[p]};for(let x=-1.7;x<=1.71;x+=.06)for(let z=.4;z<=1.05;z+=.06){const f=R.floor(m,x,z);if(f&&f.y>0)ground.push({x,y:f.y,z:-z});}assert.ok(ground.length>25);}
console.log(JSON.stringify({pass:true,results,oldGeometryUnchanged:true,frontProbes:probes.length,fallenFloorProbes:ground.length}));
