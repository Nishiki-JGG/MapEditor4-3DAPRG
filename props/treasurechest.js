// 閉じた木製宝箱。専用の静的形状だけを追加し、開閉や報酬処理は持たない。
TDProps.add({id:'treasurechest',name:'木の宝箱',r:.64,min:1.4,sc:[.85,1.15],slope:.18,vis:.69,anyGround:true,tags:['ruins','castle','cave'],height:.73,groundSink:0,shape:true,material:'cards2',build:window.TDTreasureWoodBuild=function(){
 const {mat4}=TDGeo,{mesh,tube}=TDSmallParts,{part,wood,iron,build}=TDPracticalParts,parts=[];
 const add=(g,x=0,y=0,z=0,c=wood,textured=true)=>parts.push(part(g,mat4(x,y,z,1,1,1),c,textured));
 const darkIron=(y,ny,R)=>TDGeo.mixc(TDGeo.col(0x59615f),TDGeo.col(0x858b85),.18+R()*.24);
 function plank(w,h,d,b=.004,phase=.35){
  b=Math.min(b,w*.2,h*.2,d*.2);const s=new THREE.Shape(),u=d/2-b,v=h/2-b;s.moveTo(-u,-v);s.lineTo(u,-v);s.lineTo(u,v);s.lineTo(-u,v);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:w-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:1,steps:1});g.translate(0,0,-w/2+b);g.rotateY(Math.PI/2);
  const p=g.attributes.position,n=g.attributes.normal,uv=[];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(Math.abs(n.getX(i))>.7)uv.push(phase+(y/h+.5)*.30,z/d+.5);else if(Math.abs(n.getY(i))>.7)uv.push(phase+(z/d+.5)*.30,x/w+.5);else uv.push(phase+(y/h+.5)*.30,x/w+.5);}g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
 }
 // A closed annular-sector extrusion. Each board and iron hoop has real thickness.
 function arch(width,rz,ry,thick,a0,a1,n,edge=0){
  const v=[],ix=[],uv=[],base=.435;
  for(let k=0;k<=n;k++){const a=a0+(a1-a0)*k/n;for(const [x,inside]of [[-width/2,false],[width/2,false],[-width/2,true],[width/2,true]]){const inset=inside?thick:(k===0||k===n?edge:0);v.push([x,base+(ry-inset)*Math.sin(a),-(rz-inset)*Math.cos(a)]);uv.push(a/Math.PI,x/width+.5);}}
  function tri(a,b,c,norm){const A=new THREE.Vector3(...v[a]),B=new THREE.Vector3(...v[b]),C=new THREE.Vector3(...v[c]);if(B.sub(A).cross(C.sub(A)).dot(new THREE.Vector3(...norm))<0)ix.push(a,c,b);else ix.push(a,b,c);}
  function quad(a,b,c,d,norm){tri(a,b,c,norm);tri(b,d,c,norm);}
  for(let k=0;k<n;k++){const a=k*4,b=a+4,t=a0+(a1-a0)*(k+.5)/n,rad=[0,Math.sin(t)/ry,-Math.cos(t)/rz];quad(a,a+1,b,b+1,rad);quad(a+2,a+3,b+2,b+3,rad.map(x=>-x));quad(a,a+2,b,b+2,[-1,0,0]);quad(a+1,a+3,b+1,b+3,[1,0,0]);}
  quad(0,1,2,3,[0,-ry*Math.cos(a0),-rz*Math.sin(a0)]);const e=n*4;quad(e,e+1,e+2,e+3,[0,ry*Math.cos(a1),rz*Math.sin(a1)]);
  const g=mesh(v,ix);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
 }
 // Solid base and horizontal wall boards; fine seams do not expose an empty underside.
 add(plank(1.02,.045,.64),0,.0225,0);
 for(const s of [-1,1])for(let k=0;k<3;k++)add(plank(1.02,.126,.036,.004,k*.33),0,.108+k*.126,s*.302);
 for(const s of [-1,1])for(let k=0;k<3;k++)add(plank(.036,.126,.568,.004,k*.33),s*.492,.108+k*.126,0);
 for(const s of [-1,1]){add(plank(1.035,.024,.038),0,.423,s*.302);add(plank(.038,.024,.568),s*.492,.423,0);}
 // Closed butt joints: the small V relief is a bevel, not a hole through the lid.
 for(let k=0;k<9;k++)add(arch(1.07,.337,.274,.026,k*Math.PI/9,(k+1)*Math.PI/9,2,.0015));
 for(const s of [-1,1]){
  const shape=new THREE.Shape();shape.moveTo(-.309,.431);for(let k=0;k<=18;k++){const a=k*Math.PI/18;shape.lineTo(-.309*Math.cos(a),.435+.247*Math.sin(a));}shape.lineTo(.309,.431);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:.027,bevelEnabled:false,steps:1});g.translate(0,0,-.0135);g.rotateY(Math.PI/2);const p=g.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push((p.getY(i)-.431)/.251,-p.getZ(i)/.618+.5);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));add(g,s*.514,0,0);
 }
 for(const x of [-.355,.355]){
  add(arch(.051,.346,.283,.012,0,Math.PI,18),x,0,0,darkIron,false);
  for(const s of [-1,1])add(plank(.051,.421,.016,.002),x,.2245,s*.3275,darkIron,false);
  add(new THREE.BoxGeometry(.051,.014,.653),x,.007,0,darkIron,false);
  // Hinge knuckles run along X and meet both the strap and the rear lid edge.
  const hinge=new THREE.CylinderGeometry(.024,.024,.092,8);hinge.rotateZ(Math.PI/2);add(hinge,x,.435,-.335,iron,false);
  add(new THREE.BoxGeometry(.078,.094,.012),x,.405,-.323,darkIron,false);
 }
 // The central latch bridges the lid rim to a small padlock; hardware is kept restrained.
 add(plank(.094,.135,.014,.003),0,.365,.326,darkIron,false);
 add(plank(.051,.081,.025,.003),0,.435,.337,iron,false);
 add(plank(.083,.090,.035,.008),0,.341,.351,darkIron,false);
 const shackle=[];for(let k=0;k<=8;k++){const a=k*Math.PI/8;shackle.push([.027*Math.cos(a),.384+.039*Math.sin(a),.35]);}add(tube(shackle,shackle.map(()=>.006),5),0,0,0,iron,false);
 add(new THREE.BoxGeometry(.010,.022,.002),0,.335,.3695,()=>TDGeo.col(0x171b1b),false);
 for(const x of [-.355,.355])for(const s of [-1,1])for(const y of [.10,.35]){const v=[[0,.002,0],[0,-.002,0]],ix=[];for(let k=0;k<6;k++){const a=k*Math.PI/3;v.push([Math.cos(a)*.0085,-.002,Math.sin(a)*.0085]);}for(let k=0;k<6;k++){const a=k+2,b=(k+1)%6+2;ix.push(0,b,a,1,a,b);}const g=mesh(v,ix);g.rotateX(s*Math.PI/2);add(g,x,y,s*.337,iron,false);}
 return build(parts,1919,true);
}});
