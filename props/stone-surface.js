// Object-local stone grain. One opaque 128px map, shared only by opted-in props.
// The same generated pixels and metric UVs are included in the Native sidecar.
window.TDSmallPropSurface=(()=>{
  const id='grave-stone-grain-v1',size=128,materials=new WeakMap();let surface;
  function get(key){
    if(key!==id)throw Error('Unknown small prop surface: '+key);
    if(surface)return surface;
    const {hash2}=TDGeo,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size);let mean=0;
    const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v),h=(a,b)=>hash2((a%4+4)%4,(b%4+4)%4),a=h(ix,iy),b=h(ix+1,iy),c=h(ix,iy+1),d=h(ix+1,iy+1);return a+(b-a)*s+(c-a)*t+(a-b-c+d)*s*t;};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const h=hash2(x+107,y+53),cloud=noise(x/32,y/32),value=Math.max(194,Math.min(255,Math.round(239+(h-.5)*22+(cloud-.5)*28-(h<.035?26:0)+(h>.985?9:0)))),i=(y*size+x)*4;
      image.data[i]=image.data[i+1]=image.data[i+2]=value;image.data[i+3]=255;
      const s=value/255;mean+=s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);
    }
    ctx.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=2;
    surface={texture,mean:mean/(size*size),descriptor:{id,width:size,height:size,png:canvas.toDataURL('image/png').split(',')[1],colorSpace:'sRGB',filter:'trilinear',mipmaps:true,wrap:'repeat'}};return surface;
  }
  function apply(geometry){
    const p=geometry.attributes.position,c=geometry.attributes.color,uv=new Float32Array(p.count*2),mean=get(id).mean;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3(),n=new THREE.Vector3();
    for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);d.fromBufferAttribute(p,i+2);n.crossVectors(b.sub(a),d.sub(a));const x=Math.abs(n.x),y=Math.abs(n.y),z=Math.abs(n.z),axis=y>x&&y>z?1:x>z?0:2;
      for(let j=i;j<i+3;j++){uv[j*2]=(axis===0?p.getZ(j):p.getX(j))/.32+7.37;uv[j*2+1]=(axis===1?p.getZ(j):p.getY(j))/.32+4.11;c.setXYZ(j,c.getX(j)/mean,c.getY(j)/mean,c.getZ(j)/mean);}
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
  }
  function material(base,key){let cache=materials.get(base);if(!cache){cache=new Map();materials.set(base,cache);}if(!cache.has(key)){const m=base.clone();m.map=get(key).texture;m.flatShading=false;m.defines={...base.defines};delete m.defines.DETAIL;delete m.defines.DETAIL_K;m.onBeforeCompile=base.onBeforeCompile;m.customProgramCacheKey=()=>base.customProgramCacheKey()+'/surface/'+key;cache.set(key,m);}return cache.get(key);}
  return{apply,material,export:key=>({...get(key).descriptor})};
})();
