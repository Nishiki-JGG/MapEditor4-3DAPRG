// 厚みと反りを持つ乾燥土片。共有データに登録し、保存・Unity書き出しでも同じ形を使う。
(()=>{
 const textureId='dry-clay-grain-v1',canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d'),im=ctx.createImageData(128,128),noise=TDGeo.rng(8701);
 for(let k=0;k<128*128;k++){const v=219+Math.floor(noise()*36);im.data.set([v,v,v,255],k*4);}ctx.putImageData(im,0,0);
 ctx.strokeStyle='rgba(125,110,90,.25)';ctx.lineWidth=.55;
 for(let k=0;k<35;k++){let x=noise()*128,y=noise()*128;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<3;j++){x+=(noise()-.4)*7;y+=(noise()-.5)*7;ctx.lineTo(x,y);}ctx.stroke();}
 TDSharedData.textures.push({id:textureId,width:128,height:128,png:canvas.toDataURL('image/png').split(',')[1],colorSpace:'sRGB',wrap:'repeat',filter:'trilinear',mipmaps:true,anisotropy:4});
 for(let variant=0;variant<3;variant++){
  const id=['drysoil_curl','drysoil_cup','drysoil_flake'][variant],name=['乾いた土片・片反り','乾いた土片・両反り','乾いた土片・割れ片'][variant];
  const R=TDGeo.rng(3081+variant*291),n=variant===2?6:8,P=[],C=[],UV=[],I=[],radius=.23+variant*.025,thickness=.022+variant*.004;
  const color=new THREE.Color().setRGB(.61,.525,.395).convertSRGBToLinear();
  const vertex=(x,y,z,shade)=>{P.push(x,y,z);C.push(color.r*shade,color.g*shade,color.b*shade);UV.push(x/radius*.5+.5,z/radius*.5+.5);return P.length/3-1;};
  const outline=Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2+(R()-.5)*.20,r=radius*(.82+R()*.30);return[Math.cos(a)*r,Math.sin(a)*r];});
  const height=(x,z,t)=>{const side=(x/radius+1)*.5,curve=variant===0?Math.pow(Math.max(0,side),3)*Math.pow(t,2):variant===1?Math.pow(t,3)*(.5+.5*Math.abs(x/radius)):Math.pow(Math.max(0,(z/radius+1)*.5),2)*t;return thickness+.003+.085*curve+(Math.sin(x*17+z*9)*.002)*t;};
  const center=vertex(0,thickness+.003,0,.96),rings=[];
  for(const t of [.28,.55,.80,1])rings.push(outline.map(([x,z])=>vertex(x*t,height(x*t,z*t,t),z*t,.95+.05*t+(R()-.5)*.045)));
  for(let i=0;i<n;i++){const j=(i+1)%n;I.push(center,rings[0][j],rings[0][i]);}
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<n;i++){const j=(i+1)%n;I.push(rings[r][i],rings[r][j],rings[r+1][j],rings[r][i],rings[r+1][j],rings[r+1][i]);}
  const underside=vertex(0,0,0,.56);
  for(let i=0;i<n;i++){
   const j=(i+1)%n,[x,z]=outline[i],[xx,zz]=outline[j],y=height(x,z,1),yy=height(xx,zz,1);
   const a=vertex(x,y,z,.78),b=vertex(xx,yy,zz,.78),c=vertex(xx,Math.max(0,yy-thickness),zz,.53),d=vertex(x,Math.max(0,y-thickness),z,.53);
   I.push(a,b,c,a,c,d,underside,d,c);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
  const heightMax=Math.max(...P.filter((_,i)=>i%3===1));
  TDSharedData.assets.push({id,assetKey:'tdj/'+id,version:1,pivot:[0,0,0],positions:P,normals:Array.from(g.attributes.normal.array),colors:C,uv:UV,triangles:I,material:{texture:textureId,baseColor:[1,1,1,1],lighting:'lambert',alphaCutoff:0,doubleSided:false},groundContact:'central underside touches y=0; raised edges have real thickness'});g.dispose();
  TDProps.add({id,name,r:0,min:.25,sc:[.75,1.15],slope:.18,vis:.38,anyGround:true,tags:['common'],height:heightMax,sharedAsset:id,build(){return TDSharedProps.geometry(id);}});
 }
})();
