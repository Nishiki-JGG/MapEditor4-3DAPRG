// 細葉の草。既存の草の曲げ方・共有 atlas を再利用した不透明な細い葉。
(() => {
 const P=[],C=[],UV=[],I=[],R=TDGeo.rng(8621);
 for(let blade=0;blade<30;blade++){
  const angle=blade*2.399963+(R()-.5),dx=Math.cos(angle),dz=Math.sin(angle),sx=-dz,sz=dx;
  const baseR=Math.sqrt(R())*.30,bx=dx*baseR,bz=dz*baseR,h=.23+R()*.30,reach=.08+R()*.23,width=.008+R()*.009;
  const base=P.length/3,col=new THREE.Color().setHSL(.20+R()*.035,.40+R()*.13,.31+R()*.12);
  for(let j=0;j<4;j++){
   const t=j/3,w=j===3?0:width*(1-t*.7),x=bx+dx*reach*t*t,z=bz+dz*reach*t*t,y=h*t*(1-.23*t);
   for(const side of (j===3?[0]:[-1,1])){P.push(x+sx*w*side,y,z+sz*w*side);const shade=.65+.35*t;C.push(col.r*shade,col.g*shade,col.b*shade);UV.push(.875,.25);}
  }
  for(let j=0;j<3;j++){const a=base+j*2;I.push(a,a+2,a+1);if(j<2)I.push(a+1,a+2,a+3);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
 const height=Math.max(...P.filter((_,i)=>i%3===1));
 TDSharedData.assets.push({id:'meadowgrass',assetKey:'tdj/meadowgrass',version:1,pivot:[0,0,0],positions:P,normals:Array.from(g.attributes.normal.array),colors:C,uv:UV,triangles:I,material:{texture:'ground-plants-atlas-v1',baseColor:[1,1,1,1],lighting:'lambert',alphaCutoff:0,doubleSided:true},wind:{minY:.025,maxY:height,maxDisplacementMetres:.045,uvMin:-1},groundContact:'ground pivot, minimum Y=0'});
 g.dispose();TDProps.add({id:'meadowgrass',name:'細葉の草',r:0,min:.3,sc:[.65,1.2],slope:.55,vis:.5,sway:0,tags:['grassland','forest'],height,touch:true,material:'shared',sharedAsset:'meadowgrass',build(){return TDSharedProps.geometry('meadowgrass');}});
})();
