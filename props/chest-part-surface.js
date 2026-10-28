// Shared optional silver/rainbow atlases. Invalid or pending maps retain legacy material.
window.TDChestPartSurface=(()=>{
 const states=new Map();
 function create(id){
  const descriptor=window.TDChestPartData?.[id],watchers=new Set();
  const a={descriptor,textures:[],ready:false,status:descriptor?'loading':'absent',error:null};
  const notify=()=>watchers.forEach(m=>m.needsUpdate=true);
  a.readyPromise=(async()=>{if(!descriptor)return;try{
   const part=TDChestPartAtlasContract.fromSurface(id,descriptor);
   TDChestPartAtlasContract.create([part],[{id,assetKey:'tdj/'+id}]);
   const images=await Promise.all(['colour','packed'].map(async name=>{
    const bytes=Uint8Array.from(atob(descriptor[name].png),c=>c.charCodeAt(0));
    let image;if(typeof createImageBitmap==='function')image=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    else{image=new Image();image.src='data:image/png;base64,'+descriptor[name].png;await image.decode();}
    if(image.width!==512||image.height!==512)throw Error('decoded dimensions');return image;
   }));
   a.textures=images.map((image,i)=>{const t=new THREE.Texture(image);t.flipY=false;t.colorSpace=i?THREE.NoColorSpace:THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=2;t.needsUpdate=true;return t;});a.ready=true;a.status='ready';
  }catch(e){a.status='fallback';a.error=e.message;}finally{notify();}})();
  function get(){return a;}
 const helpers=`
 uniform float uSilverTrim;
 float silverBand(){vec3 p=vChestSurfaceLocal;return uSilverTrim*(1.-step(.023,abs(abs(p.x)-.40)))*step(.08,p.y)*max(step(.433,p.y),step(.321,abs(p.z)));}

 float chestGoldFace(){vec3 p=vChestSurfaceLocal;return abs(p.x)>.48&&abs(vChestGoldNormal.x)>.65?(p.x<0.?2.:3.):p.y>.433?4.:p.z>=0.?0.:1.;}
 vec2 chestGoldUV(){vec3 p=vChestSurfaceLocal;float f=chestGoldFace();vec2 q;vec4 r;
 if(f<.5){q=vec2((p.x+.55)/1.1,p.y/.433);r=vec4(0.,0.,256.,192.);}
 else if(f<1.5){q=vec2((-p.x+.55)/1.1,p.y/.433);r=vec4(256.,0.,256.,192.);}
 else if(f<2.5){q=vec2((p.z+.36)/.72,p.y/.8);r=vec4(0.,192.,256.,128.);}
 else if(f<3.5){q=vec2((-p.z+.36)/.72,p.y/.8);r=vec4(256.,192.,256.,128.);}
 else{q=vec2((p.x+.55)/1.1,atan(p.y-.435,-p.z)/3.14159265);r=vec4(0.,320.,512.,192.);}
 return(r.xy+4.+clamp(q,vec2(0.),vec2(1.))*(r.zw-9.)+.5)/512.;}
 vec4 chestGoldMean(){return uChestGoldMeans[int(chestGoldFace()+.1)];}
 vec4 chestGoldPackedRaw(){vec4 a=texture2D(uChestPacked,chestGoldUV());float f=chestSurfaceFade();a.b=mix(chestGoldMean().a,a.b,f);a.xy=mix(vec2(.5),a.xy,f);a.a=1.;a.b=mix(a.b,.27,silverBand());return a;}
 vec3 chestGoldColour(){return mix(mix(chestGoldMean().rgb,texture2D(uChestColour,chestGoldUV()).rgb,chestSurfaceFade()),vec3(.133,.179,.233),silverBand());}
 float chestGoldKeyhole(){vec3 p=vChestSurfaceLocal;return step(.3867,p.z)*(1.-step(.006,abs(p.x)))*(1.-step(.014,abs(p.y-.321)));}
 `;
 function replaceOnce(text,from,to){if(text.split(from).length!==2)throw Error('Gold shader hook changed: '+from);return text.replace(from,to);}
 function configure(sh,ornament=false){sh.uniforms.uSilverTrim={value:id==='treasurechest_silver'&&!ornament?1:0};const a=get();if(!a.ready)return;sh.uniforms.uChestColour.value=a.textures[0];sh.uniforms.uChestPacked.value=a.textures[1];sh.uniforms.uChestSurfaceReady={get value(){return a.ready?1:0;}};sh.uniforms.uChestGoldMeans={value:Array.from({length:5},(_,i)=>new THREE.Vector4(...a.descriptor.means.slice(i*4,i*4+4)))};
  sh.vertexShader=replaceOnce(sh.vertexShader,'#include <common>','#include <common>\nvarying vec3 vChestGoldNormal;');sh.vertexShader=replaceOnce(sh.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvChestGoldNormal=normal;');
  sh.fragmentShader=replaceOnce(sh.fragmentShader,'#include <common>','#include <common>\nvarying vec3 vChestGoldNormal;uniform vec4 uChestGoldMeans[5];vec2 chestGoldUV();vec4 chestGoldMean();vec4 chestGoldPackedRaw();vec3 chestGoldColour();float chestGoldKeyhole();');
  sh.fragmentShader=replaceOnce(sh.fragmentShader,'#include <clipping_planes_pars_fragment>','#include <clipping_planes_pars_fragment>\n'+helpers);
  // Named hooks have exact-count guards. Early returns keep the legacy functions intact for other IDs.
  for(const [hook,body]of [['vec2 chestSurfaceSampleUV(){','return chestGoldUV();'],['vec4 chestSurfaceMean(){','return chestGoldMean();'],['float chestWidth(){','return max(fwidth(chestGoldUV().x),fwidth(chestGoldUV().y));'],['vec3 chestSurfaceColour(){','return chestGoldColour();'],['vec4 chestPackedRaw(){','return chestGoldPackedRaw();']])sh.fragmentShader=replaceOnce(sh.fragmentShader,hook,hook+body);
  sh.fragmentShader=replaceOnce(sh.fragmentShader,'vec3 surfaceColour=chestSurfaceColour()*surfaceNR.a;','vec3 surfaceColour=chestSurfaceColour()*surfaceNR.a/max(vColor.rgb,vec3(.001));surfaceColour=mix(surfaceColour,vec3(1.),chestGoldKeyhole());');
 }
  return{get,configure,watch:m=>watchers.add(m)};
 }
 function surface(id){if(!TDChestPartAtlasContract.ids.includes(id))return null;if(!states.has(id))states.set(id,create(id));return states.get(id);}
 function descriptor(types){const assets=types.filter(t=>t.assetKey==='tdj/'+t.id),candidates=[];
  for(const id of TDChestPartAtlasContract.ids){const a=surface(id).get();if(a.ready)candidates.push(TDChestPartAtlasContract.fromSurface(id,a.descriptor));}
  return TDChestPartAtlasContract.create(candidates,assets);
 }
 return{get:id=>surface(id)?.get(),watch:(m,id)=>surface(id)?.watch(m),configure:(sh,id,ornament)=>surface(id)?.configure(sh,ornament),export:descriptor,
 prepare:()=>Promise.all(TDChestPartAtlasContract.ids.map(id=>surface(id).get().readyPromise)),
 stats:()=>Object.fromEntries(TDChestPartAtlasContract.ids.map(id=>{const a=surface(id).get();return[id,{status:a.status,error:a.error,textures:a.textures.length}];}))};
})();
