const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {recipe,save}=require('../asset-registry.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const {partition,manifest}=require('../map-storage.js');
const data=id=>JSON.stringify({assets:[{id:'rock',positions:[1,2,3]},{id,text:'日本語\\"'}],textures:[{id:'stone',png:'base64'}],dirt:{imageBase64:'abc'}});
const a=recipe('shared_props.json',data('tree'),hash),b=recipe('shared_props.json',data('new-tree'),hash);
const restore=r=>r.recipe.parts.map(p=>p.text===undefined?Buffer.from(r.objects.get(p.sha256)).toString():p.text).join('');
assert.equal(restore(a),data('tree'));assert.equal(restore(b),data('new-tree'));
assert.equal([...b.objects.keys()].filter(x=>!a.objects.has(x)).length,1);
// Exercise folder behaviour using the same File System Access interface, including failed/corrupted writes.
function dir(){const files=new Map(),dirs=new Map();return{files,dirs,
 async getDirectoryHandle(n,{create}={}){if(!dirs.has(n)){if(!create)throw missing();dirs.set(n,dir());}return dirs.get(n);},
 async getFileHandle(n,{create}={}){if(!files.has(n)){if(!create)throw missing();files.set(n,Buffer.alloc(0));}return{
  async getFile(){return new Blob([files.get(n)]);},async createWritable(){let b;return{async write(x){b=Buffer.from(x);},async close(){files.set(n,b);},async abort(){}};}};},
 async removeEntry(n){files.delete(n);}};}
function missing(){const e=Error('missing');e.name='NotFoundError';return e;}
function pack(id,library){const r=partition([{name:'map.json',data:JSON.stringify({roomId:id})},{name:'shared_props.json',data:library}],hash);return{...r,manifest:manifest(r.files,{exporterVersion:'test'},hash)};}
(async()=>{const root=dir(),zip=async files=>new Blob([JSON.stringify(files)]);
 const p=pack('one',data('tree'));const first=await save(root,p,'部屋',zip,hash);assert(first.added>0);
 const second=await save(root,pack('two',data('tree')),'部屋2',zip,hash);assert.equal(second.added,0);
 const next=await save(root,pack('three',data('new-tree')),'部屋3',zip,hash);assert.equal(next.added,1);
 assert.equal((await save(root,p,'部屋',zip,hash)).added,0);
 const room=root.dirs.get(first.folder),receipt=room.files.get('saved.txt');room.files.set('saving.txt',receipt);room.files.delete('saved.txt');
 assert.equal((await save(root,p,'部屋',zip,hash)).added,0);assert(room.files.has('saved.txt'));
 room.files.set('saving.txt',receipt);room.files.delete('saved.txt');room.files.delete('map_export_unity.zip');
 assert.equal((await save(root,p,'部屋',zip,hash)).added,0);assert(room.files.has('saved.txt'));
 const objects=root.dirs.get('_shared').dirs.get('objects'),key=objects.files.keys().next().value;objects.files.set(key,Buffer.from('corrupt'));
 await assert.rejects(save(root,p,'部屋',zip,hash),/不一致/);
 console.log('PASS: 素材単位の追加、同一素材再利用、旧版復元、繰り返し保存、改変拒否');
})().catch(e=>{console.error(e);process.exitCode=1;});
