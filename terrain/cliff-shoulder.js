// Continuous, locally refined cliff shoulders. The editable grid remains the source.
(() => {
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function cubic(a,b,c,d,t){
 const ab=b-a,bc=c-b,cd=d-c,grad=(u,v)=>u*v<=0?0:2*u*v/(u+v),m0=grad(ab,bc),m1=grad(bc,cd),t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*b+(t3-2*t2+t)*m0+(-2*t3+3*t2)*c+(t3-t2)*m1;
}
function build(source,n,cell,options={}){
 const p=source.attributes.position,half=(n-1)*cell/2,maxDelta=options.maxDelta??.15,mask=options.mask||(()=>1),attrs=source.attributes;
 const H=(i,j)=>p.getY(clamp(j,0,n-1)*n+clamp(i,0,n-1));
 const at=(x,z)=>{const fx=clamp((x+half)/cell,0,n-1),fz=clamp((z+half)/cell,0,n-1),i=Math.min(n-2,Math.floor(fx)),j=Math.min(n-2,Math.floor(fz)),u=fx-i,v=fz-j;
 const rows=[];for(let k=-1;k<=2;k++)rows.push(cubic(H(i-1,j+k),H(i,j+k),H(i+1,j+k),H(i+2,j+k),u));
 const smooth=cubic(...rows,v),linear=(H(i,j)*(1-u)+H(i+1,j)*u)*(1-v)+(H(i,j+1)*(1-u)+H(i+1,j+1)*u)*v;
 return linear+clamp(smooth-linear,-maxDelta,maxDelta)*mask(x,z);};
 // One continuous slope field controls grass/rock coverage. Relief normals light the stone only.
 const frame=(x,z)=>{const e=cell*.5,dx=(at(x+e,z)-at(x-e,z))/(2*e),dz=(at(x,z+e)-at(x,z-e))/(2*e),l=Math.hypot(dx,1,dz);return[-dx/l,1/l,-dz/l];};
 const M=n-1,core=new Uint8Array(M*M),fine=new Uint8Array(M*M);let refined=0;
 for(let j=0;j<M;j++)for(let i=0;i<M;i++){const a=[H(i,j),H(i+1,j),H(i,j+1),H(i+1,j+1)];if(Math.max(...a)-Math.min(...a)>.20)core[j*M+i]=1;}
 for(let j=0;j<M;j++)for(let i=0;i<M;i++){for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(i+dx>=0&&i+dx<M&&j+dz>=0&&j+dz<M&&core[(j+dz)*M+i+dx])fine[j*M+i]=1;if(fine[j*M+i])refined++;}
 const steps=refined>18000?1:refined>4000?2:4;
 const arrays={},sizes={};for(const [key,a]of Object.entries(attrs)){sizes[key]=a.itemSize;arrays[key]=[];}if(!arrays.reliefSlope){arrays.reliefSlope=[];sizes.reliefSlope=1;}
 const positions=arrays.position,normals=arrays.normal,ix=[],cache=new Map();let delta=0;
 function vertex(gx,gz){const key=gx+','+gz;if(cache.has(key))return cache.get(key);const fx=gx/steps,fz=gz/steps,i=Math.min(M-1,Math.floor(fx)),j=Math.min(M-1,Math.floor(fz)),u=fx-i,v=fz-j,x=fx*cell-half,z=fz*cell-half,id=positions.length/3,y=at(x,z),no=frame(x,z);cache.set(key,id);positions.push(x,y,z);normals.push(...no);arrays.reliefSlope.push(1-no[1]);
 const linear=(H(i,j)*(1-u)+H(i+1,j)*u)*(1-v)+(H(i,j+1)*(1-u)+H(i+1,j+1)*u)*v;delta=Math.max(delta,Math.abs(y-linear));
 for(const [key,a]of Object.entries(attrs)){if(['position','normal','reliefSlope'].includes(key))continue;for(let k=0;k<a.itemSize;k++)arrays[key].push((a.array[(j*n+i)*a.itemSize+k]*(1-u)+a.array[(j*n+i+1)*a.itemSize+k]*u)*(1-v)+(a.array[((j+1)*n+i)*a.itemSize+k]*(1-u)+a.array[((j+1)*n+i+1)*a.itemSize+k]*u)*v);}
 return id;}
 const isFine=(i,j)=>i>=0&&j>=0&&i<M&&j<M&&fine[j*M+i];
 for(let j=0;j<M;j++)for(let i=0;i<M;i++){
  const x=i*steps,z=j*steps;
  if(fine[j*M+i]){for(let dz=0;dz<steps;dz++)for(let dx=0;dx<steps;dx++){const a=vertex(x+dx,z+dz),b=vertex(x+dx+1,z+dz),c=vertex(x+dx,z+dz+1),d=vertex(x+dx+1,z+dz+1);ix.push(a,c,b,b,c,d);}}
  else {
   const near=[isFine(i-1,j),isFine(i,j+1),isFine(i+1,j),isFine(i,j-1)];
   if(!near.some(Boolean)){const a=vertex(x,z),b=vertex(x+steps,z),c=vertex(x,z+steps),d=vertex(x+steps,z+steps);ix.push(a,c,b,b,c,d);}
   else {const ring=[],edge=(ax,az,bx,bz,split)=>{const count=split?steps:1;for(let k=0;k<count;k++)ring.push(vertex(x+ax+(bx-ax)*k/count,z+az+(bz-az)*k/count));};edge(0,0,0,steps,near[0]);edge(0,steps,steps,steps,near[1]);edge(steps,steps,steps,0,near[2]);edge(steps,0,0,0,near[3]);const c=vertex(x+steps/2,z+steps/2);for(let k=0;k<ring.length;k++)ix.push(c,ring[k],ring[(k+1)%ring.length]);}
  }
 }
 const g=new THREE.BufferGeometry();for(const key of Object.keys(arrays))g.setAttribute(key,new THREE.Float32BufferAttribute(arrays[key],sizes[key]));g.setIndex(ix);g.computeBoundingBox();g.computeBoundingSphere();g.userData={refinedCells:refined,totalCells:M*M,subdivision:steps,triangles:ix.length/3,maxHeightDelta:delta,sourceUnchanged:true};return g;
}
function exportMesh(g,half,yZero){
 const out=TDCliffRelief.exportMesh(g,half,yZero);out.format='tdj-terrain-visual-mesh';out.role='Replace terrain renderer only; retain heightmap collider and walking data';
 out.splatA=Array.from(g.attributes.splatA.array);out.splatB=Array.from(g.attributes.splatB.array);out.splatC=Array.from(g.attributes.splatC.array);out.cliffCoverageSlope=Array.from(g.attributes.reliefSlope.array);return out;
}
window.TDCliffShoulder={build,exportMesh};
})();
