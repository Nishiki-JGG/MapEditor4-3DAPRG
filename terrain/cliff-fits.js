// 個体加工の確定形状。表示・保護・衝突・保存・出力で共有する。
(() => {'use strict';
const bytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength),enc=new TextEncoder();
function pack(a){const u=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let s='';for(let i=0;i<u.length;i+=16384)s+=String.fromCharCode(...u.subarray(i,i+16384));return btoa(s);}
function unpack(s){const raw=atob(s);if(raw.length%4)throw Error('岩のFloat32長が不正です');const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Float32Array(bytes.buffer);}
const decodedAttributes=new WeakMap();
function attributeArray(d){return decodedAttributes.get(d)||(d.f32===undefined?Float32Array.from(d.values):unpack(d.f32));}
function describe(g,lazy=false){const attrs={};for(const name of Object.keys(g.attributes).sort()){const a=g.attributes[name];if(!a.isInstancedBufferAttribute){if(lazy){let packed;const d={size:a.itemSize,get f32(){return packed??(packed=pack(a.array));}};decodedAttributes.set(d,a.array);attrs[name]=d;}else attrs[name]={size:a.itemSize,f32:pack(a.array)};}}return{attributes:attrs,index:g.index?Array.from(g.index.array):null};}
function geometry(d){if(!d||!d.attributes?.position)throw Error('岩の確定頂点がありません');const g=new THREE.BufferGeometry();let count=null;for(const[name,source]of Object.entries(d.attributes)){const a={size:source.size,values:decodedAttributes.get(source)||(source.f32===undefined?source.values:unpack(source.f32))};if(!Number.isInteger(a.size)||a.size<1||a.size>4||!(Array.isArray(a.values)||a.values instanceof Float32Array)||a.values.length%a.size||a.values.some(x=>!Number.isFinite(x)))throw Error('岩の属性が不正です: '+name);const n=a.values.length/a.size;if(count===null)count=n;else if(n!==count)throw Error('岩の頂点数が一致しません');if(n>30000)throw Error('岩の頂点数上限を超えています');g.setAttribute(name,new THREE.BufferAttribute(a.values instanceof Float32Array?a.values:Float32Array.from(a.values),a.size));}if(d.index){if(d.index.length%3||d.index.some(x=>!Number.isInteger(x)||x<0||x>=count))throw Error('岩の三角形が不正です');g.setIndex(d.index);}else if(count%3)throw Error('岩の三角形数が不正です');g.computeBoundingBox();g.computeBoundingSphere();return g;}
class Store{
 constructor(types,hash){this.types=types;this.hash=hash;this.records=new Map();this.cache=new Map();this.sourceHashes=new Map();this.input='';}
 sourceHash(type){if(!this.sourceHashes.has(type))this.sourceHashes.set(type,this.hash(enc.encode(JSON.stringify(describe(this.types[type].geo)))));return this.sourceHashes.get(type);}
 pose(p){return JSON.stringify(p.slice(0,8));}
 remove(id){const c=this.cache.get(id);c?.geometry.dispose();c?.mesh?.removeFromParent();this.cache.delete(id);this.records.delete(id);}
 clear(){for(const c of this.cache.values()){c.geometry.dispose();c.mesh?.removeFromParent();}this.cache.clear();this.records.clear();}
 valid(p){const r=this.records.get(p[8]);return r&&r.input===this.input&&r.pose===this.pose(p)&&r.type===this.types[p[0]].id;}
 get(p){if(!this.valid(p))return null;const id=p[8];if(!this.cache.has(id))this.cache.set(id,{geometry:geometry(this.records.get(id).geometry)});return this.cache.get(id);}
 effectiveGeometry(p){return this.get(p)?.geometry||this.types[p[0]].geo;}
 synchronize(input,props){this.input=input;const ids=new Map(props.map(p=>[p[8],p]));let stale=0;for(const[id,r]of this.records){const p=ids.get(id);if(!p||!this.valid(p)){this.cache.get(id)?.geometry.dispose();this.cache.get(id)?.mesh?.removeFromParent();this.cache.delete(id);this.records.delete(id);stale++;}}return stale;}
 prepare(p,g,input,metadata={}){return{record:{type:this.types[p[0]].id,sourceSha256:this.sourceHash(p[0]),input,pose:this.pose(p),geometry:describe(g),...(metadata.affine?{affine:metadata.affine}:{}),...(metadata.layering===1?{layering:1}:{}),...(metadata.instanceTint?{instanceTint:metadata.instanceTint}:{})},cache:{geometry:g}};}
 setPrepared(p,prepared){if(!p[8]||prepared.record.type!==this.types[p[0]].id||prepared.record.pose!==this.pose(p))throw Error('準備済み岩の姿勢またはIDが一致しません');this.records.set(p[8],prepared.record);this.cache.set(p[8],prepared.cache);}
 set(p,g,input,metadata={}){this.setPrepared(p,this.prepare(p,g,input,metadata));}
 async prepareLoad(data,props,input,job){
  const cache=new Map(),ids=new Map(props.map(p=>[p[8],p]));try{
   if(data!==undefined){if(data.formatVersion!==1||!data.instances||Array.isArray(data.instances))throw Error('非対応の加工岩形式です');
    await TDPreparation.each(Object.entries(data.instances),([id,r])=>{this.validate({formatVersion:1,instances:{[id]:r}},props,input,cache,ids);},job);
   }return{data,input,cache};
  }catch(e){for(const c of cache.values())c.geometry.dispose();throw e;}
 }
 installPrepared(prepared,props,input){if(input!==prepared.input)throw Error('準備済み岩と地形が一致しません');const ids=new Map(props.map(p=>[p[8],p]));for(const[id,r]of Object.entries(prepared.data?.instances||{})){const p=ids.get(id);if(!p||r.pose!==this.pose(p)||r.type!==this.types[p[0]].id)throw Error('準備済み岩と読込先が一致しません');}this.clear();this.input=prepared.input;if(prepared.data)for(const[id,r]of Object.entries(prepared.data.instances))this.records.set(id,r);this.cache=prepared.cache;}

 save(){return{formatVersion:1,instances:Object.fromEntries(this.records)};}
 validate(data,props,input,preparedCache,preparedIds){if(data===undefined)return;if(data.formatVersion!==1||!data.instances||Array.isArray(data.instances))throw Error('非対応の加工岩形式です');const ids=preparedIds||new Map(props.map(p=>[p[8],p]));for(const[id,r]of Object.entries(data.instances)){const p=ids.get(id);if(!p||r.type!==this.types[p[0]].id||r.sourceSha256!==this.sourceHash(p[0]))throw Error('加工岩の元部品またはIDが一致しません: '+id);if(input!==undefined&&(r.input!==input||r.pose!==this.pose(p)))throw Error('加工岩と地形・姿勢が一致しません: '+id);if(r.instanceTint&&(!Array.isArray(r.instanceTint)||r.instanceTint.length!==3||r.instanceTint.some(v=>!Number.isFinite(v)||v<0||v>4)))throw Error('岩の色倍率が不正です');if(r.layering!==undefined&&r.layering!==1)throw Error('非対応の岩の重ね形式です');const g=geometry(r.geometry);try{if(r.affine){if(!Array.isArray(r.affine)||r.affine.length!==16||r.affine.some(x=>!Number.isFinite(x)))throw Error('岩の配置行列が不正です');const m=new THREE.Matrix4().fromArray(r.affine);if(m.determinant()<=0)throw Error('岩の配置行列が反転または退化しています');const expected=this.types[p[0]].geo.clone().applyMatrix4(m);for(const name of ['position','normal','color','uv']){const a=expected.attributes[name],b=g.attributes[name];if(!a&&!b)continue;if(!a||!b||a.count!==b.count||a.itemSize!==b.itemSize||a.array.some((v,i)=>Math.abs(v-b.array[i])>(name==='color'||name==='uv'?1e-6:1e-4)))throw Error('岩の確定形状と配置行列が一致しません: '+id);}if((expected.index?.count??0)!==(g.index?.count??0)||expected.index?.array.some((v,i)=>v!==g.index.array[i]))throw Error('岩の面構成が一致しません');expected.dispose();}if(preparedCache)preparedCache.set(id,{geometry:g});}finally{if(!preparedCache?.has(id))g.dispose();}}}
 // History records are immutable and shared with snapshots. Reuse only identical,
 // already validated records with the same terrain and pose; external files still validate.
 load(data,props,input,reuse=false,retained){
  const kept=new Map(),created=new Map(),ids=new Map(props.map(p=>[p[8],p]));
  try{
   if(data!==undefined){if(data.formatVersion!==1||!data.instances||Array.isArray(data.instances))throw Error('非対応の加工岩形式です');
    for(const[id,r]of Object.entries(data.instances)){
     const p=ids.get(id),saved=retained?.get(id),old=this.records.get(id)===r&&this.input===input,c=old?this.cache.get(id):saved?.record===r?saved.cache:null;
     if(reuse&&c&&r.input===input&&p&&r.pose===this.pose(p)&&r.type===this.types[p[0]].id)kept.set(id,c);
     else this.validate({formatVersion:1,instances:{[id]:r}},props,input,created,ids);
    }
   }
  }catch(e){for(const c of created.values())c.geometry.dispose();throw e;}
  for(const[id,c]of this.cache)if(!kept.has(id)){c.geometry.dispose();c.mesh?.removeFromParent();}
  this.records=new Map(Object.entries(data?.instances||{}));this.cache=new Map([...kept,...created]);this.input=input;
 }
 exportReferences(props,half,yZero){
  const fitted=props.filter(p=>this.valid(p));
  // Preserve old non-affine deformation verbatim; never approximate it with a transform.
  if(fitted.some(p=>{const r=this.records.get(p[8]);if(!r.affine)return true;
   const expected=this.types[p[0]].geo.clone().applyMatrix4(new THREE.Matrix4().fromArray(r.affine)),actual=this.get(p).geometry;
   try{for(const[n,a]of Object.entries(actual.attributes)){if(a.isInstancedBufferAttribute)continue;const b=expected.attributes[n];if(!b||b.array.length!==a.array.length)return true;const limit=n==='position'||n==='normal'?1e-4:0;for(let i=0;i<a.array.length;i++)if(Math.abs(a.array[i]-b.array[i])>limit)return true;}return false;}finally{expected.dispose();}
  }))return this.export(props,half,yZero);
  const sources=new Map(),instances=[];
  for(const p of fitted){const r=this.records.get(p[8]),g=this.types[p[0]].geo;
   if(!sources.has(r.sourceSha256)){const a=g.attributes;sources.set(r.sourceSha256,{id:r.sourceSha256,type:r.type,positions:Array.from(a.position.array),normals:Array.from(a.normal.array),colors:Array.from(a.color?.array||[]),uvs:Array.from(a.uv?.array||[]),triangles:g.index?Array.from(g.index.array):Array.from({length:a.position.count},(_,i)=>i)});}
   const instance=new THREE.Matrix4().compose(new THREE.Vector3(p[1],p[7],p[2]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p[3]),new THREE.Vector3(p[4],p[4]*(p[6]??1),p[4]));
   const frame=new THREE.Matrix4().set(1,0,0,half,0,1,0,-yZero,0,0,-1,half,0,0,0,1),matrix=frame.multiply(instance).multiply(new THREE.Matrix4().fromArray(r.affine));
   instances.push({instanceId:p[8],type:r.type,sourceSha256:r.sourceSha256,instanceTint:r.instanceTint,matrix:matrix.toArray(),material:'rock',replaceRenderer:true,replaceCollider:true});
  }
  return{format:'tdj-cliff-fits-reference',formatVersion:2,requiredFeature:'cliffFitsReferenceV2',library:'cliff_sources.json',instances,sources:{format:'map-cliff-sources',version:1,assets:[...sources.values()].sort((a,b)=>a.id.localeCompare(b.id))}};
 }
 export(props,half,yZero){const instances=[];for(const p of props){const r=this.records.get(p[8]),c=this.get(p);if(!c)continue;const g=c.geometry,P=g.attributes.position,N=g.attributes.normal,C=g.attributes.color,UV=g.attributes.uv,positions=[],normals=[],colors=[],uvs=[],triangles=[],cos=Math.cos(p[3]),sin=Math.sin(p[3]),sy=p[6]??1;for(let i=0;i<P.count;i++){const w=TDCliffContact.world(p,[P.getX(i),P.getY(i),P.getZ(i)]);positions.push(w[0]+half,w[1]-yZero,half-w[2]);const n=[N.getX(i)*cos+N.getZ(i)*sin,N.getY(i)/sy,-N.getX(i)*sin+N.getZ(i)*cos],len=Math.hypot(...n);normals.push(n[0]/len,n[1]/len,-n[2]/len);if(C)colors.push(C.getX(i),C.getY(i),C.getZ(i));if(UV)uvs.push(UV.getX(i),UV.getY(i));}for(let i=0;i<(g.index?.count??P.count);i+=3){const a=g.index?g.index.getX(i):i,b=g.index?g.index.getX(i+1):i+1,c=g.index?g.index.getX(i+2):i+2;triangles.push(a,c,b);}instances.push({instanceId:p[8],type:r.type,sourceSha256:r.sourceSha256,instanceTint:r.instanceTint,positions,normals,colors,uvs,triangles,material:'rock',replaceRenderer:true,replaceCollider:true});}return{format:'tdj-cliff-fits-mesh',formatVersion:1,requiredFeature:'cliffFitsMeshV1',coordinateSystem:'Unity world metres; same origin as meta.json',instances};}
}
window.TDCliffFits={Store,describe,geometry,attributeArray};})();
