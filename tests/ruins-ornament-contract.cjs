const assert=require('assert/strict'),fs=require('fs'),R=require('../ruins.js'),hashes=require('./fixtures/ruins-plain-before-ornaments.json'),hash=v=>require('crypto').createHash('sha256').update(JSON.stringify(v)).digest('hex');
const kinds=['wall','wall_broken','wall_ruined','pier','pier_broken','arch','arch_broken','paving','paving_broken'];
const rows=[];
// 歴史的な比較対象は保存済み基準に固定。新種は専用試験で検証。
for(const key of Object.keys(hashes)){const [kind,finish]=key.split(':');assert(R.TYPES[kind]);
 let p={...R.defaults(kind),finish};
 assert.equal(hash(R.mesh(p)),hashes[kind+':'+finish],'Existing mesh/UV changed '+kind+' '+finish);
}
for(const kind of kinds){let p={...R.defaults(kind),id:'ruins_1',finish:'carved'};
 if(kind==='wall_broken')p.length=2;
 const a=R.mesh(p),b=R.mesh({...p,finish:'stone'});assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.normals,b.normals);
 assert.notDeepEqual(a.uv,b.uv);assert(a.uv.every(Number.isFinite));assert.deepEqual(R.sockets(p),R.sockets({...p,finish:'stone'}));
 const m={version:1,nextId:2,items:[p]};R.validate(m);
 assert.deepEqual(R.mesh(JSON.parse(JSON.stringify(p))),a);
 for(let z=-2;z<=2;z+=.2)for(let x=-2;x<=2;x+=.2){assert.deepEqual(R.floor(m,x,z),R.floor({...m,items:[{...p,finish:'stone'}]},x,z));assert.equal(R.blocked(m,x,z,.25,0,1.6),R.blocked({...m,items:[{...p,finish:'stone'}]},x,z,.25,0,1.6));}
 rows.push({kind,triangles:a.positions.length/9,taggedVertices:a.uv.filter((v,i)=>i%2===0&&v< -96).length});
}
// 高床の装飾は後続実装で対応済み。古い未対応前提を訂正。
assert.doesNotThrow(()=>R.validate({version:1,nextId:2,items:[{...R.defaults('platform'),id:'ruins_1',finish:'carved'}]}));
assert.throws(()=>R.validate({version:1,nextId:2,items:[{...R.defaults('platform'),id:'ruins_1',finish:'unknown'}]}));
console.log(rows);
