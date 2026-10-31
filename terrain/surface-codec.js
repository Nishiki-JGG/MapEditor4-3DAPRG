// Stored surface decompression only. No quantization, topology edit or smoothing.
(function(root){'use strict';
function check(ok){if(!ok)throw Error('保存地形の圧縮データが不正です');}
const bits=a=>new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4);
function array(p,decoder){
 if(p.type==='raw')return p.array;
 if(p.type==='planes'){const k=p.planes.length,n=p.planes[0]?.length;check(k>=1&&k<=4&&Number.isInteger(n)&&n*k<=12e6&&p.planes.every(a=>a instanceof Float32Array&&a.length===n));const w=new Uint32Array(n*k);for(let j=0;j<k;j++){const src=bits(p.planes[j]);for(let i=0;i<n;i++)w[i*k+j]=src[i];}return new Float32Array(w.buffer);}
 if(p.type==='palette'){check(Number.isInteger(p.length)&&p.length>=0&&p.length<=12e6&&Number.isInteger(p.size)&&p.size>=1&&p.size<=4&&p.ids.length*p.size===p.length&&p.values.length%p.size===0);const w=new Uint32Array(p.length),src=bits(p.values);for(let i=0;i<p.ids.length;i++){check(p.ids[i]<p.values.length/p.size);for(let j=0;j<p.size;j++)w[i*p.size+j]=src[p.ids[i]*p.size+j];}return new Float32Array(w.buffer);}
 if(p.type==='meshopt'){check(Number.isInteger(p.count)&&p.count>=0&&Number.isInteger(p.stride)&&p.stride>=4&&p.stride<=16&&p.stride%4===0&&p.count*p.stride<=48e6);const b=new Uint8Array(p.count*p.stride);decoder.decodeVertexBuffer(b,p.count,p.stride,p.data);return new Float32Array(b.buffer);}
 if(p.type==='index-meshopt'){check(Number.isInteger(p.count)&&p.count>=0&&p.count<=12e6&&[2,4].includes(p.width));const b=new Uint8Array(p.count*p.width);decoder.decodeIndexSequence(b,p.count,p.width,p.data);return p.width===2?new Uint16Array(b.buffer):new Uint32Array(b.buffer);}
 throw Error('非対応の地形圧縮方式です');
}
function decode(g,decoder){if(g?.format!=='lossless-surface-v1')return g;return{...g.other,attributes:Object.fromEntries(Object.entries(g.attributes).map(([n,a])=>[n,{...a,array:array(a.array,decoder)}])),index:g.index===null?null:array(g.index,decoder)};}
const api={decode,array};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TDStoredSurface=api;
})(globalThis);
