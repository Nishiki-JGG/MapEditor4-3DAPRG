// Pine-only GPU crown motion. Canonical wind XZ uses Unity axes; editor Z is reflected.
(() => {
const spec={version:1,id:'pine',minY:2.15,maxY:6.408,maxDisplacementMetres:.12,waves:[1.7,.65,2.9,.35],phase:[.17,.13],mask:'canonical uv.y > .5 (needle region only)',verticalDisplacement:0};
const uniforms={uPineWind:{value:new THREE.Vector4()},uPineBand:{value:new THREE.Vector4(spec.minY,spec.maxY,spec.maxDisplacementMetres,1)},uPineWaves:{value:new THREE.Vector4(...spec.waves)},uPinePhase:{value:new THREE.Vector2(...spec.phase)}};
const GLSL=`uniform vec4 uPineWind,uPineBand,uPineWaves; uniform vec2 uPinePhase;
vec2 pineOffset(float y,float uvY,vec2 origin){
 if(uPineWind.z<=0.||uvY<=.5) return vec2(0.);
 float w=smoothstep(uPineBand.x,uPineBand.y,y);
 float ph=dot(origin,uPinePhase);
 float gust=uPineWaves.y*sin(uPineWind.w*uPineWaves.x+ph)+uPineWaves.w*sin(uPineWind.w*uPineWaves.z+ph);
 return uPineWind.xy*(clamp(uPineWind.z,0.,1.)*uPineBand.z*w*gust);
}`;
const projection=`#include <project_vertex>
vec4 pineOrigin=modelMatrix*vec4(0.,0.,0.,1.);
#ifdef USE_INSTANCING
pineOrigin=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
#endif
vec2 pineDelta=pineOffset(position.y,uv.y,vec2(pineOrigin.x,-pineOrigin.z));
if(dot(pineDelta,pineDelta)>0.){
 vec4 pineWorld=vec4(transformed,1.);
 #ifdef USE_INSTANCING
 pineWorld=instanceMatrix*pineWorld;
 #endif
 pineWorld=modelMatrix*pineWorld;pineWorld.xz+=vec2(pineDelta.x,-pineDelta.y);
 mvPosition=viewMatrix*pineWorld;gl_Position=projectionMatrix*mvPosition;
}`;
function attach(m){m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,uniforms);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+GLSL).replace('#include <project_vertex>',projection).replace('#include <worldpos_vertex>',THREE.ShaderChunk.worldpos_vertex.replace('worldPosition = modelMatrix * worldPosition;','worldPosition = modelMatrix * worldPosition; worldPosition.xz+=vec2(pineDelta.x,-pineDelta.y);'));};m.customProgramCacheKey=()=> 'shared-pine-wind/1';return m;}
const shadows=new Map();
function shadowMaterial(base,distance=false){const key=distance?'distance':'depth';if(!shadows.has(key)){const m=distance?new THREE.MeshDistanceMaterial():new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});m.map=base.map;m.alphaTest=base.alphaTest;m.side=base.side;attach(m);shadows.set(key,m);}return shadows.get(key);}
function set(time,x,z,strength){const n=Math.hypot(x,z)||1;uniforms.uPineWind.value.set(x/n,z/n,Math.max(0,Math.min(1,strength)),time);}
window.TDPineWind={spec,uniforms,GLSL,attach,shadowMaterial,set,exportJson:()=>JSON.stringify(spec)};
})();
