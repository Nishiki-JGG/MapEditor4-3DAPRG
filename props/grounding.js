// 地表の小さな剛体だけに使う。木・建物・既存の根元変形には適用しない。
(()=>{'use strict';
const up=new THREE.Vector3(0,1,0),partsCache=new WeakMap();
function parts(geometry){
 if(partsCache.has(geometry))return partsCache.get(geometry);
 const list=(geometry.userData.groundParts||[]).map(d=>{
  const g=new THREE.BufferGeometry(),pivot=new THREE.Vector3(...d.pivot);
  for(const[name,a]of Object.entries(geometry.attributes)){const array=a.array.slice(d.first*a.itemSize,(d.first+d.count)*a.itemSize);g.setAttribute(name,new THREE.BufferAttribute(array,a.itemSize,a.normalized));}
  const p=g.attributes.position;let y=Infinity;for(let i=0;i<p.count;i++)y=Math.min(y,p.getY(i));pivot.y=y;
  for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)-pivot.x,p.getY(i)-pivot.y,p.getZ(i)-pivot.z);
  const support=[],seen=new Set(),add=(x,z)=>{const key=x.toFixed(6)+'/'+z.toFixed(6);if(!seen.has(key)){seen.add(key);support.push(new THREE.Vector3(x,0,z));}};
  add(0,0);for(let i=0;i<p.count;i++)if(p.getY(i)<1e-5)add(p.getX(i),p.getZ(i));
  for(let i=0;i<p.count;i+=3)if([i,i+1,i+2].every(k=>p.getY(k)<1e-5)){add((p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3);for(let k=0;k<3;k++){const a=i+k,b=i+(k+1)%3;add((p.getX(a)+p.getX(b))/2,(p.getZ(a)+p.getZ(b))/2);}}
  if(support.length<3)throw Error('接地用の支持点が足りません');g.computeBoundingBox();g.computeBoundingSphere();
  return{id:d.id,joint:d.joint,pivot,geometry:g,support};
 });partsCache.set(geometry,list);return list;
}
// PlaneGeometryと同じ対角線。双線形補間との差で薄い小物が地面へ入らないようにする。
function surface(H,N,cell,half,x,z){const fx=Math.max(0,Math.min(N-1-1e-8,(x+half)/cell)),fz=Math.max(0,Math.min(N-1-1e-8,(z+half)/cell)),i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,k=j*N+i;
 return u+v<=1?H[k]+u*(H[k+1]-H[k])+v*(H[k+N]-H[k]):H[k+N+1]+(1-u)*(H[k+N]-H[k+N+1])+(1-v)*(H[k+1]-H[k+N+1]);
}
function fit(part,p,sample,sink=.001){
 const s=p[4],sy=s*(p[6]??1),yaw=new THREE.Quaternion().setFromAxisAngle(up,p[3]),center=part.pivot.clone().multiply(new THREE.Vector3(s,sy,s)).applyQuaternion(yaw);center.x+=p[1];center.z+=p[2];
 if(p[7]!=null){center.y+=p[7];return new THREE.Matrix4().compose(center,yaw,new THREE.Vector3(s,sy,s));}
 let rotation=yaw.clone();
 // 2回だけ支持面を当てはめる。傾けた後のXZ投影も確認し、各物体の形は変形させない。
 for(let pass=0;pass<2;pass++){
  const points=part.support.map(v=>{const w=v.clone().multiplyScalar(s).applyQuaternion(rotation);return[w.x,w.z,sample(center.x+w.x,center.z+w.z)];});
  const mean=points.reduce((a,v)=>a.map((x,i)=>x+v[i]/points.length),[0,0,0]);let xx=0,zz=0,xz=0,xh=0,zh=0;
  for(const v of points){const x=v[0]-mean[0],z=v[1]-mean[1],h=v[2]-mean[2];xx+=x*x;zz+=z*z;xz+=x*z;xh+=x*h;zh+=z*h;}
  const det=xx*zz-xz*xz;if(det<1e-12)break;const gx=(xh*zz-zh*xz)/det,gz=(zh*xx-xh*xz)/det,normal=new THREE.Vector3(-gx,1,-gz).normalize();
  rotation=new THREE.Quaternion().setFromUnitVectors(up,normal).multiply(yaw);
 }
 let y=-Infinity;for(const v of part.support){const w=v.clone().multiplyScalar(s).applyQuaternion(rotation);y=Math.max(y,sample(center.x+w.x,center.z+w.z)-w.y);}
 center.y=y-sink;return new THREE.Matrix4().compose(center,rotation,new THREE.Vector3(s,sy,s));
}
function fitParts(geometry,p,sample,sink=.001){
 const list=parts(geometry),matrices=list.map(part=>fit(part,p,sample,sink)),heights=new Map();
 // ヒトデの腕は傾斜へ沿わせても付け根を離さない。各支持面の高い側へ揃えて埋没を避ける。
 list.forEach((part,i)=>{if(part.joint)heights.set(part.joint,Math.max(heights.get(part.joint)??-Infinity,matrices[i].elements[13]));});
 list.forEach((part,i)=>{if(part.joint)matrices[i].elements[13]=heights.get(part.joint);});for(const joint of geometry.userData.rigidGroundJoints||[]){const group=list.filter(p=>p.joint===joint);if(!group.length)continue;const whole={pivot:group[0].pivot,support:group.flatMap(p=>p.support)};const m=fit(whole,p,sample,sink);list.forEach((part,i)=>{if(part.joint===joint)matrices[i]=m.clone();});}return matrices;
}
function createCache(H,N,cell,half){
 const versions=new Uint32Array(N*N),cache=new WeakMap(),stats={fits:0,hits:0,samples:0};
 const sample=(x,z)=>{stats.samples++;return surface(H,N,cell,half,x,z);};
 function get(p,geometry,sink=.001){const pose=[p[1],p[2],p[3],p[4],p[6]??1,p[7]??null,sink].join('/'),old=cache.get(p);
  if(old?.pose===pose&&old.geometry===geometry&&old.cells.every(([i,v])=>versions[i]===v)){stats.hits++;return old;}
  if(!geometry.boundingSphere)geometry.computeBoundingSphere();const r=(geometry.boundingSphere.radius+geometry.boundingSphere.center.length())*p[4]*Math.max(1,p[6]??1)+cell,cells=[];
  const ix=x=>Math.max(0,Math.min(N-1,Math.floor((x+half)/cell)));
  if(p[7]==null)for(let j=ix(p[2]-r);j<=ix(p[2]+r)+1&&j<N;j++)for(let i=ix(p[1]-r);i<=ix(p[1]+r)+1&&i<N;i++){const k=j*N+i;cells.push([k,versions[k]]);}
  const result={pose,geometry,cells,matrices:fitParts(geometry,p,sample,sink)};cache.set(p,result);stats.fits++;return result;
 }
 return{get,stats,changed:k=>{versions[k]++;}};
}
function exportAsset(type){return{id:type.id,assetKey:type.assetKey,...(type.id==='shells'&&type.surface?{surface:TDSmallPropSurface.export(type.surface)}:{}),parts:parts(type.geo).map(p=>{const g=p.geometry,P=g.attributes.position,N=g.attributes.normal,C=g.attributes.color,positions=[],normals=[],triangles=[];for(let i=0;i<P.count;i++){positions.push(P.getX(i),P.getY(i),-P.getZ(i));normals.push(N.getX(i),N.getY(i),-N.getZ(i));}for(let i=0;i<P.count;i+=3)triangles.push(i,i+2,i+1);return{id:p.id,positions,normals,colors:Array.from(C.array),triangles,...(type.id==='shells'&&type.surface?{uv:Array.from(g.attributes.uv.array)}:{})};})};}
function exportPose(matrix,offset=new THREE.Vector3()){const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);return{position:[p.x+offset.x,p.y+offset.y,-p.z+offset.z],rotation:[-q.x,-q.y,q.z,q.w],scale:s.toArray()};}
window.TDPropGrounding={parts,surface,fit,fitParts,createCache,exportAsset,exportPose};
})();
