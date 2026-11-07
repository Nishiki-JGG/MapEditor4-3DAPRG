// 全マップ共通の閉扉。単一メッシュ、共有256px PBRアトラス。開閉動作は持たない。
window.TDBossDoors=(()=>{
'use strict';
const ids=['boss_stone_door','dungeon_boss_door'];
const spec={stone:{width:5.5,height:6.25,depth:1.16,leafWidth:3.72,leafHeight:4.85},metal:{width:6.3,height:7.35,depth:1.38,leafWidth:4.35,leafHeight:5.5}};
let maps,shared;const previews={};
function textures(){
 if(maps)return maps;const w=256,h=256,colour=new Uint8Array(w*h*4),packed=new Uint8Array(w*h*4),web=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const region=(x>=128?1:0)+(y>=128?2:0),k=(y*w+x)*4,n=TDGeo.hash2(x+411,y+73),b=.5+.18*Math.sin(x*.087+y*.065)+.12*Math.sin(x*.21-y*.17)+.09*Math.cos(x*.041-y*.13),v=Math.max(170,Math.min(255,Math.round(232+(n-.5)*(region<2?37:12)+(b-.5)*(region<2?35:18)-(n<.028?25:0))));
  const rough=region===0?.88:region===1?.83:region===2?.47:.35,metal=region<2?0:region===2?.50:.62;
  colour.set([v,v,v,255],k);packed.set([Math.round(metal*255),255,0,Math.round((1-rough)*255)],k);web.set([255,Math.round(rough*255),Math.round(metal*255),255],k);
 }
 const tex=(bytes,srgb)=>{const t=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;};
 return maps={w,h,colour,packed,map:tex(colour,true),pbr:tex(web,false)};
}
function material(kind,preview=false){if(!shared){const t=textures();shared=new THREE.MeshStandardMaterial({name:'boss-door-stone-steel-brass',map:t.map,vertexColors:true,metalness:1,roughness:1,metalnessMap:t.pbr,roughnessMap:t.pbr});}if(!preview)return shared;if(!previews[kind]){const m=shared.clone();m.transparent=true;m.opacity=.65;m.depthWrite=false;previews[kind]=m;}return previews[kind];}
function geometry(kind){
 const P=[],N=[],C=[],U=[],G=[],palette=[0xa5a8a7,0x494f53,0x65727b,0xcdb47f];let part=0;
 function add(g,region,hex,tx=0,ty=0,tz=0,ry=0){
  if(g.index)g=g.toNonIndexed();g.rotateY(ry);g.translate(tx,ty,tz);g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,c=new THREE.Color(hex??palette[region]),seed=++part;
  g.computeBoundingBox();const bb=g.boundingBox,size=bb.getSize(new THREE.Vector3());
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i),ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz),u=ax>az&&ax>ay?(z-bb.min.z)/Math.max(size.z,size.y,.01):(x-bb.min.x)/Math.max(size.x,ay>az&&ay>ax?size.z:size.y,.01),v=ay>az&&ay>ax?(z-bb.min.z)/Math.max(size.x,size.z,.01):(y-bb.min.y)/Math.max(ax>az&&ax>ay?size.z:size.x,size.y,.01),variation=1+(TDGeo.hash2(seed,Math.floor(i/3))-.5)*(region<2?.06:.025),ao=.85+.15*Math.min(1,y/.45);
   P.push(x,y,z);N.push(nx,ny,nz);C.push(c.r*variation*ao,c.g*variation*ao,c.b*variation*ao);G.push(0);U.push((region%2)*.5+.025+u*.45,Math.floor(region/2)*.5+.025+v*.45);
  }g.dispose();
 }
 function poly(points,z,d,r,col,bevel=.035){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.005,d-2*bevel),bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1,curveSegments:1});add(g,r,col,0,0,z-d/2+bevel);}
 function rect(x,y,w,h,z,d,r,col,b=.025){poly([[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]],z,d,r,col,b);}
 function stroke(a,b,w,z,d,r,col){const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),nx=-dy/l*w/2,ny=dx/l*w/2;poly([[a[0]+nx,a[1]+ny],[a[0]-nx,a[1]-ny],[b[0]-nx,b[1]-ny],[b[0]+nx,b[1]+ny]],z,d,r,col,w<.02?0:Math.min(.018,w*.15));}
 function ring(cx,cy,ro,ri,z,d,r,col,n=8){for(let i=0;i<n;i++){const a=(i+.5)*Math.PI*2/n,b=(i+1.5)*Math.PI*2/n,pts=[[cx+Math.cos(a)*ro,cy+Math.sin(a)*ro],[cx+Math.cos(b)*ro,cy+Math.sin(b)*ro],[cx+Math.cos(b)*ri,cy+Math.sin(b)*ri],[cx+Math.cos(a)*ri,cy+Math.sin(a)*ri]];if(pts.every(p=>p[0]>.02)||pts.every(p=>p[0]<-.02))poly(pts,z,d,r,col,.012);else {for(const s of[-1,1]){let out=pts;const clip=[];for(let j=0;j<out.length;j++){const A=out[j],B=out[(j+1)%out.length],ina=s*A[0]>=.035,inb=s*B[0]>=.035;if(ina)clip.push(A);if(ina!==inb){const t=(s*.035-A[0])/(B[0]-A[0]);clip.push([s*.035,A[1]+(B[1]-A[1])*t]);}}if(clip.length>=3)poly(clip,z,d,r,col,.008);}}}}
 function stud(x,y,z,r=.055,col=0xc2ad7b){const g=new THREE.SphereGeometry(r,6,3);g.scale(1,1,.48);add(g,3,col,x,y,z);}
 function diamond(x,y,z,w,h,r,col){poly([[x,y-h/2],[x+w/2,y],[x,y+h/2],[x-w/2,y]],z,.1,r,col,.025);const g=new THREE.ConeGeometry(w*.37,.16,4);g.rotateX(Math.PI/2);g.rotateZ(Math.PI/4);add(g,r,col,x,y,z+.11);}
 if(kind==='stone'){
  // 踏み石と左右の裾は地面に接し、扉葉の後ろに貫通用の見せかけの空洞を作らない。
  rect(0,.095,4.15,.16,0,.88,0,0x777d7e,.015);
  for(const s of[-1,1]){
   poly([[s*1.91,.08],[s*2.7,.08],[s*2.59,.63],[s*1.94,.63]],0,1.08,0,0x939b9c,.045);
   for(let i=0;i<4;i++){const y=.68+i*1.12;poly([[s*1.98,y],[s*2.52,y],[s*2.45,y+1.10],[s*1.98,y+1.10]],0,.86,0,[0x9caaaa,0xa4acad,0x98a2a4,0xa2a9a9][i],.035);}
   rect(s*2.22,5.12,.91,.35,0,1.08,0,0xa9b0af,.045);
  }
  poly([[-2.65,5.23],[-2.65,5.87],[-2.32,5.99],[2.32,5.99],[2.65,5.87],[2.65,5.23],[1.86,5.23],[1.64,5.44],[-1.64,5.44],[-1.86,5.23]],0,.96,0,0xa2aaac,.055);
  poly([[-.58,5.48],[-.77,6.10],[.77,6.10],[.58,5.48]],.17,1.0,0,0x919c9f,.055);
  rect(0,5.67,.66,.30,.73,.12,1,0x667278,.025);
  for(const s of[-1,1]){
   const pts=[[s*.045,.20],[s*1.83,.20],[s*1.83,4.78],[s*1.48,5.12],[s*.045,5.12]];
   poly(pts,-.01,.52,1,0x8b9292,.045);
   for(const face of[-1,1]){
    const z=face*.32,trim=0xaeb4b2;
    stroke([s*.16,.36],[s*1.66,.36],.14,z,.10,1,trim);stroke([s*.16,.38],[s*.16,4.94],.12,z,.10,1,trim);stroke([s*1.66,.38],[s*1.66,4.68],.14,z,.10,1,trim);stroke([s*1.66,4.68],[s*1.42,4.94],.14,z,.10,1,trim);stroke([s*.16,4.94],[s*1.42,4.94],.14,z,.10,1,trim);
    // 広い石板に浅い欠け筋。模様は輪郭を邪魔せず、薄い鉄板とは区別する。
    for(const [a,b] of [[[.55,.53],[.62,.82]],[[.62,.82],[.57,1.03]],[[1.43,3.35],[1.34,3.57]],[[1.34,3.57],[1.42,3.82]],[[.42,4.80],[.50,4.54]]])stroke([s*a[0],a[1]],[s*b[0],b[1]],.012,face*.263,.008,1,0x6e6c65);
    // 削り出した大きな八角紋と左右の腕。中央の分割線は切らずに保持。
    stroke([s*.08,2.6],[s*1.65,2.6],.21,face*.40,.15,1,0xa4aca9);
    for(const yy of[.92,4.16]){rect(s*1.72,yy,.22,.38,face*.30,.14,2,0x596267,.025);const h=new THREE.CylinderGeometry(.105,.105,.46,8);add(h,2,0x798288,s*1.90,yy,face*.28);}
   }
  }
  for(const face of[-1,1]){ring(0,2.6,1.27,1.06,face*.40,.17,1,0xaeb5b2);ring(0,2.6,.61,.43,face*.44,.18,1,0xb9bfbc);}
 }else{
  rect(0,.09,5.35,.15,0,1.0,2,0x56616b,.015);
  for(const s of[-1,1]){
   for(const [y,w,h,d,r,col]of[[.24,.98,.40,1.22,2,0x56616b],[.51,.84,.13,1.15,3,0xb6a174],[1.08,.73,.99,.90,2,0x5e6a72],[1.60,.85,.14,1.04,3,0xb3a077],[5.93,.82,.24,.91,3,0xb5a073]])rect(s*2.56,y,w,h,0,d,r,col,.03);
   poly([[s*2.23,1.64],[s*2.91,1.64],[s*2.83,5.88],[s*2.23,5.88]],0,.82,2,0x69767e,.04);
   poly([[s*2.19,6.02],[s*2.88,6.02],[s*2.57,6.76]],0,.72,3,0xb7a173,.04);
   for(const face of[-1,1]){
    stroke([s*2.56,1.68],[s*2.56,5.83],.13,face*.47,.09,3,0xb9a578);
    diamond(s*2.56,4.45,face*.53,.27,.72,3,0xd1ba88);
    for(const y of[.25,2.0,5.65])stud(s*2.56,y,face*.65,.066);
   }
  }
  const crown=[[-2.30,5.85],[-2.30,6.22],[-1.43,6.30],[-1.25,6.65],[-.52,6.51],[0,7.20],[.52,6.51],[1.25,6.65],[1.43,6.30],[2.30,6.22],[2.30,5.85]];
  poly(crown,0,.85,2,0x586874,.045);
  for(const face of[-1,1]){
   for(const s of[-1,1]){stroke([s*.07,7.04],[s*.48,6.4],.13,face*.48,.12,3,0xc7ae79);stroke([s*.48,6.4],[s*1.26,6.52],.13,face*.48,.12,3,0xb9a377);stroke([s*1.26,6.52],[s*1.42,6.19],.13,face*.48,.12,3,0xb9a377);stroke([s*1.42,6.19],[s*2.32,6.10],.13,face*.48,.12,3,0xb9a377);}
   diamond(0,6.49,face*.55,.53,1.12,3,0xc9b381);
  }
  for(const s of[-1,1]){
   poly([[s*.045,.19],[s*2.12,.19],[s*2.12,5.25],[s*1.66,5.70],[s*.045,5.70]],0,.43,2,0x748590,.025);
   for(const face of[-1,1]){
    const z=face*.30;
    stroke([s*.18,.34],[s*2.0,.34],.14,z,.12,3);stroke([s*.18,.37],[s*.18,5.58],.14,z,.12,3);stroke([s*2,.38],[s*2,5.19],.14,z,.12,3);stroke([s*2,5.19],[s*1.61,5.57],.16,z,.12,3);stroke([s*.18,5.57],[s*1.61,5.57],.14,z,.12,3);
    for(const y of[1.2,4.6]){
     stroke([s*1.12,y],[s*2.15,y],.20,face*.34,.16,2,0x71818b);stroke([s*1.12,y-.11],[s*2.14,y-.11],.045,face*.44,.05,3);
     for(const x of[1.35,1.70,1.98])stud(s*x,y,face*.44,.060);
     const h=new THREE.CylinderGeometry(.11,.11,.57,8);add(h,2,0x899398,s*2.13,y,face*.25);
     for(const dy of[-.20,.20]){const collar=new THREE.CylinderGeometry(.12,.12,.055,8);add(collar,3,undefined,s*2.13,y+dy,face*.25);}
    }
    // 面を埋めず、遠景で読める大きな分岐レリーフ。
    stroke([s*1.13,.45],[s*1.13,5.48],.12,face*.32,.10,3,0xb49a64);
    for(const [a,b]of[[[s*.34,2.12],[s*1.13,1.32]],[[s*1.13,1.32],[s*1.84,.67]],[[s*.38,3.63],[s*1.13,4.34]],[[s*1.13,4.34],[s*1.83,5.03]]])stroke(a,b,.15,face*.33,.10,3,0xb49a64);
    diamond(s*1.12,2.78,face*.38,.40,.72,3,0xc6ae78);diamond(s*1.12,5.05,face*.38,.23,.38,3,0xc6ae78);
    for(const y of[.60,1.85,3.75,5.30])stud(s*.18,y,face*.39,.050);
   }
  }
  for(const face of[-1,1]){ring(0,2.95,.79,.58,face*.43,.20,3,0xc0a775);ring(0,2.95,.58,.48,face*.47,.20,2,0x72838a);for(const s of[-1,1]){poly([[s*.045,2.55],[s*.37,2.95],[s*.045,3.35]],face*.53,.20,3,0xc5ad78,.015);for(const y of[2.43,3.47])stud(s*.26,y,face*.58,.056);}}
 }
 const geo=new THREE.BufferGeometry();for(const[name,a,n]of[['position',P,3],['normal',N,3],['color',C,3],['uv',U,2],['glow',G,1]])geo.setAttribute(name,new THREE.Float32BufferAttribute(a,n));geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
}
function png(bytes){const t=textures(),c=document.createElement('canvas');c.width=t.w;c.height=t.h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes),t.w,t.h),0,0);return c.toDataURL('image/png').split(',')[1];}
function exportGeometry(g){const data=TDSmallPropExport.geometry(g);for(const key of ['positions','normals','colors','glow','uv'])data[key]=data[key].map(v=>Math.round(v*1e6)/1e6);return data;}
function exportData(types){const t=textures();return{version:1,units:'metres',axes:'Unity X/Y/Z',textures:{width:t.w,height:t.h,colour:png(t.colour),packed:png(t.packed)},assets:types.filter(t=>ids.includes(t.id)&&t.assetKey==='tdj/'+t.id).map(t=>({id:t.id,assetKey:t.assetKey,radius:t.r,height:t.height,groundSink:0,shape:true,material:t.material,...exportGeometry(t.geo)}))};}
for(const[k,id,name]of[['stone',ids[0],'ボス部屋の扉'],['metal',ids[1],'ダンジョンボスの扉']])TDProps.add({id,name,r:spec[k].width/2,height:spec[k].height,min:7,sc:[1,1],slope:.06,vis:spec[k].width/2,shape:true,groundSink:0,anyGround:true,manualOnly:true,tags:['common'],material:k==='stone'?'bossStone':'bossMetal',bossDoor:true,bossDoorKind:k,build:()=>geometry(k)});
return{ids,spec,geometry,material,export:exportData};
})();
