const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {partition,manifest}=require('../map-storage.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const lib={version:1,units:'metres',axes:'Unity X/Y/Z',assets:[{id:'stone',positions:[1,2,3]}],atlas:{png:'abc'}};
function input(id,tint){return[
 {name:'map.json',data:JSON.stringify({roomId:id})},
 {name:'shared_props.json',data:'same models'},
 {name:'small_props.json',data:JSON.stringify({...lib,instances:[{instanceId:id,tint}],grounded:{assets:[],instances:[id]}})},
 {name:'asset_catalog.json',data:JSON.stringify({custom:id})}
];}
const a=partition(input('one',[1,0,0]),hash),b=partition(input('two',[0,1,0]),hash);
assert.equal(a.bundleHash,b.bundleHash);
assert.deepEqual(a.sharedFiles,b.sharedFiles);
const local=JSON.parse(a.files.find(f=>f.name==='small_props.json').data);
assert.equal(local.assets,undefined);assert.equal(local.atlas,undefined);
assert.deepEqual(local.instances,[{instanceId:'one',tint:[1,0,0]}]);assert.deepEqual(local.grounded.instances,['one']);
assert(!a.files.some(f=>f.name==='shared_props.json'));
assert(a.files.some(f=>f.name==='asset_catalog.json'));
const changed=input('one',[1,0,0]);changed[1].data+='changed';assert.notEqual(partition(changed,hash).bundleHash,a.bundleHash);
assert.equal(partition(input('one',[1,0,0]),hash).bundleHash,a.bundleHash);
const m=manifest(a.files,{exporterVersion:'test'},hash);assert.equal(m.schemaVersion,4);
for(const f of m.files)assert.equal(hash(Buffer.from(a.files.find(x=>x.name===f.name).data)),f.sha256);
console.log('PASS: 部屋の色・接地は固有、共通版は配置に依存せず素材変更で更新、catalog保持、manifest一致');
