// 人間型の遺骨の形状部品。画像ではなく眼窩・頬骨・下顎と関節端を造形する。
window.TDAnatomy=(()=>{
 const {mesh,tube}=TDSmallParts,{mat4,col,mixc}=TDGeo;
 const bone=(y,ny,R,pr)=>mixc(col(0xc2bba5),col(0xe4dcc6),.35+pr*.35);
 const add=(p,g,m,cfn=bone)=>p.push({g,m,cfn,j:.014});
 function skull(parent,scale=1){
  const p=[],m=parent.clone().multiply(new THREE.Matrix4().makeScale(scale,scale,scale)),v=[],ix=[],N=10,levels=[[-.035,.047,.058],[0,.073,.087],[.048,.084,.098],[.095,.076,.085],[.131,.048,.055],[.145,.004,.006]];
  levels.forEach(([y,rx,rz])=>{for(let j=0;j<N;j++){const a=j/N*Math.PI*2;v.push([Math.cos(a)*rx,y,Math.sin(a)*rz-.021]);}});
  for(let k=0;k<levels.length-1;k++)for(let j=0;j<N;j++){const a=k*N+j,b=k*N+(j+1)%N,c=a+N,d=b+N;if((v[a][2]+v[b][2])/2>.018&&levels[k][0]<.043)continue;ix.push(a,c,b,b,c,d);}add(p,mesh(v,ix),m);
  const outline=[[-.035,.083],[-.061,.066],[-.078,.035],[-.078,.004],[-.063,-.030],[-.034,-.059],[-.031,-.071],[.031,-.071],[.034,-.059],[.063,-.030],[.078,.004],[.078,.035],[.061,.066],[.035,.083]],holes=[];
  for(const side of [-1,1]){const h=[];for(let j=0;j<8;j++){const a=-j/8*Math.PI*2;h.push([side*.038+Math.cos(a)*.026,.013+Math.sin(a)*.024]);}holes.push(h);}holes.push([[-.012,-.046],[.012,-.046],[0,-.011]]);
  const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));holes.forEach(h=>shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...p)))));let face=new THREE.ShapeGeometry(shape).toNonIndexed();
  // Subdivide the facial surface once so cheek, brow and maxilla have actual depth.
  const f=face.attributes.position,pv=[];for(let i=0;i<f.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(f,i),b=new THREE.Vector3().fromBufferAttribute(f,i+1),c=new THREE.Vector3().fromBufferAttribute(f,i+2),ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);for(const p of (Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))>.045?[a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca]:[a,b,c]))pv.push(p.x,p.y,p.z);}face.dispose();face=new THREE.BufferGeometry();face.setAttribute('position',new THREE.Float32BufferAttribute(pv,3));const pos=face.attributes.position;
  const front=(x,y)=>.074-Math.abs(x)*.17+Math.max(0,-y-.03)*.55-Math.pow(Math.max(0,y-.025),2)*7+.012*Math.exp(-Math.pow((Math.abs(x)-.04)/.03,2)-Math.pow((y-.042)/.02,2));
  for(let i=0;i<pos.count;i++)pos.setZ(i,front(pos.getX(i),pos.getY(i)));add(p,face,m);
  const sideV=[...outline.map(([x,y])=>[x,y,front(x,y)]),...outline.map(([x,y])=>[x*.97,y,-.006])],sideI=[];for(let j=0;j<outline.length;j++){const n=(j+1)%outline.length,k=outline.length;sideI.push(j,j+k,n,n,j+k,n+k);}add(p,mesh(sideV,sideI),m);
  holes.forEach((h,k)=>{const cx=h.reduce((n,p)=>n+p[0]/h.length,0),cy=h.reduce((n,p)=>n+p[1]/h.length,0),q=[...h.map(([x,y])=>[x,y,front(x,y)]),...h.map(([x,y])=>[cx+(x-cx)*.70,cy+(y-cy)*.70,k===2?.057:.039])],idx=[];for(let i=0;i<h.length;i++){const j=(i+1)%h.length;idx.push(i,h.length+i,j,j,h.length+i,h.length+j);}add(p,mesh(q,idx),m);const back=q.slice(h.length);back.push([cx,cy,.023]);const fan=[];for(let j=0;j<h.length;j++)fan.push(h.length,j,(j+1)%h.length);add(p,mesh(back,fan),m,(y,ny,R,pr)=>mixc(bone(y,ny,R,pr),col(0x796f58),.36));});
  for(const s of [-1,1])add(p,tube([[s*.056,-.031,.080],[s*.078,-.020,.044],[s*.077,-.010,-.018]],[.007,.008,.008],4),m);
  add(p,tube([[-.035,-.065,.082],[0,-.065,.105],[.035,-.065,.082]],[.012,.014,.012],5,.65),m);
  add(p,tube([[-.064,-.008,.001],[-.062,-.064,.038],[-.040,-.098,.083],[0,-.106,.102],[.040,-.098,.083],[.062,-.064,.038],[.064,-.008,.001]],[.008,.011,.013,.015,.013,.011,.008],5,.7),m);
  for(const lower of [false,true])for(let j=0;j<8;j++){const x=(j-3.5)*.008,z=.108-Math.pow(x/.035,2)*.013;add(p,new THREE.BoxGeometry(.0072,lower?.010:.012,.009),m.clone().multiply(mat4(x,lower?-.085:-.073,z,1,1,1,-x*3)));}
  return p;
 }
 function limb(a,b,kind='femur'){
  const p=[],A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),axis=B.clone().sub(A),L=axis.length(),up=axis.clone().normalize(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up),m=new THREE.Matrix4().compose(A,q,new THREE.Vector3(1,1,1));
  const pts=[[0,.03,0],[.005,L*.22,.004],[.009,L*.48,.008],[.005,L*.74,.004],[0,L-.025,0]],r=kind==='tibia'?[.024,.014,.011,.014,.027]:[.022,.013,.012,.014,.024];add(p,tube(pts,r,6,kind==='tibia'?.75:1),m);
  if(kind==='femur'){add(p,tube([[0,L-.028,0],[-.024,L-.002,0],[-.041,L+.010,0]],[.016,.014,.017],5),m);add(p,new THREE.SphereGeometry(.027,8,5),m.clone().multiply(mat4(-.045,L+.012,0,1,1,1)));for(const s of [-1,1])add(p,new THREE.SphereGeometry(.023,7,4),m.clone().multiply(mat4(s*.016,.019,0,1,1,1.15)));}
  else{add(p,new THREE.SphereGeometry(1,8,4),m.clone().multiply(mat4(0,L-.010,0,.033,.021,.021)));add(p,tube([[.015,.020,0],[.026,-.005,.003]],[.013,.011],5),m);}
  return p;
 }
 function rib(points,r=.009){const c=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));return tube(c.getPoints(6).map(v=>v.toArray()),Array(7).fill(r),6,.65);}
 function faceUp(x,y,z,yaw=0,roll=.25){const b=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0));b.premultiply(new THREE.Matrix4().makeRotationX(roll));b.premultiply(new THREE.Matrix4().makeRotationY(yaw));b.setPosition(x,y,z);return b;}
 return{bone,skull,limb,rib,faceUp};
})();
