// Shared ground contract: gamma-encoded samples, world XZ metres, one final decode.
(() => {
const d=TDGroundData,texture=new THREE.TextureLoader().load('data:'+d.mime+';base64,'+d.imageBase64);
texture.colorSpace=THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
texture.anisotropy=4;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
const soil=d.dirt,dirtTexture=new THREE.TextureLoader().load('data:'+soil.mime+';base64,'+soil.imageBase64);
dirtTexture.colorSpace=THREE.NoColorSpace;dirtTexture.wrapS=dirtTexture.wrapT=THREE.RepeatWrapping;
dirtTexture.generateMipmaps=true;dirtTexture.minFilter=THREE.LinearMipmapLinearFilter;dirtTexture.magFilter=THREE.LinearFilter;dirtTexture.anisotropy=4;
const uniforms={uGroundGrass:{value:texture},uGroundParams:{value:new THREE.Vector4(d.tileMetres,location.hash.includes('ground=single')?0:d.secondWeight,d.rotationCS[0],d.rotationCS[1])},uGroundOffset:{value:new THREE.Vector2(...d.secondOffset)},uGroundWaveA:{value:new THREE.Vector3(...d.waveA)},uGroundWaveB:{value:new THREE.Vector3(...d.waveB)}};
Object.assign(uniforms,{uGroundDirt:{value:dirtTexture},uDirtParams:{value:new THREE.Vector4(soil.tileMetres,soil.secondWeight,...soil.rotationCS)},uDirtOffset:{value:new THREE.Vector2(...soil.secondOffset)}});
const GLSL=`uniform sampler2D uGroundGrass; uniform vec4 uGroundParams; uniform vec2 uGroundOffset; uniform vec3 uGroundWaveA; uniform vec3 uGroundWaveB;
uniform sampler2D uGroundDirt; uniform vec4 uDirtParams; uniform vec2 uDirtOffset;
// 地表に埋まった数cmの粒。ワールド座標固定で編集・回転に追従する。
float groundNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 vec4 n=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1,1),vec2(127.1,311.7))))*43758.5453);
 return mix(mix(n.x,n.y,f.x),mix(n.z,n.w,f.x),f.y);
}
vec3 groundSoilGrain(vec2 p){
 vec2 cell=floor(p*5.5),f=fract(p*5.5);
 float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
 vec2 centre=.25+.5*vec2(fract(seed*71.3),fract(seed*113.7));
 float r=length((f-centre)*vec2(1.,1.35));
 float aa=max(fwidth(r),.008),radius=.035+.055*fract(seed*29.);
 float stone=(1.-smoothstep(radius-aa,radius+aa,r))*step(.72,seed);
 return vec3(stone,seed,(1.-smoothstep(0.,radius+aa,r))*step(.72,seed));
}
float groundSoilRelief(vec2 p){vec3 g=groundSoilGrain(p);return g.z*.008+(groundNoise(p*19.)-.5)*.004;}
vec3 sharedDirt(vec2 p){
 vec2 uv=p/uDirtParams.x;
 vec2 q=vec2(uv.x*uDirtParams.z-uv.y*uDirtParams.w,uv.x*uDirtParams.w+uv.y*uDirtParams.z)+uDirtOffset;
 vec3 c=mix(texture2D(uGroundDirt,uv).rgb,texture2D(uGroundDirt,q).rgb,uDirtParams.y);
 vec3 fine=texture2D(uGroundDirt,p/.47+vec2(.37,.81)).rgb;
 c*=.82+.36*clamp(dot(fine,vec3(.333))/.5,0.,1.);
 float mottle=groundNoise(p*.9+vec2(8.2,3.7)),grain=groundNoise(p*23.);
 c*=.83+.30*mottle;
 c=mix(c,c*vec3(.80,.78,.72),smoothstep(.57,.78,groundNoise(p*3.8+13.))*.35);
 c*=.90+.20*grain;
 vec3 g=groundSoilGrain(p);
 return mix(c,mix(vec3(.37,.32,.24),vec3(.69,.63,.51),g.y),g.x*.68);
}
vec3 sharedGrass(vec2 p){
 vec2 uv=p/uGroundParams.x;
 vec2 q=vec2(uv.x*uGroundParams.z-uv.y*uGroundParams.w,uv.x*uGroundParams.w+uv.y*uGroundParams.z)+uGroundOffset;
 vec3 c=texture2D(uGroundGrass,uv).rgb;
 if(uGroundParams.y>0.) c=mix(c,texture2D(uGroundGrass,q).rgb,uGroundParams.y);
 vec3 fine=texture2D(uGroundGrass,p/.95+vec2(.31,.73)).rgb;
 c=mix(c,fine,.36);
 float mottle=groundNoise(p*.75+23.),fineShade=groundNoise(p*29.);
 c*=.85+.22*mottle;
 c=mix(c,c*vec3(1.08,.97,.78),smoothstep(.58,.83,mottle)*.36);
 c*=.90+.20*fineShade;
 return c*(1.+uGroundWaveA.z*sin(dot(p,uGroundWaveA.xy))+uGroundWaveB.z*sin(dot(p,uGroundWaveB.xy)));
}`;
window.TDGround={data:d,texture,dirtTexture,uniforms,GLSL};
})();
