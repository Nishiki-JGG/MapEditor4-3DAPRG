const assert=require('assert/strict'),fs=require('fs'),crypto=require('crypto'),R=require('../ruins.js'),baseline=require('./fixtures/ruins-before-niche.json');
let previous=0,cases=0;const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const [key,b] of Object.entries(baseline)){const [kind,finish]=key.split(':'),p={...R.defaults(kind),finish};assert.equal(digest(R.mesh(p)),b.mesh,key);assert.deepEqual(R.boxes(p),b.boxes);assert.deepEqual(JSON.parse(JSON.stringify(R.sockets(p))),b.sockets);previous++;}
const rows=[];for(const height of [2.2,3,4])for(const rot of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const finish of ['stone','carved']){
 const p={...R.defaults('wall_niche'),height,rot,finish},g=R.mesh(p);assert(g.positions.length>0&&g.positions.every(Number.isFinite)&&g.uv.every(Number.isFinite));
 const m=R.transaction(R.empty(),{type:'put',item:p});assert(R.blocked(m,0,0,.25,0,1.6),'通行不可');
 const pt=(x,z)=>[x*Math.cos(rot)+z*Math.sin(rot),-x*Math.sin(rot)+z*Math.cos(rot)];
 assert(!R.blocked(m,...pt(0,-.65),.25,0,1.6));assert(R.blocked(m,...pt(0,.15),.05,.8,.1),'背板');assert(!R.blocked(m,...pt(0,-.12),.03,.8,.1),'窪み内部');
 for(const side of [-1,1])for(const settings of [{grid:true,join:true},{grid:false,join:true},{grid:true,join:false}]){const [x,z]=pt(side*2.03,0),w={...R.defaults('wall',x,z),height,rot},snap=R.snap(m,w,settings);assert.equal(R.transaction(m,{type:'put',item:snap.item}).items.length,2);}
 const plain=R.mesh({...p,finish:'stone'});assert.deepEqual(g.positions,plain.positions);assert.deepEqual(g.normals,plain.normals);
 const before=JSON.stringify(m);assert.throws(()=>R.transaction(m,{type:'put',item:{...m.items[0],length:3}}));assert.equal(JSON.stringify(m),before);assert.equal(R.transaction(m,{type:'delete',id:m.items[0].id}).items.length,0);
 const e=R.exportData(m,24,33,()=>0);assert.deepEqual(e,R.exportData(JSON.parse(before),24,33,()=>0));cases++;if(rot===0)rows.push({height,finish,triangles:g.positions.length/9});
}
const result={pass:true,existingMeshColliderSocketsUnchanged:previous,cases,rows,gridJoin:true,rejectedEditAtomic:true,delete:true,saveExport:true,oldReader:'旧Importerの種別ホワイトリストで拒否。旧バイナリ未実行。'};console.log(result);
