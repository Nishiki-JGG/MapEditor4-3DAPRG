// Shared ground contract: gamma-encoded samples, world XZ metres, one final decode.
(() => {
const d=TDGroundData,texture=new THREE.TextureLoader().load('data:'+d.mime+';base64,'+d.imageBase64);
texture.colorSpace=THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
const soil=d.dirt,dirtTexture=new THREE.TextureLoader().load('data:'+soil.mime+';base64,'+soil.imageBase64);
dirtTexture.colorSpace=THREE.NoColorSpace;dirtTexture.wrapS=dirtTexture.wrapT=THREE.RepeatWrapping;
dirtTexture.generateMipmaps=true;dirtTexture.minFilter=THREE.LinearMipmapLinearFilter;dirtTexture.magFilter=THREE.LinearFilter;dirtTexture.anisotropy=soil.anisotropy;
const uniforms={uGroundGrass:{value:texture},uGroundParams:{value:new THREE.Vector4(d.tileMetres,location.hash.includes('ground=single')?0:d.secondWeight,d.rotationCS[0],d.rotationCS[1])},uGroundOffset:{value:new THREE.Vector2(...d.secondOffset)},uGroundWaveA:{value:new THREE.Vector3(...d.waveA)},uGroundWaveB:{value:new THREE.Vector3(...d.waveB)}};
Object.assign(uniforms,{uGroundDirt:{value:dirtTexture},uDirtParams:{value:new THREE.Vector4(soil.tileMetres,soil.secondWeight,...soil.rotationCS)},uDirtOffset:{value:new THREE.Vector2(...soil.secondOffset)}});
const GLSL=`uniform sampler2D uGroundGrass; uniform vec4 uGroundParams; uniform vec2 uGroundOffset; uniform vec3 uGroundWaveA; uniform vec3 uGroundWaveB;
uniform sampler2D uGroundDirt; uniform vec4 uDirtParams; uniform vec2 uDirtOffset;
vec3 sharedDirt(vec2 p){
 vec2 uv=p/uDirtParams.x;
 vec2 q=vec2(uv.x*uDirtParams.z-uv.y*uDirtParams.w,uv.x*uDirtParams.w+uv.y*uDirtParams.z)+uDirtOffset;
 vec3 c=mix(texture2D(uGroundDirt,uv).rgb,texture2D(uGroundDirt,q).rgb,uDirtParams.y);
 return c*(1.+.022*sin(dot(p,vec2(.47,.29)))+.014*sin(dot(p,vec2(-.21,.53))));
}
vec3 sharedGrass(vec2 p){
 vec2 uv=p/uGroundParams.x;
 vec2 q=vec2(uv.x*uGroundParams.z-uv.y*uGroundParams.w,uv.x*uGroundParams.w+uv.y*uGroundParams.z)+uGroundOffset;
 vec3 c=texture2D(uGroundGrass,uv).rgb;
 if(uGroundParams.y>0.) c=mix(c,texture2D(uGroundGrass,q).rgb,uGroundParams.y);
 return c*(1.+uGroundWaveA.z*sin(dot(p,uGroundWaveA.xy))+uGroundWaveB.z*sin(dot(p,uGroundWaveB.xy)));
}`;
window.TDGround={data:d,texture,dirtTexture,uniforms,GLSL};
})();
