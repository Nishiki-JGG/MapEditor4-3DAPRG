// 洞窟の基本壁だけの描画補正。元形状・衝突・加工岩の確定データは変更しない。
(() => {
const cache=new WeakMap();
function parts(g){const p=g.attributes.position,n=(g.index?.count??p.count)/3,parent=Array.from({length:n},(_,i)=>i),seen=new Map(),vertex=t=>g.index?g.index.getX(t):t;
 const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(let t=0;t<n;t++)for(let j=0;j<3;j++){const k=vertex(t*3+j),key=[p.getX(k),p.getY(k),p.getZ(k)].map(v=>Math.round(v*1e5)).join(',');if(seen.has(key))parent[find(t)]=find(seen.get(key));else seen.set(key,t);}
 const groups=new Map();for(let t=0;t<n;t++){const r=find(t);if(!groups.has(r))groups.set(r,{triangles:[],vertices:new Set(),min:Infinity,max:-Infinity});const c=groups.get(r);c.triangles.push(t);for(let j=0;j<3;j++){const k=vertex(t*3+j);c.vertices.add(k);c.min=Math.min(c.min,p.getY(k));c.max=Math.max(c.max,p.getY(k));}}
 return[...groups.values()];
}
function geometry(g,id){if(id!=='cliff')return g;if(cache.has(g))return cache.get(g);if(!g.boundingBox)g.computeBoundingBox();const bottom=g.boundingBox.min.y,height=g.boundingBox.max.y-bottom,components=parts(g),removed=components.filter(c=>c.min>bottom+height*.62&&c.max-c.min<height*.25);
 if(!removed.length){cache.set(g,g);return g;}
 const excluded=new Set(removed.flatMap(c=>c.triangles)),kept=components.filter(c=>!removed.includes(c)),top=Math.max(...kept.map(c=>c.max)),scale=height/(top-bottom),out=g.clone(),p=out.attributes.position,n=out.attributes.normal,indices=[];
 // 薄片を主岩へ無理に押し込まず、主岩の連続した輪郭を元の高さまで伸ばす。
 for(const c of kept)for(const k of c.vertices){p.setY(k,bottom+(p.getY(k)-bottom)*scale);if(n){const v=new THREE.Vector3(n.getX(k),n.getY(k)/scale,n.getZ(k)).normalize();n.setXYZ(k,v.x,v.y,v.z);}}
 for(let t=0;t<(g.index?.count??p.count)/3;t++)if(!excluded.has(t))for(let j=0;j<3;j++)indices.push(g.index?g.index.getX(t*3+j):t*3+j);
 const used=[...new Set(indices)],remap=new Map(used.map((v,i)=>[v,i])),compact=new THREE.BufferGeometry();
 for(const[name,a]of Object.entries(out.attributes)){if(a.isInstancedBufferAttribute){compact.setAttribute(name,g.attributes[name]);continue;}const array=new a.array.constructor(used.length*a.itemSize);for(let i=0;i<used.length;i++)for(let k=0;k<a.itemSize;k++)array[i*a.itemSize+k]=a.array[used[i]*a.itemSize+k];compact.setAttribute(name,new THREE.BufferAttribute(array,a.itemSize,a.normalized));}
 compact.setIndex(indices.map(i=>remap.get(i)));out.dispose();compact.computeBoundingBox();compact.computeBoundingSphere();compact.userData.caveWall={removedTriangles:excluded.size,sourceTriangles:(g.index?.count??p.count)/3,renderTriangles:indices.length/3,scaleY:scale};cache.set(g,compact);g.addEventListener('dispose',()=>{compact.dispose();cache.delete(g);});return compact;
}
function meshData(g){const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,uv=g.attributes.uv,P=[],N=[],C=[],U=[],I=[];for(let i=0;i<p.count;i++){P.push(p.getX(i),p.getY(i),-p.getZ(i));N.push(n.getX(i),n.getY(i),-n.getZ(i));C.push(c?.getX(i)??1,c?.getY(i)??1,c?.getZ(i)??1);U.push(uv?.getX(i)??0,uv?.getY(i)??0);}for(let i=0;i<(g.index?.count??p.count);i+=3){const a=g.index?g.index.getX(i):i,b=g.index?g.index.getX(i+1):i+1,c=g.index?g.index.getX(i+2):i+2;I.push(a,c,b);}return{positions:P,normals:N,colors:C,uvs:U,triangles:I};}
function exportData(ctx){const models=new Map(),instances=[],flip=new THREE.Matrix4().makeScale(1,1,-1),offset=new THREE.Matrix4().makeTranslation(ctx.half,-ctx.yZero,ctx.half);
 for(const p of ctx.props){const type=ctx.types[p[0]];if(type.id!=='cliff')continue;const record=ctx.fits.valid(p)?ctx.fits.records.get(p[8]):null,base=record&&!record.affine?ctx.fits.get(p).geometry:type.geo,render=geometry(base,type.id);if(render===base)continue;const key=record&&!record.affine?'fit:'+p[8]:type.id;
  if(!models.has(key))models.set(key,{id:key,type:type.id,sourceSha256:ctx.fits.sourceHash(p[0]),render:meshData(render)});
  const m=new THREE.Matrix4().compose(new THREE.Vector3(p[1],ctx.baseY(p),p[2]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p[3]),new THREE.Vector3(p[4],p[4]*(p[6]??1),p[4]));if(record?.affine)m.multiply(new THREE.Matrix4().fromArray(record.affine));m.premultiply(flip).multiply(flip).premultiply(offset);
  instances.push({instanceId:p[8],type:type.id,model:key,fitted:!!record,matrix:Array.from(m.elements),instanceTint:ctx.tint(p),replaceCollider:false});
 }
 return{format:'cave-wall-visuals',formatVersion:1,models:[...models.values()],instances};
}
window.TDCaveWall={enabled:true,geometry,exportData};
})();
