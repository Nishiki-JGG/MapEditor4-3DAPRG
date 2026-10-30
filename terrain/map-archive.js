// 編集用 .map。共通岩の版＋完全行列＋旧Float32差分と、確定地形を一度だけ圧縮する。
(function(root){'use strict';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true}),LIMIT=256*1024*1024;
const hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join('');
const bits=a=>new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4);
// Same palette/delta representation as the existing completed sample codec.
function deltaAttribute(actual,expected,size){
 if(actual.length!==expected.length)throw Error('岩の元モデルの頂点数が違います');
 const delta=new Int32Array(actual.length);let changed=false;
 for(let i=0;i<delta.length;i++){delta[i]=(actual[i]-expected[i])|0;changed ||=delta[i]!==0;}
 if(!changed)return null;
 const table=[],indices=[],lookup=new Map();
 for(let i=0;i<delta.length;i+=size){const tuple=Array.from(delta.subarray(i,i+size)),key=tuple.join(',');let id=lookup.get(key);if(id===undefined){id=table.length/size;lookup.set(key,id);table.push(...tuple);}indices.push(id);}
 return table.length*4+indices.length*2<delta.byteLength&&lookup.size<65536?{size,values:Int32Array.from(table),indices:Uint16Array.from(indices)}:{size,delta};
}
function matrix(r){if(!Array.isArray(r.affine)||r.affine.length!==16||!r.affine.every(Number.isFinite))throw Error('岩の変換が不正です');const m=new THREE.Matrix4().fromArray(r.affine);if(m.determinant()<=0)throw Error('岩の変換が退化しています');return m;}
const fitCache=new WeakMap();
function compactFits(data,resolve){
 if(!data)return data;if(data.formatVersion!==1)throw Error('加工岩の版が違います');
 const instances={};
 for(const[id,r]of Object.entries(data.instances)){
  if(!r.affine){instances[id]=r;continue;}
  const source=resolve(r.type,r.sourceSha256),cached=fitCache.get(r);
  if(cached?.source===source){instances[id]=cached.record;continue;}
  const g=source.clone().applyMatrix4(matrix(r));
  try{
   const ix=r.geometry.index||[],expected=g.index?.array||[];if(ix.length!==expected.length||ix.some((v,i)=>v!==expected[i]))throw Error('岩の面構成が違います');
   const attributes={};
   if(Object.keys(r.geometry.attributes).sort().join()!==Object.keys(g.attributes).filter(n=>!g.attributes[n].isInstancedBufferAttribute).sort().join())throw Error('岩の属性構成が違います');
   for(const[name,v]of Object.entries(r.geometry.attributes)){
    const a=g.attributes[name],actual=TDCliffFits.attributeArray(v);
    if(a.itemSize!==v.size)throw Error('岩の属性幅が違います');
    const d=deltaAttribute(bits(actual),bits(a.array),v.size);if(d)attributes[name]=d;
   }
   instances[id]={...r,geometry:{preparedAffineDelta:1,attributes}};fitCache.set(r,{source,record:instances[id]});
  }finally{g.dispose();}
 }
 return{formatVersion:1,instances};
}
function expandFits(data,resolve){
 if(!data)return data;const instances={};
 for(const[id,r]of Object.entries(data.instances)){
  if(r.geometry?.preparedAffineDelta!==1){instances[id]=r;continue;}
  const g=resolve(r.type,r.sourceSha256).clone().applyMatrix4(matrix(r));
  try{
   for(const[name,v]of Object.entries(r.geometry.attributes)){
    const a=g.attributes[name];if(!a||a.itemSize!==v.size)throw Error('完成岩の属性が一致しません');
    const direct=v.delta instanceof Int32Array&&v.delta.length===a.array.length,palette=v.values instanceof Int32Array&&v.indices instanceof Uint16Array&&v.indices.length===a.count&&v.values.length%v.size===0&&v.indices.every(i=>i<v.values.length/v.size);
    if(!direct&&!palette)throw Error('完成岩の差分が不正です');
    const b=bits(a.array);for(let i=0;i<b.length;i++)b[i]=(b[i]+(direct?v.delta[i]:v.values[v.indices[Math.floor(i/v.size)]*v.size+i%v.size]))>>>0;
    if(!a.array.every(Number.isFinite))throw Error('完成岩の数値が不正です');
   }
   instances[id]={...r,geometry:TDCliffFits.describe(g,true)};
  }finally{g.dispose();}
 }
 return{formatVersion:1,instances};
}
function deferredFits(data,resolve){
 if(!data)return data;
 if(data.formatVersion!==1||!data.instances||Array.isArray(data.instances))throw Error('加工岩の版が違います');
 const instances={};
 for(const [id,r]of Object.entries(data.instances)){
  if(r.geometry?.preparedAffineDelta!==1){instances[id]=r;continue;}
  const source=resolve(r.type,r.sourceSha256);matrix(r);let description;
  const record={...r};Object.defineProperty(record,'geometry',{enumerable:true,get(){if(!description)description=expandFits({formatVersion:1,instances:{[id]:r}},resolve).instances[id].geometry;return description;}});
  fitCache.set(record,{source,record:r});instances[id]=record;
 }
 return{formatVersion:1,instances};
}
// The in-memory restored payload is not serialized to JSON or trusted from a JSON file.
const completed=new WeakMap();
function completedFor(map){return completed.get(map)||null;}
async function create(map,value,resolve,makeZip){
 const {completedState,...source}=map;
 const compact={...source,cliffFits:compactFits(source.cliffFits,resolve)};
 const raw=TDPreparedCodec.encode({version:1,map:compact,completed:value});
 if(raw.length>LIMIT)throw Error('マップの展開サイズが256 MiBを超えています');
 const manifest={format:'map-editor-archive',version:1,roomId:map.roomId,requiredFeatures:['affine-delta-v1','completed-state-v1'],file:'map.tdps',bytes:raw.length,sha256:await hash(raw)};
 return makeZip([{name:'manifest.json',data:JSON.stringify(manifest)},{name:'map.tdps',data:raw}]);
}
// Read only our two bounded entries. Verify both ZIP headers, CRC and the payload SHA before decoding.
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(a){let c=0xffffffff;for(let i=0;i<a.length;i++)c=crcTable[(c^a[i])&255]^(c>>>8);return(c^0xffffffff)>>>0;}
async function unzip(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input);if(b.length<22||b.length>LIMIT)throw Error('マップファイルの長さが不正です');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),e=b.length-22;
 if(v.getUint32(e,true)!==0x06054b50||v.getUint16(e+4,true)||v.getUint16(e+6,true)||v.getUint16(e+8,true)!==2||v.getUint16(e+10,true)!==2||v.getUint16(e+20,true))throw Error('非対応のマップZIPです');
 const directory=v.getUint32(e+16,true);if(directory+v.getUint32(e+12,true)!==e)throw Error('ZIP一覧が不正です');
 const entries=new Map();let p=directory,localEnd=0,total=0;
 for(let i=0;i<2;i++){
  if(p+46>e||v.getUint32(p,true)!==0x02014b50)throw Error('ZIP一覧が不正です');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),checksum=v.getUint32(p+16,true),packed=v.getUint32(p+20,true),size=v.getUint32(p+24,true),n=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),o=v.getUint32(p+42,true);
  if(p+46+n+extra+comment>e)throw Error('ZIP名が不正です');const name=dec.decode(b.subarray(p+46,p+46+n));
  if(!['manifest.json','map.tdps'].includes(name)||entries.has(name)||flags!==0x800||![0,8].includes(method)||(total+=size)>LIMIT||size>(name==='manifest.json'?4096:LIMIT)||o!==localEnd||o+30>directory)throw Error('マップZIPの項目が不正です');
  const nl=v.getUint16(o+26,true),xl=v.getUint16(o+28,true),start=o+30+nl+xl;
  if(v.getUint32(o,true)!==0x04034b50||v.getUint16(o+6,true)!==flags||v.getUint16(o+8,true)!==method||v.getUint32(o+14,true)!==checksum||v.getUint32(o+18,true)!==packed||v.getUint32(o+22,true)!==size||start+packed>directory||dec.decode(b.subarray(o+30,o+30+nl))!==name)throw Error('マップZIPのヘッダーが一致しません');
  let data=b.subarray(start,start+packed);
  // ZIP raw DEFLATE + its CRC/size is a valid gzip body. Native decompression verifies CRC without a second JS byte scan.
  if(method===8){const tail=new Uint8Array(8),tv=new DataView(tail.buffer);tv.setUint32(0,checksum,true);tv.setUint32(4,size,true);const reader=new Blob([new Uint8Array([31,139,8,0,0,0,0,0,0,255]),data,tail]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),out=new Uint8Array(size);let length=0,done=false;try{for(;;){const q=await reader.read();if(q.done){done=true;break;}if(length+q.value.length>size)throw Error('マップの展開サイズを超えています');out.set(q.value,length);length+=q.value.length;}}finally{if(!done)await reader.cancel().catch(()=>{});}if(length!==size)throw Error('マップデータが途切れています');data=out;}
  if(data.length!==size||(method===0&&crc(data)!==checksum))throw Error('マップデータの検査値が不一致です');entries.set(name,data);localEnd=start+packed;p+=46+n+extra+comment;
 }
 if(p!==e||localEnd!==directory)throw Error('マップZIPの末尾が不正です');return entries;
}
async function read(input,resolve){
 const entries=await unzip(input),m=JSON.parse(dec.decode(entries.get('manifest.json'))),raw=entries.get('map.tdps');
 if(m.format!=='map-editor-archive'||m.version!==1||m.file!=='map.tdps'||JSON.stringify(m.requiredFeatures)!==JSON.stringify(['affine-delta-v1','completed-state-v1'])||m.bytes!==raw.length||m.sha256!==await hash(raw))throw Error('非対応または破損したマップです');
 const d=TDPreparedCodec.decode(raw);if(d.version!==1||d.map?.format!=='map-editor-proto'||d.completed?.version!==1||d.map?.roomId!==m.roomId)throw Error('マップの内容が不正です');
 const map={...d.map,cliffFits:deferredFits(d.map.cliffFits,resolve)};completed.set(map,d.completed);return map;
}
const api={create,read,completedFor,compactFits,expandFits};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TDMapArchive=api;
})(globalThis);
