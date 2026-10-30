// 独立配置用の崩落壁。残壁、対応する板状破断塊、少数の根元片を一つの共有メッシュにする。
window.TDMineCollapse=(()=>{
 'use strict';
 const id='mine_collapsed_wall',spec={version:1,width:2.32,height:1.78,depth:2.28,backEmbed:.45,usage:'wall-side collapsed obstruction, no traversable opening'};let textureSet,shared;
 const clamp=x=>Math.max(0,Math.min(1,x)),noise=(x,y)=>{const q=Math.sin(x*127.1+y*311.7)*43758.5453;return q-Math.floor(q)};
 // Two major joint planes meet once at an oblique shoulder; no repeated narrow stair bands.
 const jointKnot=.12,ledges=[[-3,0],[jointKnot,0],[3,.60*(3-jointKnot)]];
 function fractureLift(x,z){return .60*Math.max(0,x+.15*z-jointKnot);}
 function sample(u,v,fresh){let x=u*3,y=v*2.2,spall=0;if(fresh){const px=((u-.05)/.9-.5)*2.5,pz=(v-.05)/.9*1.2-.6,py=1.38-.75*px+.04*pz+fractureLift(px,pz);x=3*(.05+.9*(.48+px*.22+pz*.055));y=2.2*(.04+.92*py/1.85);spall=Math.exp(-Math.pow((px+.15*pz-jointKnot)/.16,2))*clamp((pz+.42)/.70);}const cloud=Math.sin(x*4.1+Math.sin(y*3.2))*.55+Math.sin(y*7.7-x*2.3)*.24+Math.sin(x*14+y*9)*.12;
 const strata=y*4.1+x*.7+.55*Math.sin(x*2.5)+.28*Math.sin(y*3.1),seam=Math.pow(Math.max(0,Math.cos(strata)),22)*(.25+.75*clamp(Math.sin(x*4-y*2)*2+.7));
 const grains=noise(Math.floor(u*256),Math.floor(v*256))-.5,vein=Math.pow(Math.max(0,Math.sin(x*9-y*3+Math.sin(y*4))),22)*.8;
 const cracks=[[.10,.18,.35,.47],[.35,.47,.42,.82],[.35,.47,.69,.57],[.72,.15,.81,.38],[.17,.80,.28,.91]];let cut=0;for(const [ax,ay,bx,by] of cracks){const dx=bx-ax,dy=by-ay,t=clamp(((u-ax)*dx+(v-ay)*dy)/(dx*dx+dy*dy)),d=Math.hypot(u-ax-t*dx,v-ay-t*dy);cut=Math.max(cut,Math.exp(-d*d/.000012)*(Math.sin(t*Math.PI)*.7+.3));}let first=100,second=100,label=0;const gx=u*3.4,gy=v*3.1;for(let iy=Math.floor(gy)-1;iy<=Math.floor(gy)+1;iy++)for(let ix=Math.floor(gx)-1;ix<=Math.floor(gx)+1;ix++){const dx=gx-ix-.1-.8*noise(ix+7,iy),dy=gy-iy-.1-.8*noise(ix,iy+4),d=dx*dx+dy*dy;if(d<first){second=first;first=d;label=noise(ix+9,iy+15);}else second=Math.min(second,d);}const joint=Math.exp(-(second-first)*55)*(fresh?.25:.8),domain=(label-.5)*(fresh?12:18);
 const base=(fresh?128:110)+domain-joint*7+cloud*(fresh?10:14)+spall*(8+Math.sin(x*11-y*4)*4)+grains*5-seam*3.5+vein*4-cut*10;
 return{h:cloud*(fresh?.005:.010)+grains*.00035-seam*.0009-cut*.003-joint*.003+spall*.003*Math.sin(x*17+Math.sin(y*7)),colour:fresh?[base,base+1,base+1]:[base+3,base+2,base-3],ao:1-seam*.05,smooth:fresh?.19:.11};}
 function maps(){if(textureSet)return textureSet;const w=512,h=256,colour=new Uint8Array(w*h*4),packed=new Uint8Array(w*h*4),normal=new Uint8Array(w*h*4),height=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=sample((x%256)/255,y/255,x>=256),i=(y*w+x)*4;for(let c=0;c<3;c++)colour[i+c]=Math.round(q.colour[c]);colour[i+3]=255;packed[i]=0;packed[i+1]=Math.round(q.ao*255);packed[i+2]=0;packed[i+3]=Math.round(q.smooth*255);height[y*w+x]=q.h;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,x0=x<256?0:256,x1=x0+255,dx=(height[y*w+Math.min(x1,x+1)]-height[y*w+Math.max(x0,x-1)])*256/6,dy=(height[Math.min(h-1,y+1)*w+x]-height[Math.max(0,y-1)*w+x])*256/4.4,l=Math.hypot(dx,dy,1);normal[i]=Math.round((.5-dx*.5/l)*255);normal[i+1]=Math.round((.5-dy*.5/l)*255);normal[i+2]=Math.round((.5+.5/l)*255);normal[i+3]=255;}
 const tex=(b,srgb)=>{const t=new THREE.DataTexture(b,w,h);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=2;t.needsUpdate=true;return t;},mr=new Uint8Array(packed);for(let i=0;i<mr.length;i+=4){mr[i]=packed[i+1];mr[i+1]=255-packed[i+3];mr[i+2]=0;}const data=tex(mr,false);textureSet={w,h,colour,packed,normal,map:tex(colour,true),metalRough:data,normalMap:tex(normal,false),aoMap:data,status:"loading",error:null};textureSet.ready=installPBR(textureSet);return textureSet;}

 // Inline lossless payload works offline. Decode atomically into the existing shared
 // buffers so preview clones and placed instances cannot retain stale fallback maps.
 async function installPBR(t){let reader;try{
  const d=window.TDMineCollapsePBR;if(!d){t.status='fallback';return;}
  if(d.version!==1||d.width!==512||d.height!==256||d.bytes!==1572864||typeof d.gzip!=='string'||d.gzip.length>2200000)throw Error('rock PBR header/bounds');
  if(typeof DecompressionStream!=='function')throw Error('rock PBR decompressor unavailable');
  const input=Uint8Array.from(atob(d.gzip),c=>c.charCodeAt(0));
  reader=new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const bytes=new Uint8Array(d.bytes);let used=0;
  for(;;){const {value,done}=await reader.read();if(done)break;if(used+value.length>bytes.length)throw Error('rock PBR expanded bound');bytes.set(value,used);used+=value.length;}
  if(used!==bytes.length)throw Error('rock PBR truncated');
  const size=512*256*4,colour=bytes.subarray(0,size),normal=bytes.subarray(size,size*2),packed=bytes.subarray(size*2);
  for(let i=0;i<size;i+=4){if(colour[i+3]!==255||normal[i+3]!==255||normal[i+2]<128||packed[i]!==0||packed[i+2]!==0)throw Error('rock PBR channels');}
  t.colour.set(colour);t.normal.set(normal);t.packed.set(packed);
  const mr=t.metalRough.image.data;for(let i=0;i<size;i+=4){mr[i]=packed[i+1];mr[i+1]=255-packed[i+3];mr[i+2]=0;mr[i+3]=255;}
  for(const map of [t.map,t.normalMap,t.metalRough])map.needsUpdate=true;t.status='ready';
 }catch(e){t.status='fallback';t.error=String(e.message||e);if(reader)try{await reader.cancel();}catch{}}finally{if(reader)reader.releaseLock();}}
 function prepare(){return maps().ready;}
 function material(){if(!shared){const t=maps();shared=new THREE.MeshStandardMaterial({name:'mine-collapsed-fractured-rock',map:t.map,metalness:0,roughness:1,roughnessMap:t.metalRough,normalMap:t.normalMap,aoMap:t.aoMap,aoMapIntensity:.5});}return shared;}
 function geometry(){const out={position:[],normal:[],uv:[]},V=(x,y,z)=>new THREE.Vector3(x,y,z),eps=1e-6;
 const backZ=(x,y)=>-.50+.05*x+.02*y;
 // A single irregular, volumetric parent rock. The main block is actually clipped from it.
 const source=[[-1.06,0],[-1.12,.61],[-.91,1.31],[-.72,1.78],[.30,1.78],[.91,1.30],[1.10,.50],[1.02,0]].map(([x,y])=>V(x,y,backZ(x,y)));
 source.push(V(-.84,0,.10),V(-.08,0,.32),V(.83,0,.13),V(-1.03,.62,-.02),V(-.82,1.25,.12),V(-.38,1.66,.15),V(.28,1.66,.22),V(.91,1.15,.15),V(1.04,.53,.04),V(-.34,.72,.48),V(.39,.83,.46),V(-.24,1.23,.34));
 function ordered(points,n){const c=points.reduce((a,p)=>a.add(p),V(0,0,0)).multiplyScalar(1/points.length),u=points[0].clone().sub(c).normalize(),v=n.clone().cross(u);return points.slice().sort((a,b)=>Math.atan2(a.clone().sub(c).dot(v),a.clone().sub(c).dot(u))-Math.atan2(b.clone().sub(c).dot(v),b.clone().sub(c).dot(u)));}
 const planes=new Map();for(let i=0;i<source.length;i++)for(let j=i+1;j<source.length;j++)for(let k=j+1;k<source.length;k++){let n=source[j].clone().sub(source[i]).cross(source[k].clone().sub(source[i]));if(n.length()<eps)continue;n.normalize();let d=n.dot(source[i]),dots=source.map(p=>n.dot(p)-d);if(dots.some(v=>v>eps)&&dots.some(v=>v< -eps))continue;if(dots.some(v=>v>eps)){n.negate();d=-d;}const key=[...n.toArray(),d].map(v=>v.toFixed(5)).join(',');if(!planes.has(key)){const points=source.filter(p=>Math.abs(n.dot(p)-d)<eps);planes.set(key,{points:ordered(points,n),n,fresh:false});}}
 // The two halves share a continuous two-plane joint surface.
 // The single shoulder reaches the outer skin and belongs to both corresponding halves.
 const crossings=[],bandAxis=V(1,0,.15);
 function clip(faces,n,d,positive,cap){const result=[],hits=[];
  for(const f of faces){const pts=[];for(let i=0;i<f.points.length;i++){const a=f.points[i],b=f.points[(i+1)%f.points.length],da=n.dot(a)-d,db=n.dot(b)-d,ia=positive?da>=-eps:da<=eps,ib=positive?db>=-eps:db<=eps;if(ia)pts.push(a.clone());if(ia!==ib){const q=a.clone().lerp(b,da/(da-db));pts.push(q);if(!hits.some(v=>v.distanceTo(q)<eps))hits.push(q.clone());}}
   const clean=pts.filter((p,i)=>!i||p.distanceTo(pts[i-1])>eps);if(clean.length>1&&clean[0].distanceTo(clean.at(-1))<eps)clean.pop();if(clean.length>=3)result.push({...f,points:clean});}
  if(hits.length>=3){const normal=positive?n.clone().negate():n.clone();result.push({...cap,points:ordered(hits,normal),n:normal});}return result;
 }
 const knots=ledges,standing=[],detached=[];
 for(let i=0;i<knots.length-1;i++){const [lo,oh]=knots[i],[hi,nh]=knots[i+1],slope=(nh-oh)/(hi-lo),intercept=oh-slope*lo;
  let band=clip([...planes.values()],bandAxis,lo,true,{internal:true});band=clip(band,bandAxis,hi,false,{internal:true});
  const n=V(.75-slope,1,-.04-.15*slope),d=(1.38+intercept)/n.length();n.normalize();
  for(const positive of [false,true]){const faces=clip(band,n,d,positive,{fresh:true});for(const f of faces){if(f.internal)continue;(positive?detached:standing).push(f);if(f.fresh)for(const p of f.points)if(!crossings.some(q=>q.distanceTo(p)<eps))crossings.push(p.clone());}}
 }
 // Only shallow changes of the weathered skin share normals. Fracture ledges stay hard.
 function skinNormals(faces){const normals=new Map(),key=p=>p.toArray().map(x=>x.toFixed(6)).join(',');for(const f of faces)if(!f.fresh)for(const p of f.points){const k=key(p),ns=normals.get(k)||[];if(!ns.some(n=>n.dot(f.n)>.99999))ns.push(f.n);normals.set(k,ns);}for(const f of faces)f.shading=f.points.map(p=>f.fresh?f.n.clone():(normals.get(key(p))||[f.n]).filter(n=>n.dot(f.n)>Math.cos(28*Math.PI/180)).reduce((a,n)=>a.add(n),V(0,0,0)).normalize());}
 skinNormals(standing);skinNormals(detached);
 // Rest the main fallen block on a broad original outer face, with its fracture facing up.
 const supportPoints=[V(.91,1.30,backZ(.91,1.30)),V(.30,1.78,backZ(.30,1.78)),V(.28,1.66,.22)],supportN=supportPoints[1].clone().sub(supportPoints[0]).cross(supportPoints[2].clone().sub(supportPoints[0])).normalize();if(supportN.y<0)supportN.negate();
 const pivot=supportPoints.reduce((a,p)=>a.add(p),V(0,0,0)).multiplyScalar(1/3),q=new THREE.Quaternion().setFromUnitVectors(supportN,V(0,-1,0));q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),-.25));const mainMatrix=new THREE.Matrix4().makeTranslation(.34,0,.92).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
 // Fracture faces use their X/Z plane, avoiding stretched XY projection. Their layer field is sampled back in original rock coordinates.
 const uv=(p,fresh)=>fresh?[.5+(.05+clamp(.5+(.12+(p.x-.12)*(p.x<=.12?1.25:Math.sqrt(1+.15*.15)))/2.5)*.9)*.5,.05+clamp((p.z+.6)/1.2)*.9]:[(.05+clamp(.5+p.x/2.5)*.90)*.5,.04+clamp(p.y/1.85)*.92];
 function emit(f,matrix){const p=f.points.map(p=>p.clone().applyMatrix4(matrix)),n=f.n.clone().transformDirection(matrix);let coords=f.points.map(p=>uv(p,f.fresh));if(!f.fresh&&!f.generic){const a=f.n.clone();if(Math.abs(a.x)>.65)coords=f.points.map(p=>uv(V(p.z,p.y,0),false));else if(Math.abs(a.y)>.65)coords=f.points.map(p=>uv(V(p.x,p.z+.6,0),false));}const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(f.generic||coords.slice(2).some((c,i)=>Math.abs(area(coords[0],coords[i+1],c))<1e-9)){const a=new THREE.Vector3(Math.abs(f.n.x),Math.abs(f.n.y),Math.abs(f.n.z)),axis=a.y>a.x&&a.y>a.z?1:a.x>a.z?0:2,project=p=>axis===1?[p.x,p.z]:axis===0?[p.z,p.y]:[p.x,p.y],q=f.points.map(project),c=q.reduce((a,p)=>[a[0]+p[0]/q.length,a[1]+p[1]/q.length],[0,0]);coords=q.map(v=>[(f.fresh?.5:0)+(.5+(v[0]-c[0])*.28)*.5,.5+(v[1]-c[1])*.28]);}for(let i=1;i<p.length-1;i++){const ids=[0,i,i+1];if(p[i].clone().sub(p[0]).cross(p[i+1].clone().sub(p[0])).dot(n)<0)[ids[1],ids[2]]=[ids[2],ids[1]];const faceNormal=p[ids[1]].clone().sub(p[ids[0]]).cross(p[ids[2]].clone().sub(p[ids[0]])).normalize();for(const j of ids){out.position.push(...p[j].toArray().map(v=>Math.abs(v)<1e-10?0:v));out.normal.push(...(f.fresh?faceNormal:f.shading?f.shading[j].clone().transformDirection(matrix):n).toArray());out.uv.push(...coords[j]);}}}
 const identity=new THREE.Matrix4();standing.forEach(f=>emit(f,identity));detached.forEach(f=>emit(f,mainMatrix));
 function block(x,y,z,s,h,angle){const local=[[-s,0,-s*.42],[s*.63,0,-s*.58],[s,0,s*.43],[-s*.52,0,s*.75],[-s*.64,h*.65,-s*.30],[s*.34,h,-s*.28],[s*.56,h*.56,s*.32],[-s*.41,h*.47,s*.55]],rot=new THREE.Euler(0,angle,0),p=local.map(p=>new THREE.Vector3(...p).applyEuler(rot).add(V(x,y,z))),c=p.reduce((a,p)=>a.add(p),V(0,0,0)).multiplyScalar(1/p.length);
 for(const ids of [[3,2,1,0],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6],[4,6,7]]){let points=ids.map(i=>p[i]),n=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize(),fc=points.reduce((a,p)=>a.add(p),V(0,0,0)).multiplyScalar(1/points.length);if(n.dot(fc.sub(c))<0){points=points.slice().reverse();n.negate();}emit({points,n,fresh:ids[0]!==3,generic:true},identity);}}
 block(-.65,0,.36,.31,.43,-.26);
 for(const p of [[-.87,0,.81,.10,.08,.7],[-.27,0,1.03,.13,.10,-.4],[.74,0,1.15,.09,.085,.2],[-.48,.07,.51,.09,.06,1.3],[.04,0,1.30,.07,.055,-.6]])block(...p);
 const g=new THREE.BufferGeometry();for(const k of Object.keys(out))g.setAttribute(k,new THREE.Float32BufferAttribute(out[k],k==='uv'?2:3));g.setAttribute('uv1',g.attributes.uv.clone());g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(out.position.length).fill(1),3));g.setAttribute('glow',new THREE.Float32BufferAttribute(new Float32Array(out.position.length/3),1));g.setIndex(Array.from({length:out.position.length/3},(_,i)=>i));g.computeBoundingBox();g.computeBoundingSphere();g.userData.fracture={standingCut:crossings.map(p=>p.toArray()),mainMatrix:mainMatrix.toArray(),mainContact:detached.flatMap(f=>f.points).filter(p=>Math.abs(supportN.dot(p.clone().sub(pivot)))<eps).map(p=>p.clone().applyMatrix4(mainMatrix).toArray()),supportFaceNormal:supportN.toArray(),mainBlockRestingOnOriginalOuterFace:true,sourcePoints:source.length,sourceFaces:planes.size,sharedCutPlane:false,sharedSteppedFracture:false,sharedMajorJoint:true,jointKnot:.12,skinSmoothingDegrees:28,continuousRockUV:true,noPerimeterBevel:true};return g;}

 function png(bytes){const t=maps(),c=document.createElement('canvas');c.width=t.w;c.height=t.h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes),t.w,t.h),0,0);return c.toDataURL('image/png').split(',')[1];}
 function exportData(types){const t=maps();return{version:1,units:'metres',axes:'Unity X/Y/Z',textures:{width:t.w,height:t.h,colour:png(t.colour),packed:png(t.packed),normal:png(t.normal)},assets:types.filter(t=>t.id===id&&t.assetKey==='tdj/'+id).map(t=>({id,assetKey:t.assetKey,radius:t.r,height:t.height,shape:!!t.shape,groundSink:0,material:'mineCollapse',...(!t.shape&&t.r>0?{circleColliders:(t.offs||[[0,0]]).map(o=>({center:[o[0],0,-o[1]],radius:t.r,height:t.height}))}:{}),...TDSmallPropExport.geometry(t.geo)}))};}
 TDProps.add({id,name:'崩れた岩壁',r:1.7,height:1.8,groundSink:0,min:2,sc:[1,1],slope:.1,vis:1,anyGround:true,manualOnly:true,shape:true,tags:['cave'],material:'mineCollapse',mineCollapse:true,build:geometry});
 return{id,spec,maps,material,prepare,stats:()=>({status:maps().status,error:maps().error}),export:exportData};
})();
