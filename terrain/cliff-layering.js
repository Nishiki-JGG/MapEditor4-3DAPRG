// 承認された上下重ねの自動配置。確定頂点と等価な配置行列を同時に作る。
(() => {'use strict';
const family=['cliff','cliff_split','cliff_shoulder','cliff_joint'];
function pose(p){return new THREE.Matrix4().compose(new THREE.Vector3(p[1],p[7],p[2]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p[3]),new THREE.Vector3(p[4],p[4]*(p[6]??1),p[4]));}
function quantile(a,q){a.sort((x,y)=>x-y);return a[Math.floor((a.length-1)*q)]??0;}
function row(ctx,surface,original,type,height,width,foot,x,z,yaw,u){
 const T=TDCliffContact,src=ctx.types[type].geo,g=src.clone(),matrix=new THREE.Matrix4();for(const key of Object.keys(g.attributes))if(g.attributes[key].isInstancedBufferAttribute)g.deleteAttribute(key);
 const apply=m=>{g.applyMatrix4(m);matrix.premultiply(m);};g.computeBoundingBox();const b=g.boundingBox.clone();
 apply(new THREE.Matrix4().makeTranslation(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2));
 apply(new THREE.Matrix4().makeScale(width/(b.max.x-b.min.x),height/(b.max.y-b.min.y),original[4]));apply(new THREE.Matrix4().makeRotationY(yaw));
 apply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(u[1],0,-u[0]),12*Math.PI/180));g.computeBoundingBox();const minY=g.boundingBox.min.y,scaleY=height/(g.boundingBox.max.y-minY);
 apply(new THREE.Matrix4().makeTranslation(0,-minY,0));apply(new THREE.Matrix4().makeScale(1,scaleY,1));apply(new THREE.Matrix4().makeTranslation(x,foot,z));
 const measured=T.measure(surface,[type,0,0,0,1,1,1,0],T.samples(g,true),u,[original[1],original[2]]),distances=(measured.gaps||[]).filter(Number.isFinite);
 if(!distances.length){g.dispose();return null;}
 const shift=Math.max(-1.5,Math.min(1.5,quantile(distances,.8)-.04));apply(new THREE.Matrix4().makeTranslation(u[0]*shift,0,u[1]*shift));
 const p=original.slice();p[0]=type;const local=pose(p).invert();g.applyMatrix4(local);matrix.premultiply(local);g.computeBoundingBox();g.computeBoundingSphere();return{p,geometry:g,affine:Array.from(matrix.elements),original,layering:1,shift};
}
function* build(ctx,props){
 const T=TDCliffContact,started=performance.now(),surface=new T.Surface(ctx.geometries),types=family.map(id=>ctx.types.findIndex(t=>t.id===id)),candidates=props.filter(p=>p[5]===1&&family.includes(ctx.types[p[0]].id)&&!ctx.layered?.(p)),data=new Map();
 for(const p of candidates){const g=ctx.types[p[0]].geo;g.computeBoundingBox();const b=g.boundingBox;data.set(p,{u:T.direction(ctx,p),height:(b.max.y-b.min.y)*p[4]*(p[6]??1),foot:p[7]+b.min.y*p[4]*(p[6]??1),width:T.samples(g).width*p[4]});}
 const ordered=[...candidates].sort((a,b)=>Math.sign(data.get(a).u[0])-Math.sign(data.get(b).u[0])||a[2]-b[2]),updates=new Map(),fits=[],records=[];let delivered=false;
 try{for(let i=0;i<ordered.length;i++){
  const p=ordered[i],D=data.get(p),u=D.u,t=[-u[1],u[0]],near=[];
  for(const q of candidates){if(q===p)continue;const E=data.get(q),dx=q[1]-p[1],dz=q[2]-p[2],d=Math.hypot(dx,dz);if(d>4||E.u[0]*u[0]+E.u[1]*u[1]<.65||Math.abs(dx*u[0]+dz*u[1])>1.5||Math.abs(E.foot-D.foot)>Math.max(1,D.height*.5))continue;near.push({q,d,along:dx*t[0]+dz*t[1]});}
  const left=near.filter(q=>q.along<-.3).sort((a,b)=>a.d-b.d)[0],right=near.filter(q=>q.along>.3).sort((a,b)=>a.d-b.d)[0],spacing=Math.max(left?.d||0,right?.d||0,1.6),overlap=.45+(i%4)*.04,h=D.height*1.05/(2-overlap),rise=D.height*1.05-h,width=Math.max(D.width,spacing*1.15),side=left&&right?Math.min(.85,spacing*.38):0,alternatives=types.filter(k=>k>=0&&k!==p[0]),upperType=alternatives[i%alternatives.length];
  const parts=[row(ctx,surface,p,p[0],h,width,D.foot,p[1],p[2],p[3],u),row(ctx,surface,p,upperType,h,width*(1.02+(i%3)*.03),D.foot+rise,p[1]+t[0]*side,p[2]+t[1]*side,p[3]+((i%3)-1)*5*Math.PI/180,u)];
  let constrained=false;if(parts.every(Boolean)&&parts.some(f=>ctx.protected?.(f.p,f.geometry))){for(const f of parts)f.geometry.dispose();const fittedWidth=D.width*1.05;parts.splice(0,2,row(ctx,surface,p,p[0],h,fittedWidth,D.foot,p[1],p[2],p[3],u),row(ctx,surface,p,upperType,h,fittedWidth*1.06,D.foot+rise,p[1],p[2],p[3],u));constrained=true;}
  const reason=parts.some(f=>!f)?'surface-not-found':parts.some(f=>ctx.protected?.(f.p,f.geometry))?'protected-area':null;
  if(reason){for(const f of parts)f?.geometry.dispose();updates.set(p,[p]);records.push({id:p[8],old:p.slice(),ok:false,method:'kept-original',reason});}
  else{parts[1].p[8]=null;updates.set(p,parts.map(f=>f.p));fits.push(...parts);records.push({id:p[8],old:p.slice(),nextParts:parts.map(f=>f.p),ok:true,method:'layered',constrained,tiltDegrees:12,heightMultiplier:1.05,overlap,width,side,upperType:ctx.types[upperType].id});}
  yield i+1;
 }delivered=true;return{props:props.flatMap(p=>updates.get(p)||[p]),fits,stats:{total:records.length,changed:records.filter(r=>r.ok).length,keptOriginal:records.filter(r=>!r.ok).length,unresolved:records.filter(r=>!r.ok).length,records,totalMs:performance.now()-started,mode:'layered-12deg-height105'}};
 }finally{if(!delivered)for(const f of fits)f.geometry.dispose();}
}
async function fitAsync(ctx,props){const it=build(ctx,props);let r,chunk=performance.now(),checked=0;do{if(ctx.valid&&performance.now()-checked>50){checked=performance.now();if(!ctx.valid()){it.return();throw Error('cliff-contact-cancelled');}}r=it.next();if(!r.done&&performance.now()-chunk>12){ctx.progress?.(r.value);await new Promise(resolve=>setTimeout(resolve,0));chunk=performance.now();}}while(!r.done);return r.value;}
window.TDCliffLayering={fitAsync};})();
