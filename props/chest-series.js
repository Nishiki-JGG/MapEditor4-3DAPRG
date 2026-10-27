// Six appended static variants. The original wood chest builder and ID are retained.
window.TDChestSeries=(()=>{
 const ids=['treasurechest_worn','treasurechest_reinforced','treasurechest_ornate','treasurechest_silver','treasurechest_gold','treasurechest_rainbow'];
 const names=['ボロボロの宝箱','頑丈な宝箱','装飾された宝箱','美しい銀の宝箱','キラキラの金の宝箱','虹色に輝く宝箱'];
 function merge(gs){const out=new THREE.BufferGeometry();for(const [name,size]of [['position',3],['normal',3],['color',3],['glow',1],['uv',2]]){const v=[];for(const g of gs){const a=g.attributes[name];for(let i=0;i<g.attributes.position.count;i++)for(let k=0;k<size;k++)v.push(a?a.array[i*size+k]:name==='uv'?TDGeo.ATLAS2.white[k]:0);}out.setAttribute(name,new THREE.Float32BufferAttribute(v,size));}return out;}
 function exactIndex(g){const fields=Object.entries(g.attributes),bits=fields.map(([,a])=>new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length)),seen=new Map(),keep=[],ix=[];for(let i=0;i<g.attributes.position.count;i++){const key=fields.map(([,a],k)=>Array.from(bits[k].subarray(i*a.itemSize,(i+1)*a.itemSize)).join(',')).join('/');let n=seen.get(key);if(n===undefined){n=keep.length;seen.set(key,n);keep.push(i);}ix.push(n);}const out=new THREE.BufferGeometry();for(const [name,a]of fields){const values=new Float32Array(keep.length*a.itemSize);keep.forEach((i,j)=>values.set(a.array.subarray(i*a.itemSize,(i+1)*a.itemSize),j*a.itemSize));out.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}out.setIndex(ix);g.dispose();return out;}
 function build(tier){
  const {col,mat4,makeGeo}=TDGeo,{part,wood}=TDPracticalParts,{bevelBox}=TDArchitectureParts,parts=[];
  const metal=tier>=3,gold=tier===4,rainbow=tier===5,trim=col(metal?(gold?0xe4ad35:0xe6edf2):tier===2?0xb99b54:0x676d6b),dark=col(metal?(gold?0x8a5d1a:0x687b8f):0x4b504d);
  const solid=(hex)=>()=>Array.isArray(hex)?hex:col(hex);
  function add(g,x,y,z,color=trim,glow=0,ry=0,rx=0,rz=0){parts.push({...part(g,mat4(x,y,z,1,1,1,ry,rx,rz),solid(color)),j:.008,glow});}
  function box(w,h,d,x,y,z,c=trim,edge=.008){add(Math.min(w,h,d)<.04?new THREE.BoxGeometry(w,h,d):bevelBox(w,h,d,edge),x,y,z,c);}
  function hoop(x,w,rz=.348,ry=.285,ink=false){const s=new THREE.Shape();for(let k=0;k<=18;k++){const a=k*Math.PI/18;const z=-rz*Math.cos(a),y=.435+ry*Math.sin(a);k?s.lineTo(z,y):s.moveTo(z,y);}for(let k=18;k>=0;k--){const a=k*Math.PI/18;s.lineTo(-(rz-.018)*Math.cos(a),.435+(ry-.018)*Math.sin(a));}s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:w,steps:1,bevelEnabled:false});g.translate(0,0,-w/2);g.rotateY(Math.PI/2);add(g,x,0,0,ink?col(0x161b22):trim);if(ink)parts.at(-1).uvr=[-4,0,-4,0];}
  function stone(x,y,z,r,color,glow=.0){
   const v=[],ix=[];for(const [rr,h]of [[.76,-.020],[1,0],[.67,.027]])for(let j=0;j<8;j++){const a=j*Math.PI/4;v.push([Math.cos(a)*r*rr,h,Math.sin(a)*r*rr*.8]);}
   for(let k=0;k<2;k++)for(let j=0;j<8;j++){const a=k*8+j,b=k*8+(j+1)%8;ix.push(a,b,a+8,b,b+8,a+8);}for(let j=1;j<7;j++)ix.push(16,16+j,17+j,0,j+1,j);
   for(let k=0;k<ix.length;k+=3){const b=ix[k+1];ix[k+1]=ix[k+2];ix[k+2]=b;}add(TDSmallParts.mesh(v,ix),x,y,z,col(color),glow);const rim=new THREE.TorusGeometry(r*.92,.007,4,8);rim.rotateX(Math.PI/2);rim.scale(1,1,.8);add(rim,x,y-.006,z,trim);
  }
  function badge(w,reach,rz,ry,lift){const start=Math.acos(reach/(rz+lift)),v=[],ix=[];for(let k=0;k<=10;k++){const a=start+(Math.PI-2*start)*k/10;for(const [x,outer]of [[-w/2,true],[w/2,true],[-w/2,false],[w/2,false]])v.push([x,.435+(ry+(outer?lift:0))*Math.sin(a),-(rz+(outer?lift:0))*Math.cos(a)]);}function quad(a,b,c,d,n){let A=new THREE.Vector3(...v[a]),B=new THREE.Vector3(...v[b]),C=new THREE.Vector3(...v[c]);if(B.sub(A).cross(C.sub(A)).dot(new THREE.Vector3(...n))<0)ix.push(a,c,b,b,c,d);else ix.push(a,b,c,b,d,c);}for(let k=0;k<10;k++){const a=k*4,b=a+4,ang=start+(Math.PI-2*start)*(k+.5)/10,n=[0,Math.sin(ang),-Math.cos(ang)];quad(a,a+1,b,b+1,n);quad(a+2,a+3,b+2,b+3,n.map(x=>-x));quad(a,a+2,b,b+2,[-1,0,0]);quad(a+1,a+3,b+1,b+3,[1,0,0]);}quad(0,1,2,3,[0,-Math.cos(start),-Math.sin(start)]);quad(40,41,42,43,[0,-Math.cos(start),Math.sin(start)]);add(TDSmallParts.mesh(v,ix),0,0,0,trim);}
  let base;
  if(!metal){base=window.TDTreasureWoodBuild();if(tier===0){const p=base.attributes.position,c=base.attributes.color;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),w=Math.min(1,y/.055);p.setXYZ(i,x+.006*Math.sin(y*29+z*19)*w,y+(.004*Math.sin(x*23+z*7)-.020*Math.exp(-((x+.42)**2+(y-.40)**2)*450)-.043*Math.exp(-((x-.22)**2+z*z)*90)*Math.min(1,Math.max(0,(y-.43)/.15)))*w,z+.004*Math.cos(x*17-y*13)*w);const uv=base.attributes.uv,metalPart=Math.abs(uv.getX(i)-TDGeo.ATLAS2.white[0])<1e-6&&Math.abs(uv.getY(i)-TDGeo.ATLAS2.white[1])<1e-6,fade=col(metalPart?0x79513a:0xa99c82),k=.74+.14*Math.sin(x*8+y*10+z*6);c.setXYZ(i,c.getX(i)*k*.66+fade[0]*.34,c.getY(i)*k*.66+fade[1]*.34,c.getZ(i)*k*.66+fade[2]*.34);}base.computeVertexNormals();for(const xx of [-.15,.21]){const pts=[];for(let j=0;j<9;j++){const z=-.19+j*.0475,x=xx+.013*Math.sin(j*.8),y=.435+.274*Math.sqrt(1-z*z/(.337*.337))-.043*Math.exp(-((x-.22)**2+z*z)*90)+.001;pts.push([x,y,z]);}add(TDSmallParts.tube(pts,pts.map(()=>.003),3),0,0,0,col(0x40382b));}for(const [x,y,l]of [[-.23,.17,.18],[.22,.31,.14],[-.11,.386,.12]]){const pts=[[x-l/2,y-.004,.322],[x-.016,y+.004,.323],[x+l/2,y,.322]];add(TDSmallParts.tube(pts,[.0015,.003,.0008],3),0,0,0,col(0x3e3426));}box(.27,.071,.018,.18,.23,.328,col(0x756043),.003);box(.24,.055,.018,-.16,.34,-.328,col(0x8c7759),.003);}}
  else{
   // Continuous forged panels instead of recoloured wooden staves.
   box(1.025,.425,.642,0,.2125,0,col(gold?0xdca43c:rainbow?0x829fc7:0xbac9d5),.012);
   const s=new THREE.Shape();s.moveTo(-.333,.432);for(let k=0;k<=24;k++){const a=k*Math.PI/24;s.lineTo(-.333*Math.cos(a),.435+.274*Math.sin(a));}s.lineTo(.333,.432);s.closePath();const lid=new THREE.ExtrudeGeometry(s,{depth:1.065,steps:1,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1});lid.translate(0,0,-.5325);lid.rotateY(Math.PI/2);add(lid,0,0,0,col(gold?0xf2c050:rainbow?0x8caad9:0xd8e2e9));
   box(.084,.135,.022,0,.388,.339,dark);box(.11,.09,.045,0,.322,.364,trim);box(.010,.025,.003,0,.321,.389,dark,.002);
   for(const x of [-.355,.355]){const h=new THREE.CylinderGeometry(.025,.025,.09,8);h.rotateZ(Math.PI/2);add(h,x,.435,-.344,dark);}
   base=null;
  }
  if(tier>=1){
   for(const x of tier===1?[-.36,0,.36]:[-.40,.40]){hoop(x,tier===1?.075:.043);for(const z of [-.334,.334])box(tier===1?.075:.043,.425,.024,x,.225,z);box(tier===1?.075:.043,.018,.676,x,.009,0);}
   for(const x of [-.494,.494])for(const z of [-.312,.312]){box(.075,.40,.032,x,.22,z);box(.032,.40,.075,x,.22,z);}
   for(const z of [-.34,.34])for(const y of [.07,.414])box(1.04,.032,.026,0,y,z);
   if(tier===1){box(.16,.17,.032,0,.38,.349);box(.115,.10,.051,0,.285,.365,dark);}
  }
  if(tier>=2){
   // An inlaid cartouche follows the curved lid; it is supported, never a floating badge.
   for(const x of [-.20,.20])hoop(x,.015,.342,.279,metal);
   badge(rainbow?.40:gold?.34:.23,tier>=4?.14:.105,metal?.337:.334,metal?.276:.272,metal?.017:.019);stone(0,.743,0,.069,metal?(gold?0xab2025:rainbow?0xd7d5ff:0x388dbd):0x2e806b,metal?.10:0);
   for(const x of [-.40,.40])for(const z of [-.225,.225]){const y=.435+.285*Math.sqrt(1-z*z/(.348*.348));stone(x,y+.009,z,.032,metal?(gold?0xffd56b:0xe7f5ff):0xbd9b50,metal?.18:0);}
   for(const x of [-.46,.46]){const g=new THREE.TorusGeometry(.062,.009,5,12);add(g,x,.27,.346,trim,0);const stud=new THREE.CylinderGeometry(.017,.017,.044,8);stud.rotateX(Math.PI/2);add(stud,x,.325,.330,trim);}
  }
  if(gold||rainbow){
   badge(rainbow?.36:.29,rainbow?.08:.125,.353,.292,.015);if(rainbow){for(const x of [-.10,0,.10])stone(x,.752+(.003-Math.abs(x)*.02),0,.060,0xc5dbff,.25);}else stone(0,.755,0,.106,0x9c1831,.20);
   for(const x of [-.43,.43]){box(.085,.018,.15,x,.728,0);stone(x,.750,0,.045,rainbow?0xb2f0ef:0xffe694,.24);}
   // Small raised four-point glints are part of the same opaque mesh/pass.
   for(const [x,y,z]of [[-.35,.69,-.15],[.30,.59,.30]]){const v=[[0,.022,0],[.006,.006,0],[.022,0,0],[.006,-.006,0],[0,-.022,0],[-.006,-.006,0],[-.022,0,0],[-.006,.006,0],[0,0,.004]],ix=[];for(let k=0;k<8;k++)ix.push(8,k,(k+1)%8);add(TDSmallParts.mesh(v,ix),x,y,z,col(0xfff5da),.65,0,-.7);}
  }
  const extra=makeGeo(parts,1920+tier,{ao:.08,smooth:42,uv:TDGeo.ATLAS2.white});const result=base?merge([base,extra]):extra;
  if(metal){const c=result.attributes.color,g=result.attributes.glow,p=result.attributes.position;for(let i=0;i<p.count;i++){if(result.attributes.uv.getX(i)<-3){const ink=col(0x161b22);c.setXYZ(i,ink[0],ink[1],ink[2]);}else if(rainbow&&g.getX(i)<.2){const h=((p.getX(i)+.55)*.65+p.getZ(i)*.27+p.getY(i)*.25)%1,cc=new THREE.Color().setHSL((h+1)%1,.62,.40);c.setXYZ(i,cc.r,cc.g,cc.b);}else{const k=.74+.36*Math.max(result.attributes.normal.getY(i),-.4);c.setXYZ(i,c.getX(i)/k,c.getY(i)/k,c.getZ(i)/k);}}}
  const final=rainbow?exactIndex(result):result;final.computeBoundingBox();return final;
 }
 const mats=new Map();
 function material(id,time,ambient){if(mats.has(id))return mats.get(id);const rainbow=id.endsWith('_rainbow'),m=new THREE.MeshLambertMaterial({vertexColors:true});m.onBeforeCompile=sh=>{sh.uniforms.uChestTime=time;sh.uniforms.uChestAmbient={get value(){return ambient?ambient.intensity/1.05:1;}};sh.uniforms.uChestRainbow={value:rainbow?1:0};sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vChestN; varying vec3 vChestV; varying vec3 vChestP; attribute float glow; varying float vChestGlow; varying float vChestInk;').replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvChestN=normalize(transformedNormal);').replace('#include <project_vertex>','#include <project_vertex>\nvChestV=-mvPosition.xyz; vChestP=position; vChestGlow=glow; vChestInk=1.-step(-3.,uv.x);');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uChestTime; uniform float uChestAmbient; uniform float uChestRainbow; varying vec3 vChestN; varying vec3 vChestV; varying vec3 vChestP; varying float vChestGlow; varying float vChestInk;').replace('#include <opaque_fragment>',`vec3 cn=normalize(vChestN),cv=normalize(vChestV),cl=normalize(mat3(viewMatrix)*vec3(-.3,.8,.5));
float cs=pow(max(0.,dot(cn,normalize(cl+cv))),80.);float cr=pow(1.-max(0.,dot(cn,cv)),3.);vec3 refl=reflect(-cv,cn);float env=.14+.45*smoothstep(-.10,.55,refl.y)+.65*pow(max(0.,1.-abs(refl.y-.4)),16.);
vec3 coat=.5+.5*cos(vec3(0.,2.094,4.188)+dot(cn,cv)*9.+uChestTime*.45);
float gain=clamp(uChestAmbient,.03,1.);outgoingLight=outgoingLight*.46+diffuseColor.rgb*env*.62*gain+mix(mix(vec3(1.),diffuseColor.rgb,.35),vec3(.025)+diffuseColor.rgb*.8,vChestInk)*(cs*.95+cr*.14)*gain;
outgoingLight+=(1.-vChestInk)*uChestRainbow*coat*(.10+cr*.14)*gain+diffuseColor.rgb*vChestGlow*(.72+.28*sin(uChestTime*3.+vChestP.x*17.+vChestP.z*11.));
#include <opaque_fragment>`);};m.customProgramCacheKey=()=> 'chest-metal-v3-'+rainbow;mats.set(id,m);return m;}
 ids.forEach((id,tier)=>TDProps.add({id,name:names[tier],r:.64,min:1.4,sc:[.85,1.15],slope:.18,vis:.69,anyGround:true,tags:['ruins','castle','cave'],height:tier>=4?.81:tier>=2?.80:.74,groundSink:0,shape:true,material:tier>=3?'chestmetal':'cards2',build:()=>build(tier)}));
 return{ids,material};
})();
