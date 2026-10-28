// Low shoreline cluster: five continuous rounded arms and four ribbed valves.
TDProps.add({
 id:'shells',name:'貝殻・ヒトデ',r:0,min:.6,sc:[.8,1.6],slope:.7,vis:.35,anyGround:true,
 tags:['beach'],height:.03,groundSink:.001,surface:'shore-shell-grain-v1',
 build(){
  const {rng,col,mixc}=TDGeo,R=rng(74),P=[],N=[],C=[],UV=[],parts=[];
  function vertex(p,n,c,uv){P.push(...p);N.push(...n);C.push(...c);UV.push(...uv);}
  function tri(a,b,c,colour,uvfn,normal){let vs=[a,b,c],n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a))).normalize();if(n.lengthSq()<.1)return;for(const p of vs)vertex(p,normal?normal(p):n.toArray(),typeof colour==='function'?colour(p):colour,uvfn(p));}
  const orange=col(0xda754c),rim=col(0xe99563),base=col(0xb95d3d),TAU=Math.PI*2;
  const radius=a=>.047+.123*Math.pow((1+Math.cos(a*5))*.5,2.1);
  const top=(a,t)=>[Math.cos(a)*radius(a)*t,.004+.026*Math.pow(Math.max(0,1-t*t),.8),Math.sin(a)*radius(a)*t];
  const starUV=p=>[(p[0]/.35+.5)*.48+.01,p[2]/.35+.5];
  const starColor=p=>mixc(orange,rim,.18+.24*Math.min(1,Math.hypot(p[0],p[2])/.17));
  function starNormal(p){const a=Math.atan2(p[2],p[0]),t=Math.hypot(p[0],p[2])/radius(a);if(t<.0001)return[0,1,0];const u=new THREE.Vector3(...top(a+.001,t)).sub(new THREE.Vector3(...top(a-.001,t))),v=new THREE.Vector3(...top(a,Math.min(.9999,t+.001))).sub(new THREE.Vector3(...top(a,Math.max(0,t-.001))));const n=u.cross(v).normalize();if(n.y<0)n.negate();return n.toArray();}
  for(let k=0;k<5;k++){const first=P.length/3;for(let i=0;i<12;i++){const a=(k-.5+i/12)*TAU/5,b=(k-.5+(i+1)/12)*TAU/5;
   for(let j=0;j<3;j++){const A=top(a,j/3),B=top(b,j/3),D=top(a,(j+1)/3),E=top(b,(j+1)/3);tri(A,B,D,starColor,starUV,starNormal);tri(B,E,D,starColor,starUV,starNormal);}
   const A=top(a,1),B=top(b,1),D=[A[0],.001,A[2]],E=[B[0],.001,B[2]];tri(A,B,D,base,starUV);tri(B,E,D,base,starUV);tri([0,.001,0],D,E,base,starUV);
  }parts.push({id:'starfish'+k,joint:'starfish',first,count:P.length/3-first,pivot:[0,0,0]});}
  for(let k=0;k<4;k++){const x=.3+R()*.4-.2,z=(R()-.5)*.5,angle=R()*3,tint=R(),first=P.length/3,cream=mixc(col(0xf1e3cf),col(0xeab8a0),tint),groove=mixc(cream,col(0xb88e71),.25),ca=Math.cos(angle),sa=Math.sin(angle),nA=18,nR=4;
   const local=(a,t)=>{const rad=.073*t*(1+.025*Math.cos(a*12)*t),rib=.0018*(.5+.5*Math.cos(a*12))*Math.sin(Math.PI*t);return[Math.sin(a)*rad,.003+.024*Math.sin(Math.PI*t*.85)+rib,-Math.cos(a)*rad+.029];};
   const world=p=>[x+ca*p[0]+sa*p[2],p[1],z-sa*p[0]+ca*p[2]],unworld=p=>{const dx=p[0]-x,dz=p[2]-z;return[ca*dx-sa*dz,p[1],sa*dx+ca*dz];};
   const uv=p=>{const q=unworld(p),a=Math.hypot(q[0],q[2]-.029)<1e-8?0:Math.atan2(q[0],-(q[2]-.029)),t=Math.hypot(q[0],q[2]-.029)/.075;return[.52+(a/2.6+.5)*.46,.02+t*.96];};
   const normal=p=>{const q=unworld(p),a=Math.atan2(q[0],-(q[2]-.029)),t=Math.min(1,Math.hypot(q[0],q[2]-.029)/(.073*(1+.025*Math.cos(a*12))));if(t<.001)return[0,1,0];const u=new THREE.Vector3(...world(local(a+.001,t))).sub(new THREE.Vector3(...world(local(a-.001,t)))),v=new THREE.Vector3(...world(local(a,t+.001))).sub(new THREE.Vector3(...world(local(a,t-.001))));const n=u.cross(v).normalize();if(n.y<0)n.negate();return n.toArray();};
   for(let i=0;i<nA;i++){const a=-1.3+i/nA*2.6,b=-1.3+(i+1)/nA*2.6;for(let j=0;j<nR;j++){const A=world(local(a,j/nR)),B=world(local(b,j/nR)),D=world(local(a,(j+1)/nR)),E=world(local(b,(j+1)/nR));tri(A,B,D,cream,uv,normal);tri(B,E,D,cream,uv,normal);}const A=world(local(a,1)),B=world(local(b,1)),D=[A[0],.001,A[2]],E=[B[0],.001,B[2]];tri(A,B,D,groove,uv);tri(B,E,D,groove,uv);tri(world([0,.001,.029]),D,E,groove,uv);}
   for(const a of[-1.3,1.3]){const A=world(local(a,0)),B=world(local(a,1)),D=[A[0],.001,A[2]],E=[B[0],.001,B[2]];if(a<0){tri(A,B,D,groove,uv);tri(B,E,D,groove,uv);}else{tri(A,D,B,groove,uv);tri(B,D,E,groove,uv);}}
   parts.push({id:'shell'+k,first,count:P.length/3-first,pivot:[x,0,z]});
  }
  const g=new THREE.BufferGeometry();for(const[name,v,n]of[['position',P,3],['normal',N,3],['color',C,3],['uv',UV,2]])g.setAttribute(name,new THREE.Float32BufferAttribute(v,n));g.userData.groundParts=parts;g.userData.rigidGroundJoints=['starfish'];return g;
 }
});
