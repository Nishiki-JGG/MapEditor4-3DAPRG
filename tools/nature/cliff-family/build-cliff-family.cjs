// 既存の縦岩・現行岩塊・岩・小石を加工する。原型の差替えは inputs と INPUTS.json で追跡する。
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const THREE = require('../../../three.min.js');
const base = __dirname;
function source(file) {
  const c = { THREE, window: {} }; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.resolve(base,'../../../props/common.js'),'utf8'),c);
  c.TDGeo = c.window.TDGeo; c.TDProps = c.window.TDProps;
  vm.runInContext(fs.readFileSync(path.join(base,'inputs',file),'utf8'),c);
  return {g:c.TDProps.build()[0].geo, geo:c.TDGeo};
}
const old = source('vertical-cliff.js'), broad = source('broad-cliff.js'), pebble = source('pebble.js');
const { makeGeo, mat4, col, mixc, clamp } = old.geo;
function components(g) {
  g = g.index ? g.toNonIndexed() : g;
  const a=g.attributes.position, verts=new Map(), parent=Array.from({length:a.count/3},(_,i)=>i);
  const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  for(let i=0;i<a.count;i++) {
    const key=[a.getX(i),a.getY(i),a.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
    const t=Math.floor(i/3); if(verts.has(key))parent[find(t)]=find(verts.get(key));else verts.set(key,t);
  }
  const groups=new Map();for(let t=0;t<parent.length;t++){const root=find(t);if(!groups.has(root))groups.set(root,[]);for(let q=0;q<3;q++){const i=t*3+q;groups.get(root).push(a.getX(i),a.getY(i),a.getZ(i));}}
  return [...groups.values()].map(p=>{const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(p,3));out.computeBoundingBox();return out;}).sort((a,b)=>(b.boundingBox.max.y-b.boundingBox.min.y)-(a.boundingBox.max.y-a.boundingBox.min.y));
}
function joined(gs){const p=[];for(const g of gs)p.push(...g.attributes.position.array);const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(p,3));return out;}
function fit(g,w,h,d,bury=.1){g=g.clone();g.computeBoundingBox();const b=g.boundingBox,s=new THREE.Vector3();b.getSize(s);g.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);g.scale(w/s.x,h/s.y,d/s.z);g.translate(0,-bury,0);return g;}
function deform(g,fn){const p=g.attributes.position;for(let i=0;i<p.count;i++){const v=fn(p.getX(i),p.getY(i),p.getZ(i));p.setXYZ(i,...v);}return g;}
// 元の長い面を水平な層で分割してから変形する。単なる細長い五角柱のままにしない。
function weathered(g,seed=0){
  const bands=[0,.15,.34,.43,.59,.73,.91,1],out=[];
  for(const [ci,c] of components(g).entries()){
    const box=c.boundingBox,lo=box.min.y,hi=box.max.y,h=hi-lo,cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
    if(h<.45){out.push(c);continue;}
    const p=c.attributes.position,P=[];
    const clip=(poly,y,above)=>{
      const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=above?a[1]>=y-1e-9:a[1]<=y+1e-9,bi=above?b[1]>=y-1e-9:b[1]<=y+1e-9;if(ai)result.push(a);if(ai!==bi){const t=(y-a[1])/(b[1]-a[1]);result.push([a[0]+(b[0]-a[0])*t,y,a[2]+(b[2]-a[2])*t]);}}return result;
    };
    for(let i=0;i<p.count;i+=3){const tri=Array.from({length:3},(_,q)=>[p.getX(i+q),p.getY(i+q),p.getZ(i+q)]);
      for(let r=0;r<bands.length-1;r++){const poly=clip(clip(tri,lo+h*bands[r],true),lo+h*bands[r+1],false);for(let k=1;k<poly.length-1;k++)P.push(...poly[0],...poly[k],...poly[k+1]);}
    }
    const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
    deform(q,(x,y,z)=>{
      const t=clamp((y-lo)/h,0,1),phase=seed*.27+ci*1.93;
      // まとまった出張りと割れたくびれ。水平層の高さを柱ごとにずらす。
      const radial=1+.14*Math.sin(t*11.4+phase)+.07*Math.cos(t*21.1-phase);
      const lean=.12*Math.sin(phase)*t;
      const front=(z-cz)>0?.10*Math.sin(t*15+phase):0;
      return[cx+(x-cx)*radial+lean, y+.025*Math.sin((x-cx)*8+phase)*Math.sin(Math.PI*t), cz+(z-cz)*radial+front];
    });out.push(q);
  }
  return joined(out);
}
function clean(g){const p=g.attributes.position,arr=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);if(ab.subVectors(b,a).cross(ac.subVectors(c,a)).lengthSq()<1e-12)continue;for(const v of [a,b,c])arr.push(v.x,v.y,v.z);}const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));return out;}
function colour(y,ny,R,pr,x,z){
  // 共通の灰褐色。細部の色で形状差を代用しない。元rockの黒い頂点色は不使用。
  const mineral=.5+.5*Math.sin(x*4.1+y*2.7+z*3.2);
  const t=clamp(.38+mineral*.19+Math.max(0,ny)*.12+(R()-.5)*.06,0,1);
  let c=mixc(col(0x827b6d),col(0xbdb5a2),t);
  if(ny>.55 && y>.25)c=mixc(c,col(0x7a8755),.12);
  return c;
}
function finish(g,seed){return makeGeo([{g:clean(g),m:mat4(0,0,0,1,1,1),cfn:colour,j:.025}],seed,{ao:.28,smooth:37});}
const cols=components(old.g);
const g1=fit(weathered(old.g,3),2.5,2.4,1.0);
// V2は古い原型の独立した柱2本から。欠けた片側と斜めの面を輪郭に出す。
const adjacent=[...cols].filter(c=>c.boundingBox.max.y-c.boundingBox.min.y>1).sort((a,b)=>a.boundingBox.min.x-b.boundingBox.min.x).slice(0,2);
let g2=fit(weathered(joined(adjacent),11),1.8,2.4,.7);
deform(g2,(x,y,z)=>{const t=clamp((y+.1)/2.4,0,1);return[x+.23*t-.12*t*t,y-(x>.3?.32*t*t:0),z+(x<0?.10*t:-.08*t)];});
g2=fit(g2,1.8,2.4,.7);
const g3=fit(broad.g,2.5,2.4,1.0);
deform(g3,(x,y,z)=>{const t=clamp((y+.1)/2.4,0,1);return[x*(1-.06*t),y,z+(.12*Math.sin(t*5.2))*Math.max(0,1-Math.abs(x)/1.25)];});
// V4は一本の実形状を抽出。複数柱を横に潰さない。
const g4=fit(weathered(cols[0],17),.8,2.4,.5);
const raw=JSON.parse(fs.readFileSync(path.join(base,'inputs/rock.json'),'utf8'));
let rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(raw.positions,3));rg.setIndex(raw.triangles);rg=rg.toNonIndexed();
const g5=fit(rg,1.15,.40,.52,.07);
deform(g5,(x,y,z)=>[x,y<.025?-.07:y,z]);
// T2は既存小石群を向き・サイズを変えて重ねる。裾が低く、独立した大岩を作らない。
const pparts=[];for(const [x,z,s,rot]of [[-.25,0,.72,.2],[.18,.04,.54,2.4],[.02,-.13,.44,4.1]]){
  const g=pebble.g.clone();g.applyMatrix4(mat4(x,0,z,s,s,s,rot));pparts.push(g);
}
const g6=fit(joined(pparts),.96,.29,.56,.045);
const specs=[['cliff','V1','縦割れの基本岩',g1],['cliff_split','V2','斜割れ・片側欠け',g2],['cliff_shoulder','V3','段状肩の縦岩',g3],['cliff_joint','V4','継ぎ・角・終端の細岩',g4],['cliff_slab','T1','低い板状の裾岩',g5],['cliff_talus','T2','自然な崩落小石群',g6]];
const family=specs.map(([id,role,name,g],i)=>{
  g=finish(g,170+i*43);g.computeBoundingBox();const b=g.boundingBox,s=new THREE.Vector3();b.getSize(s);
  g.uuid='cliff-family-'+id;
  return{id,role,name,material:'rock',dimensions:s.toArray(),bounds:{min:b.min.toArray(),max:b.max.toArray()},triangles:g.attributes.position.count/3,data:g.toJSON()};
});

const output=path.resolve(base,'../../../props');
const reg=f=>`// 自動生成: node tools/nature/cliff-family/build-cliff-family.cjs\nTDProps.add({id:${JSON.stringify(f.id)},name:${JSON.stringify(f.name)},r:${f.role[0]==='T'?'0':'.5'},min:1,sc:[.9,1.2],slope:9,vis:1.25,anyGround:true,shape:true,tags:['common'],height:${f.bounds.max[1]},material:'rock',build(){return new THREE.BufferGeometryLoader().parse(${JSON.stringify(f.data)});}});\n`;
for(const f of family)fs.writeFileSync(path.join(output,f.id+'.js'),reg(f));
console.log(JSON.stringify(family.map(({id,triangles,dimensions})=>({id,triangles,dimensions}))));
