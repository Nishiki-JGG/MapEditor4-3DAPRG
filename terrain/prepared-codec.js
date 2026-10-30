// 完成メッシュ・配置・通行状態の損失なしパック。旧形式も読み込める。
(function(root){'use strict';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true}),MAGIC=[84,68,80,83,2,0,0,0],align=n=>(n+7)&~7;
const little=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
function from64(s){if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(s,'base64'));return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function to64(b){if(typeof Buffer!=='undefined')return Buffer.from(b.buffer,b.byteOffset,b.byteLength).toString('base64');let s='';for(let i=0;i<b.length;i+=16384)s+=String.fromCharCode(...b.subarray(i,i+16384));return btoa(s);}
const types={u8:Uint8Array,f32:Float32Array,f64:Float64Array,i32:Int32Array,u16:Uint16Array,u32:Uint32Array};
function encode(value){
 if(!little)throw Error('完成データのバイト順に未対応です');
 const pool=[],buckets=new Map();
 function buffer(b,width){let h=2166136261;for(let i=0;i<b.length;i++)h=Math.imul(h^b[i],16777619);const key=width+'/'+b.length+'/'+(h>>>0),same=buckets.get(key)||[];
  for(const id of same)if(pool[id].bytes.every((v,i)=>v===b[i]))return id;
  const id=pool.length;pool.push({bytes:b,width});same.push(id);buckets.set(key,same);return id;
 }
 function node(v,depth=0){if(depth>64)throw Error('完成データの階層が深すぎます');
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('完成データの数値が不正です');return Object.is(v,-0)?['n','-0']:v;}
  if(v===undefined)return['u'];
  if(v instanceof Uint8Array||v instanceof Float32Array||v instanceof Float64Array||v instanceof Int32Array||v instanceof Uint16Array||v instanceof Uint32Array){const type=v instanceof Uint8Array?'u8':v instanceof Float32Array?'f32':v instanceof Int32Array?'i32':v instanceof Uint16Array?'u16':v instanceof Uint32Array?'u32':'f64';return['b',buffer(new Uint8Array(v.buffer,v.byteOffset,v.byteLength),v.BYTES_PER_ELEMENT),type];}
  if(v instanceof Map)return['m',[...v].map(([k,x])=>[node(k,depth+1),node(x,depth+1)])];
  if(Array.isArray(v))return['a',v.map(x=>node(x,depth+1))];
  // 属性のbase64はバイナリに戻し、同一の色・UVなどを1回だけ持つ。
  if(typeof v==='object'&&Number.isInteger(v.size)&&typeof v.f32==='string')return['g',v.size,buffer(from64(v.f32),4)];
  if(typeof v==='object')return['o',Object.entries(v).map(([k,x])=>[k,node(x,depth+1)])];
  throw Error('完成サンプルに未対応の値があります');
 }
 const tree=node(value);let offset=0;const buffers=pool.map(p=>{offset=align(offset);const d={offset,length:p.bytes.length,width:p.width};offset+=p.bytes.length;return d;});
 const metadata=enc.encode(JSON.stringify({version:2,buffers,tree})),start=align(12+metadata.length),out=new Uint8Array(start+offset);out.set(MAGIC);new DataView(out.buffer).setUint32(8,metadata.length,true);out.set(metadata,12);
 pool.forEach((p,i)=>{const d=buffers[i],count=d.length/d.width;if(!Number.isInteger(count))throw Error('属性のバイト数が不正です');if(d.width===4){const view=new DataView(p.bytes.buffer,p.bytes.byteOffset,p.bytes.byteLength);let previous=0;for(let j=0;j<count;j++){const word=view.getUint32(j*4,true),delta=(word-previous)>>>0;previous=word;for(let byte=0;byte<4;byte++)out[start+d.offset+byte*count+j]=delta>>>(byte*8)&255;}}else for(let byte=0;byte<d.width;byte++)for(let j=0;j<count;j++)out[start+d.offset+byte*count+j]=p.bytes[j*d.width+byte];});
 return out;
}
function decode(input){
 if(!little)throw Error('完成データのバイト順に未対応です');
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length<16||MAGIC.some((v,i)=>bytes[i]!==v))throw Error('完成サンプルの形式が違います');
 const n=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8,true);if(n>16*1024*1024||12+n>bytes.length)throw Error('完成サンプルのヘッダー長が不正です');
 const meta=JSON.parse(dec.decode(bytes.subarray(12,12+n))),start=align(12+n);if(meta.version!==2||!Array.isArray(meta.buffers)||meta.buffers.length>10000)throw Error('完成サンプルの版が違います');
 const raw=new Map(),typed=new Map(),strings=new Map();
 function data(id){if(raw.has(id))return raw.get(id);const d=meta.buffers[id];if(!d||![1,2,4,8].includes(d.width)||!Number.isInteger(d.offset)||d.offset<0||d.offset%8||!Number.isInteger(d.length)||d.length<0||d.length%d.width||start+d.offset+d.length>bytes.length)throw Error('完成サンプルの配列範囲が不正です');const b=new Uint8Array(d.length),count=d.length/d.width;if(d.width===4){const view=new DataView(b.buffer);let previous=0;for(let j=0;j<count;j++){let delta=0;for(let byte=0;byte<4;byte++)delta|=bytes[start+d.offset+byte*count+j]<<(byte*8);previous=(previous+delta)>>>0;view.setUint32(j*4,previous,true);}}else for(let byte=0;byte<d.width;byte++)for(let j=0;j<count;j++)b[j*d.width+byte]=bytes[start+d.offset+byte*count+j];raw.set(id,b);return b;}
 function node(v,depth=0){if(depth>64)throw Error('完成サンプルの階層が不正です');if(!Array.isArray(v)){if(v===null||['number','string','boolean'].includes(typeof v))return v;throw Error('完成サンプルの値が不正です');}
  if(v[0]==='u')return undefined;if(v[0]==='n'&&v[1]==='-0')return-0;
  if(v[0]==='b'){const C=types[v[2]],key=v[1]+'/'+v[2];if(!C)throw Error('完成サンプルの配列型が不正です');if(!typed.has(key)){const b=data(v[1]);if(b.length%C.BYTES_PER_ELEMENT)throw Error('完成サンプルの配列長が不正です');typed.set(key,new C(b.buffer));}return typed.get(key);}
  if(v[0]==='g'){if(!Number.isInteger(v[1])||v[1]<1||v[1]>4)throw Error('属性の幅が不正です');if(!strings.has(v[2]))strings.set(v[2],to64(data(v[2])));return{size:v[1],f32:strings.get(v[2])};}
  if(v[0]==='a')return v[1].map(x=>node(x,depth+1));
  if(v[0]==='m')return new Map(v[1].map(([k,x])=>[node(k,depth+1),node(x,depth+1)]));
  if(v[0]==='o')return Object.fromEntries(v[1].map(([k,x])=>[k,node(x,depth+1)]));
  throw Error('完成サンプルのタグが不正です');
 }
 return node(meta.tree);
}
const api={encode,decode,version:2};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TDPreparedCodec=api;
})(globalThis);
