// 人の使う坑道・遺跡の静的小物。既存の材質・木目と小物部品を共用する。
window.TDPracticalParts=(()=>{
 const {col,mixc,mat4,makeGeo,ATLAS2}=TDGeo,{mesh,tube,rings}=TDSmallParts;
 const wood=(y,ny,R,pr)=>mixc(col(0xd4c6ac),col(0xffefcf),.22+pr*.55);
 const iron=(y,ny,R)=>mixc(col(0x3b3d3c),col(0x72716a),.2+R()*.35);
 const fibre=(y,ny,R,pr)=>mixc(col(0x8e7851),col(0xc1aa79),.25+pr*.45);
 const clay=(y,ny,R,pr)=>mixc(col(0x84543a),col(0xba8257),.25+pr*.45);
 const part=(g,m=mat4(0,0,0,1,1,1),cfn=wood,textured=false)=>({g,m,cfn,j:.025,...(textured?{uvr:ATLAS2.uvr('wood')}:{})});
 const build=(p,seed,textured=false)=>makeGeo(p,seed,{ao:.10,smooth:42,...(textured?{uv:ATLAS2.white}:{})});
 const count=g=>g.index?g.index.count:g.attributes.position.count;
 function grounded(p,seed,groups,textured=false){const g=build(p,seed,textured),starts=[0];p.forEach(a=>starts.push(starts.at(-1)+count(a.g)));g.userData.groundParts=groups.map(([id,first,end,pivot])=>({id,first:starts[first],count:starts[end]-starts[first],pivot}));return g;}
 function barrel(){
  const p=[],profile=[[.02,.22],[.12,.245],[.35,.278],[.59,.245],[.70,.22]],N=12;
  for(let j=0;j<N;j++){
   const v=[],uv=[],ix=[];for(const[y,r]of profile)for(const a of [j/N*6.283185307,(j+1)/N*6.283185307]){v.push([r*Math.cos(a),y,r*Math.sin(a)]);uv.push(0,y/.70);}
   for(let k=0;k<profile.length-1;k++){let a=k*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}const g=mesh(v,ix);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv.map((v,i)=>i%2?v:((i/2)%2)),2));p.push(part(g,undefined,wood,true));
  }
  for(const[y,r]of [[.055,.233],[.17,.260],[.53,.260],[.665,.233]])p.push(part(new THREE.CylinderGeometry(r,r,.035,12,1,true),mat4(0,y,0,1,1,1),iron));
  // 円に収まる5枚の蓋板。木口を鉄輪で囲み、細い隙間を残す。
  for(let k=-2;k<=2;k++){const x=k*.081,w=.077,z=Math.sqrt(.216*.216-(Math.abs(x)+w/2)**2);p.push(part(new THREE.BoxGeometry(w,.026,z*2),mat4(x,.692,0,1,1,1),wood,true));}
  p.push(part(new THREE.CylinderGeometry(.215,.215,.018,12),mat4(0,.024,0,1,1,1),wood,true));return p;
 }
 const vesselProfile=[[0,.03],[.12,0],[.18,.03],[.26,.14],[.29,.32],[.25,.48],[.16,.55],[.15,.68],[.17,.70],[.17,.73],[.135,.73],[.125,.68],[.125,.56],[.21,.46],[.245,.32],[.21,.16],[.12,.07],[0,.07]];
 function vessel(){return new THREE.LatheGeometry(vesselProfile.map(([r,y])=>new THREE.Vector2(r,y)),12);}
 function brokenVessel(){
  const N=12,v=[],ix=[],top=[.32,.38,.29,.35,.26,.34,.42,.37,.28,.31,.40,.35];
  // 厚みのある割れ口、内壁、底を連続する1個の下半身。破片で穴を隠さない。
  for(let j=0;j<N;j++){const a=j/N*Math.PI*2,h=top[j],r=.29-(h-.32)*.18;for(const[rr,y]of [[.12,0],[.18,.03],[r,h],[r-.035,h-.008],[.21,.12],[.12,.065]])v.push([rr*Math.cos(a),y,rr*Math.sin(a)]);}
  for(let j=0;j<N;j++)for(let k=0;k<5;k++){const a=j*6+k,b=((j+1)%N)*6+k;ix.push(a,a+1,b,b,a+1,b+1);}const b=v.length;v.push([0,0,0],[0,.065,0]);for(let j=0;j<N;j++){const n=(j+1)%N;ix.push(b,n*6,j*6,b+1,j*6+5,n*6+5);}return mesh(v,ix);
 }
 return{wood,iron,fibre,clay,part,build,grounded,barrel,vessel,brokenVessel};
})();
