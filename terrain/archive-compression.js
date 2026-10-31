// Exact stored-buffer compression; never constructs terrain or scatters objects.
(function(root){'use strict';
const bytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength),cache=new WeakMap();
let encoder;
async function ready(){if(!encoder)encoder=import('./vendor/meshopt_encoder.mjs').then(async m=>{await m.MeshoptEncoder.ready;return m.MeshoptEncoder;});return encoder;}
function array(a,size,e){
 if(cache.has(a))return cache.get(a);
 let result={type:'raw',array:a};
 if(a instanceof Float32Array&&a.length){
  const b=new Uint32Array(a.buffer,a.byteOffset,a.length),lookup=new Map(),values=[],ids=new Uint32Array(a.length/size);let unique=true;
  for(let i=0;i<ids.length;i++){const key=Array.from(b.subarray(i*size,i*size+size)).join(',');let id=lookup.get(key);if(id===undefined){id=values.length/size;lookup.set(key,id);for(let j=0;j<size;j++)values.push(b[i*size+j]);if(values.length>Math.max(64,a.length/8)){unique=false;break;}}ids[i]=id;}
  result=unique?{type:'palette',size,length:a.length,values:new Float32Array(Uint32Array.from(values).buffer),ids:values.length/size<=65536?Uint16Array.from(ids):ids}:{type:'meshopt',count:a.length/size,stride:size*4,data:e.encodeVertexBuffer(bytes(a),a.length/size,size*4)};
 }else if(a.length&&(a instanceof Uint16Array||a instanceof Uint32Array))result={type:'index-meshopt',count:a.length,width:a.BYTES_PER_ELEMENT,data:e.encodeIndexSequence(bytes(a),a.length,a.BYTES_PER_ELEMENT)};
 cache.set(a,result);return result;
}
function geometry(g,e){if(!g?.attributes)return g;const{attributes,index,...other}=g;return{format:'lossless-surface-v1',other,attributes:Object.fromEntries(Object.entries(attributes).map(([n,a])=>[n,{...a,array:array(a.array,a.size,e)}])),index:index===null?null:array(index,1,e)};}
async function pack(value){
 const e=await ready(),surface=value.surface;
 const collision=value.collision;
 return{...value,surface:surface?.surfaces?{...surface,surfaces:Object.fromEntries(Object.entries(surface.surfaces).map(([n,g])=>[n,geometry(g,e)]))}:surface,
 collision:collision?.fitted?{...collision,fitted:collision.fitted.map(([id,r])=>{const f=TDCompletedState.compactFittedFootprint(r.footprint);return[id,{...r,footprint:{...f,fields:new Map([...f.fields].map(([k,v])=>[k,TDSavedBoundary.pack(v,f)]))}}];})}:collision};
}
async function open(value){
 await MeshoptDecoder.ready;const surface=value.surface,collision=value.collision;
 return{...value,surface:surface?.surfaces?{...surface,surfaces:Object.fromEntries(Object.entries(surface.surfaces).map(([n,g])=>[n,TDStoredSurface.decode(g,MeshoptDecoder)]))}:surface,
 collision:collision?.fitted?{...collision,fitted:collision.fitted.map(([id,r])=>{const f=r.footprint;return[id,{...r,footprint:{...f,fields:new Map([...f.fields].map(([k,v])=>[k,v.kind==='saved-boundary-field-v1'?TDSavedBoundary.open(v,f):v]))}}];})}:collision};
}
root.TDArchiveCompression={pack,open};
})(globalThis);
