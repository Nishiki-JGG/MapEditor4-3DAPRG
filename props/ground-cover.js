// 既存共有 atlas を使う短草と林床の落ち葉。寸法は m、接地 pivot は原点。
(() => {
 function register(id,name,seed,build,wind){
  const P=[],C=[],UV=[],I=[],R=TDGeo.rng(seed);
  const vertex=(x,y,z,c)=>{P.push(x,y,z);C.push(c.r,c.g,c.b);UV.push(.875,.25);return P.length/3-1;};
  build({R,vertex,I});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
  const height=Math.max(...P.filter((_,i)=>i%3===1));
  TDSharedData.assets.push({id,assetKey:'tdj/'+id,version:1,pivot:[0,0,0],positions:P,normals:Array.from(g.attributes.normal.array),colors:C,uv:UV,triangles:I,material:{texture:'ground-plants-atlas-v1',baseColor:[1,1,1,1],lighting:'lambert',alphaCutoff:0,doubleSided:true},...(wind?{wind:{minY:.01,maxY:height,maxDisplacementMetres:.016,uvMin:-1}}:{}),groundContact:'ground pivot, minimum Y=0'});
  g.dispose();TDProps.add({id,name,r:0,min:.25,sc:[.7,1.15],slope:.45,vis:.6,sway:0,tags:['grassland','forest'],height,touch:!!wind,material:'shared',sharedAsset:id,build(){return TDSharedProps.geometry(id);}});
 }
 register('shortgrass','短草の群れ',1357,({R,vertex,I})=>{
  for(let b=0;b<48;b++){
   const a=b*2.399963+R()*.8,dx=Math.cos(a),dz=Math.sin(a),r=Math.sqrt(R())*.43,x=dx*r,z=dz*r,h=.07+R()*.15,w=.012+R()*.012,lean=.05+R()*.12;
   const c=new THREE.Color().setHSL(.205+R()*.045,.42+R()*.15,.29+R()*.13),root=c.clone().multiplyScalar(.67),mid=c.clone().multiplyScalar(.88);
   const k=vertex(x-dz*w,0,z+dx*w,root);vertex(x+dz*w,0,z-dx*w,root);
   vertex(x+dx*lean*.4-dz*w*.6,h*.7,z+dz*lean*.4+dx*w*.6,mid);vertex(x+dx*lean*.4+dz*w*.6,h*.7,z+dz*lean*.4-dx*w*.6,mid);
   vertex(x+dx*lean,h,z+dz*lean,c);I.push(k,k+2,k+1,k+1,k+2,k+3,k+2,k+4,k+3);
  }
 },true);
 register('groundlitter','落ち葉と小枝',5841,({R,vertex,I})=>{
  for(let b=0;b<13;b++){
   const a=R()*6.283,dx=Math.cos(a),dz=Math.sin(a),x=(R()-.5)*.85,z=(R()-.5)*.85,l=.045+R()*.06,w=l*(.35+R()*.15),c=new THREE.Color().setHSL(.075+R()*.055,.29+R()*.15,.22+R()*.16);
   const k=vertex(x-dx*l,0,z-dz*l,c);vertex(x-dz*w,.008,z+dx*w,c.clone().multiplyScalar(.85));vertex(x+dx*l,.003,z+dz*l,c);vertex(x+dz*w,.005,z-dx*w,c.clone().multiplyScalar(.9));vertex(x,.018,z,c.clone().multiplyScalar(1.08));I.push(k,k+1,k+4,k+1,k+2,k+4,k+2,k+3,k+4,k+3,k,k+4);
  }
  for(let b=0;b<2;b++){
   const x=(R()-.5)*.5,z=(R()-.5)*.5,a=R()*6.283,dx=Math.cos(a),dz=Math.sin(a),l=.12+R()*.1,w=.008,c=new THREE.Color(0x796048),k=vertex(x-dx*l-dz*w,.003,z-dz*l+dx*w,c);
   vertex(x+dx*l-dz*w,.003,z+dz*l+dx*w,c);vertex(x+dx*l,.017,z+dz*l,c.clone().multiplyScalar(1.2));vertex(x-dx*l,.017,z-dz*l,c);vertex(x+dx*l+dz*w,.003,z+dz*l-dx*w,c);vertex(x-dx*l+dz*w,.003,z-dz*l-dx*w,c);I.push(k,k+1,k+2,k,k+2,k+3,k+3,k+2,k+4,k+3,k+4,k+5);
  }
 },false);
})();
