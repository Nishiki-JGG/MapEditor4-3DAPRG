// Coopered barrel: the existing shared wood atlas is sampled at stave scale.
TDProps.add({id:'smallbarrel',name:'小樽',r:.29,min:1,sc:[.8,1.2],slope:.18,vis:.32,anyGround:true,tags:['ruins','castle'],height:.72,groundSink:.002,material:'cards2',build(){
 const {mat4,ATLAS2,col,mixc,hash2}=TDGeo,{mesh}=TDSmallParts,{part,build}=TDPracticalParts,p=[],N=12,profile=[[.002,.22],[.12,.245],[.35,.278],[.59,.245],[.70,.22]];
 const wood=(y,ny,R,pr)=>mixc(col(0xc7b596),col(0xf4e4c6),.25+pr*.45),iron=(y,ny,R,pr)=>mixc(col(0x454944),col(0x7d817b),.18+pr*.22);
 function board(g,seed){const a=part(g,undefined,wood,true),q=ATLAS2.uvr('wood'),start=seed%6===0?.20:.02+hash2(seed,91)*.025,span=.10;a.uvr=[q[0]+(q[2]-q[0])*start,q[1],q[0]+(q[2]-q[0])*(start+span),q[3]];a.j=.012;p.push(a);}
 // Each stave has a solid 25mm section, a narrow joint and softened outer arrises.
 for(let j=0;j<N;j++){const a0=j/N*Math.PI*2+.006,a1=(j+1)/N*Math.PI*2-.006,v=[],uv=[],ix=[],S=6;
  for(const[y,r]of profile){for(const[a,rr]of[[a0,r-.004],[a0+.012,r],[a1-.012,r],[a1,r-.004],[a1,r-.025],[a0,r-.025]]){v.push([rr*Math.cos(a),y,rr*Math.sin(a)]);uv.push((a-a0)/(a1-a0),y/.70);}}
  for(let k=0;k<profile.length-1;k++)for(let s=0;s<S;s++){const a=k*S+s,b=k*S+(s+1)%S;ix.push(a,a+S,b,b,a+S,b+S);}for(let s=1;s<S-1;s++)ix.push(0,s,s+1,24,24+s+1,24+s);
  const g=mesh(v,ix);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));board(g,j+20);
 }
 function radius(y){for(let k=1;k<profile.length;k++)if(y<=profile[k][0]){const[a,r]=profile[k-1],[b,s]=profile[k];return r+(s-r)*(y-a)/(b-a);}return .22;}
 // Closed, bevelled iron hoops instead of paper-thin cylinders.
 for(const[y,j]of[[.055,0],[.17,1],[.53,2],[.665,3]]){const ri=radius(y)+.001,ro=ri+.008,section=[[ri,y-.018],[ro,y-.018],[ro,y+.014],[ro-.002,y+.018],[ri,y+.018],[ri,y-.018]];p.push(part(new THREE.LatheGeometry(section.map(([r,y])=>new THREE.Vector2(r,y)),12),undefined,iron));const a=.8+j*.13,g=new THREE.CylinderGeometry(.006,.006,.004,6),m=new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a)*(ro+.001),y,Math.sin(a)*(ro+.001)),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),0,Math.sin(a))),new THREE.Vector3(1,1,1));p.push(part(g,m,iron));}
 // A fitted circular head is recessed inside the staves; its five boards have real seams.
 const circle=Array.from({length:32},(_,k)=>[Math.cos(k/32*Math.PI*2)*.193,Math.sin(k/32*Math.PI*2)*.193]);
 function clip(poly,x,sign){const out=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],ia=(a[0]-x)*sign>=0,ib=(b[0]-x)*sign>=0;if(ia)out.push(a);if(ia!==ib){const t=(x-a[0])/(b[0]-a[0]);out.push([x,a[1]+(b[1]-a[1])*t]);}}return out;}
 for(let k=0;k<5;k++){const x0=-.194+k*.0776+.0012,x1=x0+.0752,q=clip(clip(circle,x0,1),x1,-1),v=[],uv=[],ix=[],n=q.length;for(const y of[.650,.674])for(const[x,z]of q){v.push([x,y,z]);uv.push((x-x0)/(x1-x0),(z+.2)/.4);}for(let j=0;j<n;j++){const h=(j+1)%n;ix.push(j,j+n,h,h,j+n,h+n);}for(let j=1;j<n-1;j++)ix.push(0,j,j+1,n,n+j+1,n+j);const g=mesh(v,ix);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));board(g,60+k);}
 p.push(part(new THREE.CylinderGeometry(.202,.202,.015,12),mat4(0,.020,0,1,1,1),wood,true));
 return build(p,803,true);
}});
