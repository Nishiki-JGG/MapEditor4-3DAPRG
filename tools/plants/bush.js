// 24ba292以前の茂みを正本に、葉クラスターの配置・色・5本の枝を継承する。
// 十字板は使わず、分割してふくらませた葉面と同方向の重なりで密度を保つ。
(()=>{
function patch(){const g=new THREE.PlaneGeometry(1,1,2,2),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,.09*(1-4*x*x)*(1-4*y*y)+.025*x*y);}return g;}
function build(){const {rng,col,mixc,clamp,makeGeo,limb,faceOut,ATLAS}=TDGeo,R=rng(14),parts=[],C=[0,.3,0];
 for(let k=0;k<5;k++){const a=k*1.3;limb(parts,[0,0,0],[Math.cos(a)*.45,.5,Math.sin(a)*.4],.04,.015,4,()=>col(0x5a4632));}
 const leaf=(y,ny,Rr,pr,cx,cz)=>mixc(col(0x627a44),col(0xb8c888),clamp(y*1.1+Math.hypot(cx,cz)*.5+(pr-.5)*.25,0,1));
 for(let k=0;k<15;k++){const th=k*2.4+R()*.5,ph=.15+R()*1.25,p=[Math.cos(th)*Math.sin(ph)*.58,.3+Math.cos(ph)*.32,Math.sin(th)*Math.sin(ph)*.52],scale=.7+R()*.3,roll=(R()-.5)*1.4,out=[p[0],p[1]-.15,p[2]],matrix=faceOut(p,out,[0,1,0],scale,roll);
  parts.push({g:patch(),m:matrix,cfn:leaf,uvr:ATLAS.uvr('leaf'),j:.045,sn:C,snw:.85});
  if(k<3){const normal=new THREE.Vector3(...out).normalize(),q=new THREE.Vector3(...p).addScaledVector(normal,-.055),back=faceOut(q.toArray(),out,[0,1,0],scale*.94,roll+.65);parts.push({g:patch(),m:back,cfn:leaf,uvr:ATLAS.uvr('leaf'),j:.045,sn:C,snw:.85});}
 }
 const g=makeGeo(parts,14,{ao:.55,uv:ATLAS.white}),u=g.attributes.uv,stem=new TDNewPlants.MeshRecipe(0).uv('stem');for(let i=0;i<u.count;i++)if(Math.abs(u.getX(i)-ATLAS.white[0])<1e-5&&Math.abs(u.getY(i)-ATLAS.white[1])<1e-5)u.setXY(i,...stem);return g;
}
window.TDBush={build};})();
