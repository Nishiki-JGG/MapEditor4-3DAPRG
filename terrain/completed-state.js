// 編集済みの完成メッシュを保持・圧縮保存。形状生成器は呼ばない。
(() => {'use strict';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const bytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
function capture(g,copy=false){
 const attributes={};for(const[name,a]of Object.entries(g.attributes))if(!a.isInstancedBufferAttribute)attributes[name]={size:a.itemSize,array:copy?a.array.slice():a.array};
 return{attributes,index:g.index?(copy?g.index.array.slice():g.index.array):null,userData:structuredClone(g.userData)};
}
// Unchanged attributes share storage between immutable history entries.
function share(next,previous){
 if(next===previous)return previous;
 if(ArrayBuffer.isView(next)){if(!previous||next.constructor!==previous.constructor||next.length!==previous.length)return next;for(let i=0;i<next.length;i++)if(next[i]!==previous[i])return next;return previous;}
 if(next&&typeof next==='object'&&!(next instanceof Map))for(const key of Object.keys(next))next[key]=share(next[key],previous?.[key]);return next;
}
function historyBytes(states,baseline=[]){
 const seen=new Set();let bytes=0;
 function count(v){if(v===null||v===undefined)return;if(typeof v==='string'){bytes+=v.length*2;return;}if(typeof v!=='object'||seen.has(v))return;seen.add(v);if(ArrayBuffer.isView(v)){if(!seen.has(v.buffer)){seen.add(v.buffer);bytes+=v.buffer.byteLength;}return;}if(Array.isArray(v)&&v.length&&typeof v[0]==='number'){bytes+=v.length*8;return;}if(v instanceof Map){for(const x of v.values())count(x);return;}for(const x of Object.values(v))count(x);}
 function state(s){count(s);for(const {cache}of s.runtimeFits?.values()||[]){count(cache.geometry.attributes);count(cache.geometry.index);count(cache.footprint);}}
 baseline.forEach(state);bytes=0;states.forEach(state);return bytes;
}
function validate(d){
 if(!d?.attributes?.position)throw Error('完成地形の頂点がありません');let count=null;
 for(const a of Object.values(d.attributes)){
  if(!Number.isInteger(a.size)||a.size<1||a.size>4||!(a.array instanceof Float32Array)||a.array.length%a.size||a.array.length>12e6||!a.array.every(Number.isFinite))throw Error('完成地形の属性が不正です');
  const n=a.array.length/a.size;if(count===null)count=n;else if(n!==count)throw Error('完成地形の頂点数が一致しません');
 }
 if(d.index!==null&&(!(d.index instanceof Uint32Array||d.index instanceof Uint16Array)||d.index.length%3||d.index.some(i=>i>=count)))throw Error('完成地形の面が不正です');
}
function read(d,mutableIndex=false){
 const g=new THREE.BufferGeometry();for(const[name,a]of Object.entries(d.attributes))g.setAttribute(name,new THREE.BufferAttribute(a.array,a.size));
 if(d.index)g.setIndex(new THREE.BufferAttribute(mutableIndex?d.index.slice():d.index,1));g.userData=structuredClone(d.userData||{});g.computeBoundingSphere();g.computeBoundingBox();return g;
}
function copyInto(g,d){
 for(const[name,a]of Object.entries(d.attributes)){const target=g.attributes[name];if(!target||target.itemSize!==a.size||target.array.length!==a.array.length)throw Error('完成地形の編集格子が一致しません');target.array.set(a.array);target.needsUpdate=true;}
 if(d.index){if(!g.index||g.index.array.length!==d.index.length)g.setIndex(new THREE.BufferAttribute(d.index.slice(),1));else{g.index.array.set(d.index);g.index.needsUpdate=true;}}
 g.computeBoundingSphere();g.computeBoundingBox();
}
function base(map){const{completedState,revision,lastExportHash,...source}=map;return source;}
async function pack(map,value){
 const source=JSON.stringify(base(map)),raw=TDPreparedCodec.encode(value);
 if(raw.length>256*1024*1024)throw Error('完成状態が保存上限（256 MiB）を超えています。元のファイルは変更していません');
 const packed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 if(Math.ceil(packed.length/3)*4>180e6)throw Error('完成状態の圧縮データが保存上限を超えています。元のファイルは変更していません');
 let text='';for(let i=0;i<packed.length;i+=16384)text+=String.fromCharCode(...packed.subarray(i,i+16384));
 return{version:1,codec:'tdps2-gzip',sourceSha256:await hash(new TextEncoder().encode(source)),rawBytes:raw.length,data:btoa(text)};
}
async function unpack(map){
 const d=map.completedState;if(!d)return null;
 if(d.version!==1||d.codec!=='tdps2-gzip'||typeof d.data!=='string'||d.data.length>180e6||!Number.isInteger(d.rawBytes)||d.rawBytes<1||d.rawBytes>256*1024*1024)throw Error('完成状態の保存形式が不正です');
 if(d.sourceSha256!==await hash(new TextEncoder().encode(JSON.stringify(base(map)))))throw Error('原稿と完成状態が一致しません');
 const raw=atob(d.data),packed=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)packed[i]=raw.charCodeAt(i);
 const reader=new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks=[];let length=0;
 for(;;){const q=await reader.read();if(q.done)break;length+=q.value.length;if(length>d.rawBytes){await reader.cancel();throw Error('完成状態の長さが不正です');}chunks.push(q.value);}
 if(length!==d.rawBytes)throw Error('完成状態の長さが一致しません');
 const joined=new Uint8Array(length);let offset=0;for(const c of chunks){joined.set(c,offset);offset+=c.length;}return TDPreparedCodec.decode(joined);
}
window.TDCompletedState={share,historyBytes,capture,validate,read,copyInto,pack,unpack};
})();
