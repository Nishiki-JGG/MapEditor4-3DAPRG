// 静的な採掘ズリ積載版。車体とレール接地は空荷版を再利用する。
window.TDMineCartLoad=(()=>{
 'use strict';
 const id='minecart_loaded';let textureSet,shared;
 function maps(){if(textureSet)return textureSet;const steel=TDMineCart.maps(),spoil=TDMineSpoil.maps(),w=512,h=512,tex=(data,srgb)=>{const t=new THREE.DataTexture(data,w,h);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=2;t.needsUpdate=true;return t;},data={};
  for(const key of ['colour','packed','normal']){data[key]=new Uint8Array(w*h*4);data[key].set(steel[key]);data[key].set(spoil[key],steel[key].length);}
  const mr=new Uint8Array(data.packed);for(let i=0;i<mr.length;i+=4){mr[i+1]=255-data.packed[i+3];mr[i+2]=data.packed[i];}
  return textureSet={w,h,...data,map:tex(data.colour,true),metalRough:tex(mr,false),normalMap:tex(data.normal,false)};
 }
 function material(){if(!shared){const t=maps();shared=TDMineCart.material().clone();shared.name='ore-cart-with-spoil';shared.map=t.map;shared.metalnessMap=shared.roughnessMap=t.metalRough;shared.normalMap=t.normalMap;shared.onBeforeRender=TDMineCart.material().onBeforeRender;}return shared;}
 function geometry(){const body=TDMineCart.geometry(),out={position:Array.from(body.attributes.position.array),normal:Array.from(body.attributes.normal.array),uv:Array.from(body.attributes.uv.array,x=>x)};for(let i=1;i<out.uv.length;i+=2)out.uv[i]*=.5;const bodyVertices=out.position.length/3;body.dispose();
  function add(g,stone=false,offset=0,cx=0,cz=0,cy=1){if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);out.position.push(x,y,z);out.normal.push(n.getX(i),n.getY(i),n.getZ(i));let u,v;if(stone){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));u=ny>=nx&&ny>=nz?x:nx>=nz?z:x;v=ny>=nx&&ny>=nz?z:y;u=.5+(u-(ny>=nx&&ny>=nz?cx:nx>=nz?cz:cx))*.8+offset;v=.5+(v-(ny>=nx&&ny>=nz?cz:cy))*.8;u=(389+u*116)/512;v=(5+v*246)/256;}else{u=(3+(x/1.8+.5)*378)/512;v=(3+(z/2.5+.5)*250)/256;}out.uv.push(u,.5+v*.5);}g.dispose();}
  // 上面だけを見せる密な細粒層。外周を荷台内へ収め、金属の口縁を隠さない。
  const nx=6,nz=8,p=[],uv=[],ix=[];
  const level=(x,z)=>1.00+.10*Math.max(0,1-(x/.44)**2)*Math.max(0,1-(z/.64)**2)+.018*Math.sin(x*19+z*11);
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=(i/nx*2-1)*.433,z=(j/nz*2-1)*.628;p.push(x,level(x,z),z);uv.push(i/nx,j/nz);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+nx+1;ix.push(a,b,a+1,a+1,b,b+1);}
  const bed=new THREE.BufferGeometry();bed.setAttribute('position',new THREE.Float32BufferAttribute(p,3));bed.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));bed.setIndex(ix);add(bed);
  // 角張った破片は少数。押し潰れた楔と板状片を混ぜ、均等な球や宝石にしない。
  const rocks=[[-.17,-.28,.21,.13,.22,.24],[.19,.09,.17,.105,.23,-.65],[-.19,.30,.18,.085,.15,.95],[.22,-.38,.105,.065,.12,.3],[.03,.46,.12,.055,.10,-.3],[-.30,.02,.085,.052,.11,.7],[.02,-.03,.12,.075,.13,.2],[.31,.39,.065,.045,.09,.1],[-.23,-.51,.075,.045,.075,.4]];
  rocks.forEach((s,k)=>{const [cx,cz,sx,sy,sz,angle]=s,c=Math.cos(angle),sn=Math.sin(angle),pos=[],top=[],bottom=[],ix=[],cy=level(cx,cz);
   for(let j=0;j<5;j++){const a=j*Math.PI*2/5+.1*Math.sin(k+j*2),rr=.82+.16*Math.sin(k*1.7+j*2.4),x=Math.cos(a)*rr,z=Math.sin(a)*rr;bottom.push([x*1.04,-.48,z*1.04]);top.push([x*.85+.06*Math.sin(k),.5+.29*x-.18*z-(j===k%5?.24:0),z*.90]);}
   for(const [x,y,z]of [...bottom,...top])pos.push(cx+(x*sx*c+z*sz*sn),cy+y*sy,cz+(-x*sx*sn+z*sz*c));
   for(let j=0;j<5;j++){const n=(j+1)%5;ix.push(j,j+5,n,n,j+5,n+5);}for(let j=1;j<4;j++){ix.push(0,j,(j+1));ix.push(5,5+j+1,5+j);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);add(g,true,((k%3)-1)*.08,cx,cz,cy);
  });
  const g=new THREE.BufferGeometry();for(const key of Object.keys(out))g.setAttribute(key,new THREE.Float32BufferAttribute(out[key],key==='uv'?2:3));g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(out.position.length).fill(1),3));g.setAttribute('glow',new THREE.Float32BufferAttribute(new Float32Array(out.position.length/3),1));g.setIndex(Array.from({length:out.position.length/3},(_,i)=>i));g.userData.cartBodyVertices=bodyVertices;g.computeBoundingBox();g.computeBoundingSphere();return g;
 }
 function png(data){const c=document.createElement('canvas');c.width=512;c.height=512;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),512,512),0,0);return c.toDataURL('image/png').split(',')[1];}
 function exportData(types){const t=maps();return{version:1,units:'metres',axes:'Unity X/Y/Z',railCentres:.84,runningHeight:.14,textures:{width:512,height:512,colour:png(t.colour),packed:png(t.packed),normal:png(t.normal)},assets:types.filter(t=>t.id===id&&t.assetKey==='tdj/'+id).map(t=>({id,assetKey:t.assetKey,radius:t.r,height:t.height,shape:!!t.shape,groundSink:0,material:'mineCart',...(!t.shape&&t.r>0?{circleColliders:(t.offs||[[0,0]]).map(o=>({center:[o[0],0,-o[1]],radius:t.r,height:t.height}))}:{}),...TDSmallPropExport.geometry(t.geo)}))};}
 TDProps.add({id,name:'採掘ズリ積載トロッコ',r:.85,collisionGeo:new THREE.BoxGeometry(1.08,1.12,1.78).translate(0,.535,0),height:1.12,groundSink:0,min:2,sc:[1,1],slope:.1,vis:1,anyGround:true,manualOnly:true,shape:true,tags:['cave','ruins'],material:'mineCart',mineCart:true,mineCartLoad:true,build:geometry});
 return{id,maps,material,geometry,export:exportData};
})();
