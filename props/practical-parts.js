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
 // 底・胴・肩・首・口縁の幅を維持し、肩の折れを連続した曲率へ配分する。
 // A rolled lip, continuous shoulder and hollow foot retain the original envelope.
 const vesselProfile=[[0,.03],[.116,.002],[.139,.008],[.149,.024],[.153,.044],[.18,.070],[.22,.135],[.257,.205],[.281,.275],[.289,.325],[.279,.397],[.255,.455],[.218,.503],[.181,.537],[.157,.562],[.149,.596],[.149,.674],[.155,.692],[.168,.704],[.170,.716],[.165,.727],[.151,.730],[.139,.724],[.132,.711],[.128,.687],[.126,.602],[.137,.565],[.166,.543],[.198,.513],[.232,.462],[.257,.396],[.266,.326],[.258,.277],[.235,.210],[.201,.145],[.157,.094],[.112,.071],[0,.071]];
 function vessel(){return new THREE.LatheGeometry(vesselProfile.map(([r,y])=>new THREE.Vector2(r,y)),24);}
 function brokenVessel(){
  const N=24,v=[],ix=[],top=[.35,.365,.346,.322,.307,.255,.195,.183,.212,.299,.363,.394,.42,.406,.382,.362,.344,.333,.337,.352,.377,.388,.373,.355];
  // A few deep fractures, small secondary chips and a lighter solid section, not a sawtooth rim.
  for(let j=0;j<N;j++){
   const a=j/N*Math.PI*2,h=top[j],r=.29-Math.abs(h-.31)*.16,t=.026+.004*Math.sin(j*1.7),chip=[4,7,16].includes(j)?.007:0;
   const rings=[[.12,0],[.176,.028],[.220,.09],[.25,.16],[r-.004,h-.016],[r-chip,h],[r-t,h-.004],[r-t-.003,h-.020],[.223,.164],[.196,.10],[.12,.065]];
   for(const[rr,y]of rings)v.push([rr*Math.cos(a),y,rr*Math.sin(a)]);
  }
  for(let j=0;j<N;j++)for(let k=0;k<10;k++){const a=j*11+k,b=((j+1)%N)*11+k;ix.push(a,a+1,b,b,a+1,b+1);}const b=v.length;v.push([0,0,0],[0,.065,0]);for(let j=0;j<N;j++){const n=(j+1)%N;ix.push(b,j*11,n*11,b+1,n*11+10,j*11+10);}return mesh(v,ix);
 }
 function ceramic(parts,seed){
  // Remove the shared helper's directional colour bake: illumination comes from real normals.
  parts=parts.map(p=>({...p,j:0}));const g=makeGeo(parts,seed,{ao:.055,smooth:55}),pos=g.attributes.position,c=g.attributes.color,uv=new Float32Array(pos.count*2),q=ATLAS2.uvr('clay'),dark=col(0x9a684a),light=col(0xc49771);
  for(let i=0;i<pos.count;i+=3){
   const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),v=new THREE.Vector3().fromBufferAttribute(pos,i+2),n=b.sub(a).cross(v.sub(a)).normalize(),angles=[];
   for(let j=i;j<i+3;j++)angles.push(Math.atan2(pos.getZ(j),pos.getX(j))/(Math.PI*2)+.5);if(Math.max(...angles)-Math.min(...angles)>.5)for(let k=0;k<3;k++)if(angles[k]<.5)angles[k]+=1;
   for(let j=i;j<i+3;j++){const x=pos.getX(j),y=pos.getY(j),z=pos.getZ(j),rad=Math.hypot(x,z),wave=Math.sin(x*9+z*5+.7)*Math.cos(y*6-z*4),firing=.46+.13*wave,shade=.84+.16*Math.min(1,y/.075),base=mixc(dark,light,firing),inside=n.x*x+n.z*z<-.04,fracture=seed===807&&y>.17&&n.y>.55,lip=seed===806&&y>.695;
    for(let k=0;k<3;k++)base[k]*=shade*(inside?.83:1)*(fracture?1.23:lip?1.06:1);c.setXYZ(j,...base);
    const u=angles[j-i]%1,vt=y/.76;uv[j*2]=q[0]+(q[2]-q[0])*(.025+u*.95);uv[j*2+1]=q[1]+(q[3]-q[1])*(.025+vt*.95);
   }
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
 }
 return{wood,iron,fibre,clay,part,build,grounded,barrel,vessel,brokenVessel,ceramic};
})();
