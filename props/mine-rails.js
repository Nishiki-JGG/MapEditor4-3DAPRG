// 坑道レール。寸法は既存標準坑道に合わせたゲーム用規格（史実の軌間ではない）。
window.TDMineRails=(()=>{
 'use strict';
 const ids=['mine_rail_straight','mine_rail_curve','mine_rail_end'];
 const spec={version:1,centres:.84,headWidth:.05,clearGauge:.79,runningHeight:.14,straightLength:2,curveRadius:2};
 const definitions=[{id:ids[0],name:'坑道レール・直線',length:2,curve:false,ends:[[0,0,0,0,0,-1],[0,0,2,0,0,1]]},{id:ids[1],name:'坑道レール・曲線',length:Math.PI,curve:true,ends:[[0,0,0,0,0,-1],[2,0,2,1,0,0]]},{id:ids[2],name:'坑道レール・終端',length:2,curve:false,ends:[[0,0,0,0,0,-1]]}];
 let textures,sharedMaterial;
 function maps(){if(textures)return textures;const w=512,h=256,colour=new Uint8Array(w*h*4),packed=new Uint8Array(w*h*4),normal=new Uint8Array(w*h*4),heights=new Float32Array(w*h);
  const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,n=noise(x,y),cloud=(Math.sin(x*.043+Math.sin(y*.032)*1.4)+Math.sin(x*.091+y*.029))*.5;let rgb,metal,rough,ht;
   if(x<256){const grain=Math.sin(x*.11+Math.sin(y*.052)*1.4+Math.sin(x*.037)*2),fine=Math.sin(x*.63+Math.sin(y*.021)*3),crack=Math.pow(Math.max(0,Math.sin(x*.24+Math.sin(y*.035)*.5)),30);const t=grain*8+fine*3+cloud*6+(n-.5)*5-crack*26;const ends=y>=192,ring=Math.sin(Math.hypot((x-140)*.8,(y-212)*3)*.24+cloud*.5),edge=ends?ring*7:0;rgb=[104+t+edge,83+t*.8+edge*.8,57+t*.55+edge*.5];metal=0;rough=.78+grain*.04+crack*.13;ht=ends?ring*.08:grain*.16+fine*.045-crack*.2;}
   else if(y<128){const rust=Math.max(0,cloud*.6+noise(x>>3,y>>3)*.4-.12),pits=n>.96?.18:0;rgb=[76+rust*80,77+rust*23,74-rust*20];metal=.88-rust*.7;rough=.43+rust*.4+pits;ht=rust*.09-pits;}
   else if(y<192){const streak=Math.sin(y*.72+Math.sin(x*.014))*.5;rgb=[155+streak*10+cloud*4,157+streak*10+cloud*4,153+streak*10+cloud*4];metal=.95;rough=.27+streak*.035;ht=streak*.025;}
   else{rgb=[76+cloud*10,72+cloud*8,64+cloud*6];metal=.75;rough=.5+(n-.5)*.06;ht=(n-.5)*.03;}
   for(let k=0;k<3;k++)colour[i+k]=Math.max(0,Math.min(255,Math.round(rgb[k])));colour[i+3]=255;packed[i]=Math.round(metal*255);packed[i+1]=255;packed[i+2]=0;packed[i+3]=Math.round((1-Math.min(.98,rough))*255);heights[y*w+x]=ht;
  }
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;let dx=(heights[y*w+Math.min(w-1,x+1)]-heights[y*w+Math.max(0,x-1)])*.2,dy=(heights[Math.min(h-1,y+1)*w+x]-heights[Math.max(0,y-1)*w+x])*.2;if(x===255||x===256)dx=0;if([127,128,191,192].includes(y))dy=0;const len=Math.hypot(dx,dy,1);normal[i]=Math.round((-.5*dx/len+.5)*255);normal[i+1]=Math.round((-.5*dy/len+.5)*255);normal[i+2]=Math.round((.5/len+.5)*255);normal[i+3]=255;}
  const tex=(bytes,srgb)=>{const t=new THREE.DataTexture(bytes,w,h);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=2;t.needsUpdate=true;return t;};
  const mr=new Uint8Array(packed);for(let i=0;i<mr.length;i+=4){mr[i+1]=255-packed[i+3];mr[i+2]=packed[i];}
  textures={w,h,colour,packed,normal,map:tex(colour,true),metalRough:tex(mr,false),normalMap:tex(normal,false)};return textures;
 }
 function material(){if(!sharedMaterial){const t=maps();sharedMaterial=new THREE.MeshStandardMaterial({name:'mine-rail-iron-and-timber',map:t.map,metalness:1,roughness:1,metalnessMap:t.metalRough,roughnessMap:t.metalRough,normalMap:t.normalMap,normalScale:new THREE.Vector2(.6,.6)});}return sharedMaterial;}
 const regions={wood:[4,4,252,188],woodEnd:[4,196,252,252],iron:[260,4,508,124],head:[260,132,508,188],fastener:[260,196,508,252]};
 function geometry(def){const pos=[],norm=[],uv=[],tri=[];const push=(a,b,c,region,texcoords)=>{const n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a))).normalize(),start=pos.length/3,r=regions[region];for(let j=0;j<3;j++){pos.push(...[a,b,c][j]);norm.push(n.x,n.y,n.z);const q=texcoords[j];uv.push((r[0]+(r[2]-r[0])*q[0])/512,(r[1]+(r[3]-r[1])*q[1])/256);}tri.push(start,start+1,start+2);};
  function quad(a,b,c,d,region,u0=0,u1=1,v0=0,v1=1){push(a,b,c,region,[[u0,v0],[u1,v0],[u1,v1]]);push(a,c,d,region,[[u0,v0],[u1,v1],[u0,v1]]);}
  const frame=(s,x,y)=>{const a=def.curve?s/2:0;return def.curve?[2-2*Math.cos(a)+x*Math.cos(a),y,2*Math.sin(a)-x*Math.sin(a)]:[x,y,s];};
  function box(s,x,y,w,h,d,region,pitch=0){
   const local=v=>{const a=def.curve?s/2:0,base=frame(s,x,y),yy=v[1]*Math.cos(pitch)-v[2]*Math.sin(pitch),zz=v[1]*Math.sin(pitch)+v[2]*Math.cos(pitch);return[base[0]+v[0]*Math.cos(a)+zz*Math.sin(a),base[1]+yy,base[2]-v[0]*Math.sin(a)+zz*Math.cos(a)];};
   if(region==='wood'){const c=Math.min(.008,h*.15,d*.15),prof=[[-h/2,-d/2+c],[-h/2+c,-d/2],[h/2-c,-d/2],[h/2,-d/2+c],[h/2,d/2-c],[h/2-c,d/2],[-h/2+c,d/2],[-h/2,d/2-c]],left=prof.map(([yy,z])=>local([-w/2,yy,z])),right=prof.map(([yy,z])=>local([w/2,yy,z]));for(let i=0;i<8;i++){let j=(i+1)%8;quad(left[i],left[j],right[j],right[i],'wood',i/8,j/8,0,1);}const face=THREE.ShapeUtils.triangulateShape(prof.map(p=>new THREE.Vector2(...p)),[]);for(const f of face){push(...f.map(i=>left[i]).reverse(),'woodEnd',[[0,0],[1,0],[0,1]]);push(...f.map(i=>right[i]),'woodEnd',[[0,0],[1,0],[0,1]]);}return;}
   const p=[[-w/2,-h/2,-d/2],[w/2,-h/2,-d/2],[w/2,h/2,-d/2],[-w/2,h/2,-d/2],[-w/2,-h/2,d/2],[w/2,-h/2,d/2],[w/2,h/2,d/2],[-w/2,h/2,d/2]].map(local);for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(...f.map(i=>p[i]),region);
  }
  const profile=[[-.045,.070],[.045,.070],[.045,.081],[.014,.092],[.014,.118],[.025,.124],[.025,.136],[.018,.140],[-.018,.140],[-.025,.136],[-.025,.124],[-.014,.118],[-.014,.092],[-.045,.081]],steps=def.curve?16:1;
  for(const offset of [-.42,.42]){for(let k=0;k<steps;k++){const s0=def.length*k/steps,s1=def.length*(k+1)/steps;for(let j=0;j<profile.length;j++){const a=profile[j],b=profile[(j+1)%profile.length],region=j>=6&&j<=8?'head':'iron';quad(frame(s0,offset+a[0],a[1]),frame(s0,offset+b[0],b[1]),frame(s1,offset+b[0],b[1]),frame(s1,offset+a[0],a[1]),region,j/profile.length,(j+1)/profile.length,k/steps,(k+1)/steps);}}
   const caps=THREE.ShapeUtils.triangulateShape(profile.map(p=>new THREE.Vector2(...p)),[]);for(const face of caps){const points=face.map(j=>frame(0,offset+profile[j][0],profile[j][1]));push(points[2],points[1],points[0],'iron',[[0,0],[1,0],[0,1]]);const q=face.map(j=>frame(def.length,offset+profile[j][0],profile[j][1]));push(...q,'iron',[[0,0],[1,0],[0,1]]);}}
  const ties=def.curve?7:4;for(let k=0;k<ties;k++){const s=def.length*(k+.5)/ties;box(s,0,.035,1.24,.07,.18,'wood');for(const rail of [-.42,.42])for(const side of [-1,1])box(s,rail+side*.060,.078,.033,.025,.055,'fastener');}
  // Fishplates stop short of the module boundary, leaving the joining faces exact.
  for(const rail of [-.42,.42])for(const side of [-1,1])box(def.length-.10,rail+side*.019,.105,.009,.024,.18,'iron');
  if(def.id===ids[2]){box(1.78,0,.40,1.20,.18,.16,'wood');for(const side of [-1,1]){box(1.78,side*.49,.21,.12,.42,.15,'iron');box(1.55,side*.49,.21,.07,.57,.07,'iron',.85);box(1.78,side*.49,.40,.045,.045,.19,'fastener');}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1),3));g.setAttribute('glow',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3),1));g.setIndex(tri);g.computeBoundingBox();g.computeBoundingSphere();return g;
 }
 function worldEnds(def,p){const c=Math.cos(p.rot),s=Math.sin(p.rot);return def.ends.map(e=>({p:[p.x+(e[0]*c+e[2]*s)*p.scale,p.y+e[1]*p.scale,p.z+(-e[0]*s+e[2]*c)*p.scale],d:[e[3]*c+e[5]*s,0,-e[3]*s+e[5]*c]}));}
 let placementCache;
 function invalidate(){placementCache=null;}
 function placementIndex(placed,types,heightAt){
  if(placementCache&&placementCache.placed===placed)return placementCache.cells;
  const cells=new Map(),ends=[];
  for(const p of placed){const def=definitions.find(d=>d.id===types[p[0]].id);if(!def||Math.abs((p[6]??1)-1)>1e-6)continue;for(const e of worldEnds(def,{x:p[1],z:p[2],rot:p[3],scale:p[4],y:p[7]??heightAt(p[1],p[2])})){e.owner=p;e.scale=p[4];ends.push(e);const key=Math.floor(e.p[0])+','+Math.floor(e.p[2]);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(e);}}
  for(const e of ends){const ix=Math.floor(e.p[0]),iz=Math.floor(e.p[2]);for(let x=ix-1;x<=ix+1;x++)for(let z=iz-1;z<=iz+1;z++)for(const q of cells.get(x+','+z)||[]){if(e.owner!==q.owner&&Math.abs(e.scale-q.scale)<1e-6&&Math.hypot(...e.p.map((v,i)=>v-q.p[i]))<.002&&e.d[0]*q.d[0]+e.d[2]*q.d[2]<-.999)e.occupied=true;}}
  placementCache={placed,cells};return cells;
 }
 function fitsGround(def,p,heightAt){const c=Math.cos(p.rot),sn=Math.sin(p.rot),steps=def.curve?8:4;for(let k=0;k<=steps;k++){const a=def.curve?Math.PI*.5*k/steps:0,bx=def.curve?2-2*Math.cos(a):0,bz=def.curve?2*Math.sin(a):2*k/steps;for(const side of [-.6,0,.6]){const x=bx+side*Math.cos(a),z=bz-side*Math.sin(a);if(Math.abs(heightAt(p.x+(x*c+z*sn)*p.scale,p.z+(-x*sn+z*c)*p.scale)-p.y)>.06*p.scale)return false;}}return true;}
 function placement(id,x,z,rot,scale,placed,types,heightAt){const def=definitions.find(d=>d.id===id),raw={x,y:heightAt(x,z),z,rot,scale,snapped:false};if(!def)return raw;raw.valid=fitsGround(def,raw,heightAt);let best=null;const source=worldEnds(def,raw),threshold=.32*scale,cells=placementIndex(placed,types,heightAt);
  for(let k=0;k<source.length;k++){const e=source[k];for(let ix=Math.floor(e.p[0]-threshold);ix<=Math.floor(e.p[0]+threshold);ix++)for(let iz=Math.floor(e.p[2]-threshold);iz<=Math.floor(e.p[2]+threshold);iz++)for(const end of cells.get(ix+','+iz)||[]){if(end.occupied||Math.abs(end.scale-scale)>1e-6)continue;const dist=Math.hypot(e.p[0]-end.p[0],e.p[2]-end.p[2]);if(dist>threshold||Math.abs(e.p[1]-end.p[1])>.06*scale)continue;const angle=((Math.atan2(-end.d[0],-end.d[2])-Math.atan2(def.ends[k][3],def.ends[k][5]))%(Math.PI*2)+Math.PI*2)%(Math.PI*2),delta=Math.atan2(Math.sin(angle-rot),Math.cos(angle-rot));if(Math.abs(delta)>Math.PI/12+.001)continue;const c=Math.cos(angle),s=Math.sin(angle),q=def.ends[k],px=end.p[0]-(q[0]*c+q[2]*s)*scale,pz=end.p[2]-(-q[0]*s+q[2]*c)*scale,candidate={x:px,y:end.p[1],z:pz,rot:angle,scale,snapped:true,valid:true};if(!fitsGround(def,candidate,heightAt))continue;if(!best||dist<best.dist)best={...candidate,dist};}}
  return best||raw;
 }

 function png(bytes){const t=maps(),c=document.createElement('canvas');c.width=t.w;c.height=t.h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes),t.w,t.h),0,0);return c.toDataURL('image/png').split(',')[1];}
 function exportData(types){const t=maps();return{version:1,units:'metres',axes:'Unity X/Y/Z',runningHeight:spec.runningHeight,railCentres:spec.centres,textures:{width:t.w,height:t.h,colour:png(t.colour),packed:png(t.packed),normal:png(t.normal)},assets:types.filter(t=>ids.includes(t.id)&&t.assetKey==='tdj/'+t.id).map(t=>({id:t.id,assetKey:t.assetKey,radius:t.r,height:t.height,shape:!!t.shape,groundSink:0,material:'mineRail',...(!t.shape&&t.r>0?{circleColliders:(t.offs||[[0,0]]).map(o=>({center:[o[0],0,-o[1]],radius:t.r,height:t.height}))}:{}),...TDSmallPropExport.geometry(t.geo),ends:definitions.find(d=>d.id===t.id).ends.map(e=>({position:[e[0],e[1],-e[2]],direction:[e[3],e[4],-e[5]]}))}))};}
 for(const d of definitions)TDProps.add({id:d.id,name:d.name,r:d.id===ids[2]?.65:0,collisionGeo:d.id===ids[2]?new THREE.BoxGeometry(1.2,.49,.19).translate(0,.245,1.78):undefined,min:2,sc:[1,1],slope:.1,vis:d.curve?2.7:2.1,height:d.id===ids[2]?.49:.14,groundSink:0,anyGround:true,manualOnly:true,shape:d.id===ids[2],tags:['cave','ruins'],material:'mineRail',mineRail:true,build:()=>geometry(d)});
 return{ids,spec,definitions,material,maps,invalidate,placement,worldEnds,export:exportData};
})();
