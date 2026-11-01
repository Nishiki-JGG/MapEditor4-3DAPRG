// Continuous, locally refined cliff shoulders. The editable grid remains the source.
(() => {
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function cubic(a,b,c,d,t){
 const ab=b-a,bc=c-b,cd=d-c,grad=(u,v)=>u*v<=0?0:2*u*v/(u+v),m0=grad(ab,bc),m1=grad(bc,cd),t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*b+(t3-2*t2+t)*m0+(-2*t3+3*t2)*c+(t3-t2)*m1;
}
const SHORE_IN=.16,SHORE_OUT=.45,SHORE_LIFT=.04,SHORE_SLOPE=.25,SHORE_FALL=1.5,SHORE_SIGMA=.75,SHORE_SHIFT=.6;
// Signed distance to the water on the grid (+ on land), softened and kept within SHORE_SHIFT of the original line.
function shoreField(n,cell,H,level){
 if(!Number.isFinite(level))return null;
 const N=n*n,wet=new Uint8Array(N);let nw=0;for(let j=0;j<n;j++)for(let i=0;i<n;i++)if(H(i,j)<level-.005){wet[j*n+i]=1;nw++;}
 if(!nw||nw===N)return null;
 const INF=1e9,toLand=new Float32Array(N).fill(INF),toWater=new Float32Array(N).fill(INF),R=Math.SQRT2;
 for(let k=0;k<N;k++)if(wet[k])toWater[k]=0;else toLand[k]=0;
 const pass=a=>{for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i;if(i)a[k]=Math.min(a[k],a[k-1]+1);if(j){a[k]=Math.min(a[k],a[k-n]+1);if(i)a[k]=Math.min(a[k],a[k-n-1]+R);if(i<n-1)a[k]=Math.min(a[k],a[k-n+1]+R);}}
  for(let j=n-1;j>=0;j--)for(let i=n-1;i>=0;i--){const k=j*n+i;if(i<n-1)a[k]=Math.min(a[k],a[k+1]+1);if(j<n-1){a[k]=Math.min(a[k],a[k+n]+1);if(i<n-1)a[k]=Math.min(a[k],a[k+n+1]+R);if(i)a[k]=Math.min(a[k],a[k+n-1]+R);}}};
 pass(toLand);pass(toWater);
 const sd=new Float32Array(N);for(let k=0;k<N;k++)sd[k]=wet[k]?-(toLand[k]-.5)*cell:(toWater[k]-.5)*cell;
 const sigma=SHORE_SIGMA/cell,rad=Math.ceil(sigma*3),w=[];for(let d=-rad;d<=rad;d++)w.push(Math.exp(-d*d/(2*sigma*sigma)));const ws=w.reduce((a,b)=>a+b);
 const tmp=new Float32Array(N),phi=new Float32Array(N);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){let v=0;for(let d=-rad;d<=rad;d++)v+=sd[j*n+clamp(i+d,0,n-1)]*w[d+rad];tmp[j*n+i]=v/ws;}
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){let v=0;for(let d=-rad;d<=rad;d++)v+=tmp[clamp(j+d,0,n-1)*n+i]*w[d+rad];const k=j*n+i;const softened=clamp(v/ws,sd[k]-SHORE_SHIFT,sd[k]+SHORE_SHIFT);phi[k]=wet[k]?Math.min(-cell*.25,softened):Math.max(cell*.25,softened);}
 // Keep one-cell streams, islands and land bridges at their authored depths/heights.
 const thin=new Uint8Array(N),same=(i,j,k)=>i<0||j<0||i>=n||j>=n||wet[j*n+i]===wet[k];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i;thin[k]=(!same(i-1,j,k)&&!same(i+1,j,k))||(!same(i,j-1,k)&&!same(i,j+1,k))?1:0;}
 const protection=(i,j,u,v)=>(thin[j*n+i]*(1-u)+thin[j*n+i+1]*u)*(1-v)+(thin[(j+1)*n+i]*(1-u)+thin[(j+1)*n+i+1]*u)*v;
 const range=(i,j)=>{let mn=Infinity,mx=-Infinity;for(let b=-1;b<=2;b++)for(let a=-1;a<=2;a++){const h=H(i+a,j+b);if(h<mn)mn=h;if(h>mx)mx=h;}return{min:mn,span:mx-mn};};
 return{phi,range,protection};
}
function build(source,n,cell,options={}){
 const p=source.attributes.position,half=(n-1)*cell/2,maxDelta=options.maxDelta??.15,mask=options.mask||(()=>1),attrs=source.attributes;
 const H=(i,j)=>p.getY(clamp(j,0,n-1)*n+clamp(i,0,n-1));
 // Remove the grid-frequency zigzag before interpolation, with a bounded visual-only
 // correction. A cubic through the unfiltered grid preserves every stair-step corner.
 const filtered=new Float32Array(n*n);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){let sum=0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)sum+=H(i+dx,j+dz)*(dx===0?2:1)*(dz===0?2:1);filtered[j*n+i]=H(i,j)+(sum/16-H(i,j))*.65;}
 const Q=(i,j)=>filtered[clamp(j,0,n-1)*n+clamp(i,0,n-1)];
 // The waterline itself, visual only: on a steep bank one grid cell holds the whole drop, so the contour
 // can only follow the grid's stairs and the bounded height correction above cannot move it. Take the
 // signed distance to the water from the grid, soften it, and let the surface cross the water level there.
 const shore=shoreField(n,cell,H,options.waterLevel);
 const shoreMask=options.shoreMask||mask;   // fitted rocks stop the height correction above, but not the waterline
 const shoreY=(x,z,y,fx,fz)=>{const i=Math.min(n-2,Math.floor(fx)),j=Math.min(n-2,Math.floor(fz)),u=fx-i,v=fz-j,f=shore.phi;
  const strength=1-shore.protection(i,j,u,v);if(strength<=0)return y;
  const rows=[];for(let k=-1;k<=2;k++){const r=clamp(j+k,0,n-1)*n,I=q=>f[r+clamp(q,0,n-1)];rows.push(cubic(I(i-1),I(i),I(i+1),I(i+2),u));}
  const phi=cubic(...rows,v),d=Math.abs(phi);if(d>=SHORE_OUT)return y;
  const W=options.waterLevel,R=shore.range(i,j),lift=Math.min(SHORE_LIFT,.5*R.span);
  const target=phi>=0?W+Math.min(phi*SHORE_SLOPE,lift):Math.max(R.min,W-Math.min(d*SHORE_SLOPE,lift)-Math.max(0,d-SHORE_IN)*SHORE_FALL);
  if(d<=SHORE_IN)return y+(target-y)*strength;
  const t=(d-SHORE_IN)/(SHORE_OUT-SHORE_IN),w=t*t*(3-2*t);return y+(target-y)*(1-w)*strength;};
 const at=(x,z)=>{const fx=clamp((x+half)/cell,0,n-1),fz=clamp((z+half)/cell,0,n-1),i=Math.min(n-2,Math.floor(fx)),j=Math.min(n-2,Math.floor(fz)),u=fx-i,v=fz-j;
 const rows=[];for(let k=-1;k<=2;k++)rows.push(cubic(Q(i-1,j+k),Q(i,j+k),Q(i+1,j+k),Q(i+2,j+k),u));
 const smooth=cubic(...rows,v),linear=(H(i,j)*(1-u)+H(i+1,j)*u)*(1-v)+(H(i,j+1)*(1-u)+H(i+1,j+1)*u)*v;
 const y=linear+clamp(smooth-linear,-maxDelta,maxDelta)*mask(x,z);return shore?y+(shoreY(x,z,y,fx,fz)-y)*shoreMask(x,z):y;};
 // One continuous slope field controls grass/rock coverage. Relief normals light the stone only.
 const frame=(x,z)=>{const e=cell*.5,dx=(at(x+e,z)-at(x-e,z))/(2*e),dz=(at(x,z+e)-at(x,z-e))/(2*e),l=Math.hypot(dx,1,dz);return[-dx/l,1/l,-dz/l];};
 const M=n-1,core=new Uint8Array(M*M),fine=new Uint8Array(M*M);let refined=0;
 for(let j=0;j<M;j++)for(let i=0;i<M;i++){const a=[H(i,j),H(i+1,j),H(i,j+1),H(i+1,j+1)];if((shore&&Math.min(Math.abs(shore.phi[j*n+i]),Math.abs(shore.phi[j*n+i+1]),Math.abs(shore.phi[(j+1)*n+i]),Math.abs(shore.phi[(j+1)*n+i+1]))<SHORE_OUT)||Math.max(...a)-Math.min(...a)>.20||(Number.isFinite(options.waterLevel)&&Math.min(...a)<options.waterLevel+.16&&Math.max(...a)>options.waterLevel-.16&&Math.max(...a)-Math.min(...a)>.00001))core[j*M+i]=1;}
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
 out.splatA=Array.from(g.attributes.splatA.array);out.splatB=Array.from(g.attributes.splatB.array);
 const c=g.attributes.splatC;out.splatC=Array.from({length:c.count},(_,i)=>c.getX(i));
 if(c.itemSize>1){const bedrock=Array.from({length:c.count},(_,i)=>c.getY(i));if(bedrock.some(v=>v>0))out.bedrock=bedrock;}
 if(c.itemSize>2){const black=Array.from({length:c.count},(_,i)=>c.getZ(i));if(black.some(v=>v>0))out.pureblack=black;}
 out.cliffCoverageSlope=Array.from(g.attributes.reliefSlope.array);return out;
}
window.TDCliffShoulder={surfaceVersion:2,build,exportMesh};
})();
