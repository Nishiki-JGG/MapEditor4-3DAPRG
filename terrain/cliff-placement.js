// Cliff dressing is sparse, embedded scenery. The terrain supplies the continuous rock face.
(() => {
'use strict';
function generate(c){
 const {size,heightAt:h,water,seed,cliffType,rockType,cliffHeight,cliffDepth,cliffWidth,rockHeight,protectedAt,blockedAt}=c;
 const R=TDGeo.rng(seed|0),half=size/2,points=[],out=[],accents=[],feet=[];
 const gradient=(x,z)=>{const e=.4,gx=(h(x+e,z)-h(x-e,z))/(2*e),gz=(h(x,z+e)-h(x,z-e))/(2*e),s=Math.hypot(gx,gz);return{ux:gx/(s||1),uz:gz/(s||1),s};};
 const edge=(x,z,r)=>Math.max(Math.abs(x),Math.abs(z))+r>half-1;
 const clear=(x,z,r)=>!edge(x,z,r)&&!protectedAt(x,z,r)&&!blockedAt(x,z,r*.7);
 for(let z=-half+2;z<half-2;z+=1)for(let x=-half+2;x<half-2;x+=1)points.push([x+(R()-.5)*.45,z+(R()-.5)*.45]);
 for(let k=points.length-1;k>0;k--){const j=(R()*(k+1))|0;[points[k],points[j]]=[points[j],points[k]];}
 for(const [x,z]of points){
  const g=gradient(x,z);if(g.s<1.55)continue;
  // Coherent unadorned sections break the continuous "curb" along banks and cliff edges.
  if(TDGeo.hash2(Math.floor((x+half)/5),Math.floor((z+half)/5)+(seed|0))>.70)continue;
  let top=h(x,z),bottom=top;
  for(let d=.25;d<=2.5;d+=.25){top=Math.max(top,h(x+g.ux*d,z+g.uz*d));bottom=Math.min(bottom,h(x-g.ux*d,z-g.uz*d));}
  const drop=top-bottom;if(drop<1.6||top<water+.6)continue;
  const scale=Math.min(1.12,drop/(cliffHeight*.95))*(.82+R()*.18),height=cliffHeight*scale;
  const embed=(.22+R()*.10)*scale,px=x+g.ux*embed,pz=z+g.uz*embed,r=cliffWidth*scale*.55;
  if(!clear(px,pz,r)||accents.some(a=>Math.hypot(a.x-px,a.z-pz)<a.r+r+.65))continue;
  const base=Math.max(bottom-.12,Math.min(h(x,z)-height*.58,top-height*.88));
  const depth=cliffDepth*scale;
  // Require the rear of the rock to meet terrain, and the front to emerge from it.
  const back=h(px+g.ux*depth*.42,pz+g.uz*depth*.42),front=h(px-g.ux*depth*.42,pz-g.uz*depth*.42);
  if(back<base+height*.65||front>base+height*.65||base+height>top+.22)continue;
  out.push([cliffType,px,pz,Math.atan2(-g.ux,-g.uz)+(R()-.5)*.18,scale,1,1,base]);
  accents.push({x:px,z:pz,r});
  if(R()<.30)feet.push({x,z,...g,top});
 }
 // Occasional small talus on dry, supported ground; no giant boulders at every riverbank cell.
 for(const f of feet){
  for(let d=.75;d<=3.25;d+=.25){
   const x=f.x-f.ux*d,z=f.z-f.uz*d,ground=h(x,z);if(ground<water+.12||gradient(x,z).s>.55)continue;
   const scale=.36+R()*.29,r=.8*scale;
   if(!clear(x,z,r)||out.some(p=>p[0]===rockType&&Math.hypot(p[1]-x,p[2]-z)<1.2))break;
   const support=[ground,h(x+r,z),h(x-r,z),h(x,z+r),h(x,z-r)];
   if(Math.max(...support)-Math.min(...support)>rockHeight*scale*.35)break;
   out.push([rockType,x,z,R()*Math.PI*2,scale,1,1,Math.min(...support)-rockHeight*scale*.12]);break;
  }
 }
 return out;
}
window.TDCliffPlacement={generate};
})();
