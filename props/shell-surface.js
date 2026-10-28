// One shared 128px opaque atlas: organic granules on the left, radial growth on the right.
(()=>{const base=TDSmallPropSurface,key='shore-shell-grain-v1',cache=new WeakMap();let value;
 function get(){if(value)return value;const size=128,c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d'),im=x.createImageData(size,size),{hash2}=TDGeo;
  for(let y=0;y<size;y++)for(let i=0;i<size;i++){const u=i/size,v=y/size,h=hash2(i+143,y+71);let a;
   if(u<.5){const cell=5,ix=Math.floor(i/cell),iy=Math.floor(y/cell),cx=ix*cell+1+hash2(ix+9,iy)*3,cy=iy*cell+1+hash2(ix,iy+12)*3,d=Math.hypot(i-cx,y-cy);a=.91+.045*Math.cos(v*15+u*21)+(d<.8?.08:d<1.5?-.08:0)+(h-.5)*.035;}
   else {const angle=((u-.52)/.46-.5)*2.6,t=(v-.02)/.96,rib=.5+.5*Math.cos(angle*12),growth=Math.sin(t*95+Math.sin(angle*3)*.65);a=.91+.07*rib+(growth>.85?-.06:0)+(h-.5)*.02;}
   const b=Math.max(0,Math.min(255,Math.round(a*255))),q=(y*size+i)*4;im.data[q]=b;im.data[q+1]=b;im.data[q+2]=b;im.data[q+3]=255;
  }x.putImageData(im,0,0);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=2;value={texture,descriptor:{id:key,width:size,height:size,png:c.toDataURL('image/png').split(',')[1],colorSpace:'sRGB',filter:'trilinear',mipmaps:true,wrap:'clamp'}};return value;}
 function material(source){if(!cache.has(source)){const m=source.clone();m.map=get().texture;m.flatShading=false;m.defines={...source.defines};delete m.defines.DETAIL;delete m.defines.DETAIL_K;m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=()=>source.customProgramCacheKey()+'/'+key;cache.set(source,m);}return cache.get(source);}
 window.TDSmallPropSurface={...base,material:(m,id)=>id===key?material(m):base.material(m,id),export:id=>id===key?{...get().descriptor}:base.export(id)};
})();
