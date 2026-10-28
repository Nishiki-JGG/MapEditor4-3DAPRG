// Optional gold-only intrinsic colour atlas. Reflection and lighting remain in chest-surface.
window.TDChestGoldSurface=(()=>{
 let atlas;
 function get(){if(atlas)return atlas;const descriptor=window.TDChestGoldData;if(!descriptor||descriptor.version!==1||descriptor.id!=='gold-parts-atlas-v1')throw Error('Missing gold part atlas');const textures=[0,1].map(i=>{const t=new THREE.Texture();t.flipY=false;t.colorSpace=i?THREE.NoColorSpace:THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=2;return t;});atlas={descriptor,textures,ready:false};
  const decode=async(name,i)=>{const bytes=Uint8Array.from(atob(descriptor[name].png),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:'image/png'});if(typeof createImageBitmap==='function'){textures[i].image=await createImageBitmap(blob,{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});}else{textures[i].image=await new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(blob);image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Gold atlas decode failed'));};image.src=url;});}textures[i].needsUpdate=true;};
  atlas.readyPromise=Promise.all([decode('colour',0),decode('packed',1)]).then(()=>{atlas.ready=true;});return atlas;
 }
 const helpers=`
 float chestGoldFace(){vec3 p=vChestSurfaceLocal;return abs(p.x)>.48&&abs(vChestGoldNormal.x)>.65?(p.x<0.?2.:3.):p.y>.433?4.:p.z>=0.?0.:1.;}
 vec2 chestGoldUV(){vec3 p=vChestSurfaceLocal;float f=chestGoldFace();vec2 q;vec4 r;
 if(f<.5){q=vec2((p.x+.55)/1.1,p.y/.433);r=vec4(0.,0.,256.,192.);}
 else if(f<1.5){q=vec2((-p.x+.55)/1.1,p.y/.433);r=vec4(256.,0.,256.,192.);}
 else if(f<2.5){q=vec2((p.z+.36)/.72,p.y/.8);r=vec4(0.,192.,256.,128.);}
 else if(f<3.5){q=vec2((-p.z+.36)/.72,p.y/.8);r=vec4(256.,192.,256.,128.);}
 else{q=vec2((p.x+.55)/1.1,atan(p.y-.435,-p.z)/3.14159265);r=vec4(0.,320.,512.,192.);}
 return(r.xy+4.+clamp(q,vec2(0.),vec2(1.))*(r.zw-9.)+.5)/512.;}
 vec4 chestGoldMean(){return uChestGoldMeans[int(chestGoldFace()+.1)];}
 vec4 chestGoldPackedRaw(){vec4 a=texture2D(uChestPacked,chestGoldUV());float f=chestSurfaceFade();a.b=mix(chestGoldMean().a,a.b,f);a.xy=mix(vec2(.5),a.xy,f);a.a=1.;return a;}
 vec3 chestGoldColour(){return mix(chestGoldMean().rgb,texture2D(uChestColour,chestGoldUV()).rgb,chestSurfaceFade());}
 float chestGoldKeyhole(){vec3 p=vChestSurfaceLocal;return step(.3867,p.z)*(1.-step(.006,abs(p.x)))*(1.-step(.014,abs(p.y-.321)));}
 `;
 function replaceOnce(text,from,to){if(text.split(from).length!==2)throw Error('Gold shader hook changed: '+from);return text.replace(from,to);}
 function configure(sh){const a=get();sh.uniforms.uChestColour.value=a.textures[0];sh.uniforms.uChestPacked.value=a.textures[1];sh.uniforms.uChestSurfaceReady={get value(){return a.ready?1:0;}};sh.uniforms.uChestGoldMeans={value:Array.from({length:5},(_,i)=>new THREE.Vector4(...a.descriptor.means.slice(i*4,i*4+4)))};
  sh.vertexShader=replaceOnce(sh.vertexShader,'#include <common>','#include <common>\nvarying vec3 vChestGoldNormal;');sh.vertexShader=replaceOnce(sh.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvChestGoldNormal=normal;');
  sh.fragmentShader=replaceOnce(sh.fragmentShader,'#include <common>','#include <common>\nvarying vec3 vChestGoldNormal;uniform vec4 uChestGoldMeans[5];vec2 chestGoldUV();vec4 chestGoldMean();vec4 chestGoldPackedRaw();vec3 chestGoldColour();float chestGoldKeyhole();');
  sh.fragmentShader=replaceOnce(sh.fragmentShader,'#include <clipping_planes_pars_fragment>','#include <clipping_planes_pars_fragment>\n'+helpers);
  // Named hooks have exact-count guards. Early returns keep the legacy functions intact for other IDs.
  for(const [hook,body]of [['vec2 chestSurfaceSampleUV(){','return chestGoldUV();'],['vec4 chestSurfaceMean(){','return chestGoldMean();'],['float chestWidth(){','return max(fwidth(chestGoldUV().x),fwidth(chestGoldUV().y));'],['vec3 chestSurfaceColour(){','return chestGoldColour();'],['vec4 chestPackedRaw(){','return chestGoldPackedRaw();']])sh.fragmentShader=replaceOnce(sh.fragmentShader,hook,hook+body);
  sh.fragmentShader=replaceOnce(sh.fragmentShader,'vec3 surfaceColour=chestSurfaceColour()*surfaceNR.a;','vec3 surfaceColour=chestSurfaceColour()*surfaceNR.a/max(vColor.rgb,vec3(.001));surfaceColour=mix(surfaceColour,vec3(1.),chestGoldKeyhole());');
 }
 return{get,configure,prepare:()=>get().readyPromise,export:()=>get().descriptor};
})();
