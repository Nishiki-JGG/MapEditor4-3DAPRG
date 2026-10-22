// Shared GPU plant wind. Canonical wind XZ uses Unity axes; editor Z is reflected.
(() => {
const spec={version:2,id:'pine',minY:2.15,maxY:6.408,maxDisplacementMetres:.16,waves:[1.7,.65,2.9,.35],phase:[.17,.13],response:{version:1,linear:.25,quadratic:.75,mean:.65,gust:.35},mask:'canonical uv.y > .5 (needle region only)',verticalDisplacement:0};
const uniforms={uPineWind:{value:new THREE.Vector4()},uPineBand:{value:new THREE.Vector4(spec.minY,spec.maxY,spec.maxDisplacementMetres,1)},uPineWaves:{value:new THREE.Vector4(...spec.waves)},uPinePhase:{value:new THREE.Vector2(...spec.phase)}};
const rootGLSL=`
#ifdef ROOT_GROUND
attribute float rootWeight; attribute vec2 rootSlope;
float sharedRootRise(mat4 m){vec4 p=m*vec4(position,1.);return dot(rootSlope,p.xz-m[3].xz)*rootWeight;}
#endif
`;
const GLSL=rootGLSL+`uniform vec4 uPineWind,uPineBand,uPineWaves; uniform vec2 uPinePhase;
#ifdef PLANT_WEIGHTS
attribute vec2 plantWeight; uniform float uPlantPhase,uPlantCombinedLimit;
vec2 plantCombinedOffset(vec2 wind,vec2 touch,float scale,vec2 weights){vec2 d=wind+touch;float limit=uPlantCombinedLimit*scale*max(weights.x,weights.y),n=dot(d,d);if(uPlantCombinedLimit>0.&&n>limit*limit)return d*(limit*inversesqrt(n));return d;}
#endif
vec2 pineOffset(float y,float uvY,vec2 origin){
 if(uPineWind.z<=0.||uvY<=(uPineBand.w>1.5?-1.:.5)) return vec2(0.);
 float w=smoothstep(uPineBand.x,uPineBand.y,y);
 float ph=dot(origin,uPinePhase);
#ifdef PLANT_WEIGHTS
 if(plantWeight.x<=0.)return vec2(0.);w=plantWeight.x; ph+=uPlantPhase;
#endif
 float gust=uPineWaves.y*sin(uPineWind.w*uPineWaves.x+ph)+uPineWaves.w*sin(uPineWind.w*uPineWaves.z+ph);
 float s=clamp(uPineWind.z,0.,1.);
 return uPineWind.xy*(s*(.25+.75*s)*uPineBand.z*w*(.65+.35*gust));
}`;
const projection=`#include <project_vertex>
vec4 pineOrigin=modelMatrix*vec4(0.,0.,0.,1.);
#ifdef USE_INSTANCING
pineOrigin=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
#endif
vec2 pineDelta=pineOffset(position.y,uv.y,vec2(pineOrigin.x,-pineOrigin.z));
#ifdef PLANT_WEIGHTS
mat4 plantMatrix=modelMatrix;
#ifdef USE_INSTANCING
plantMatrix=modelMatrix*instanceMatrix;
#endif
float plantScaleXZ=length(plantMatrix[0].xyz);pineDelta*=min(1.,plantScaleXZ);
#if defined(PLANT_TOUCH) && defined(USE_INSTANCING)
if(uPlantCombinedLimit>0.){vec2 tc=vec2(plantTouchWorld.x,-plantTouchWorld.y);pineDelta=plantCombinedOffset(pineDelta,tc,plantScaleXZ,plantWeight)-tc;}
#endif
#endif
float rootRise=0.;
#ifdef ROOT_GROUND
mat4 rootMatrix=modelMatrix;
#ifdef USE_INSTANCING
rootMatrix=modelMatrix*instanceMatrix;
#endif
rootRise=sharedRootRise(rootMatrix);
#endif
if(dot(pineDelta,pineDelta)>0.||rootRise!=0.){
 vec4 pineWorld=vec4(transformed,1.);
 #ifdef USE_INSTANCING
 pineWorld=instanceMatrix*pineWorld;
 #endif
 pineWorld=modelMatrix*pineWorld;pineWorld.xz+=vec2(pineDelta.x,-pineDelta.y);pineWorld.y+=rootRise;
 mvPosition=viewMatrix*pineWorld;gl_Position=projectionMatrix*mvPosition;
}`;
function attach(m,motion=null,weighted=false,root=false){m.userData.sharedRootGrounding=!!root;if(root){m.defines={...(m.defines||{}),ROOT_GROUND:""};m.defaultAttributeValues={...m.defaultAttributeValues,rootSlope:[0,0]};}m.userData.sharedWind=motion;m.userData.sharedWeighted=weighted;if(weighted)m.defines={...(m.defines||{}),PLANT_WEIGHTS:''};const local=motion?{...uniforms,uPineBand:{value:new THREE.Vector4(motion.minY,motion.maxY,motion.maxDisplacementMetres,weighted?3:2)},uPlantPhase:{value:motion.phaseOffset||0},uPlantCombinedLimit:{value:motion.maxCombinedDisplacementMetres||0}}:uniforms;m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,local);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+GLSL).replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
#ifdef ROOT_GROUND
mat4 rootNormalMatrix=modelMatrix;
#ifdef USE_INSTANCING
rootNormalMatrix=modelMatrix*instanceMatrix;
#endif
float rootNormalY=objectNormal.y*rootWeight/max(length(rootNormalMatrix[1].xyz),.0001);
objectNormal.x-=rootNormalY*dot(rootSlope,rootNormalMatrix[0].xz);objectNormal.z-=rootNormalY*dot(rootSlope,rootNormalMatrix[2].xz);
#endif
`).replace('#include <project_vertex>',projection).replace('#include <worldpos_vertex>',THREE.ShaderChunk.worldpos_vertex.replace('worldPosition = modelMatrix * worldPosition;','worldPosition = modelMatrix * worldPosition; worldPosition.xz+=vec2(pineDelta.x,-pineDelta.y); worldPosition.y+=rootRise;'));};m.customProgramCacheKey=()=> (weighted?'shared-plant-motion/3':'shared-plant-wind/2')+(root?'/root-ground/1':'');return m;}
const touchGLSL=`
#ifdef USE_INSTANCING
vec2 plantTouchWorld=touch.xy*plantWeight.y;
if(dot(touch.xy,touch.xy)>0.&&plantWeight.y>0.){mat3 tm=mat3(modelMatrix*instanceMatrix);transformed+=transpose(tm)*vec3(touch.x,0.,touch.y)*(plantWeight.y/dot(tm[0],tm[0]));}
#endif`;
function touchVertex(sh){sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 touch;').replace('#include <begin_vertex>','#include <begin_vertex>\n'+touchGLSL);}
function touchMaterial(base){const m=base.clone();m.defines={...(base.defines||{}),PLANT_TOUCH:''};m.userData.touchVertex=touchVertex;m.onBeforeCompile=sh=>{base.onBeforeCompile(sh);touchVertex(sh);};m.customProgramCacheKey=()=>base.customProgramCacheKey()+'/touch';return m;}
function advance(st,tx,tz,max,dt){const total=Math.min(.1,Math.max(0,dt)),n=Math.max(1,Math.ceil(total*120-.0001)),h=total/n;for(let i=0;i<n;i++){st.vx+=(70*(tx-st.bx)-8*st.vx)*h;st.vz+=(70*(tz-st.bz)-8*st.vz)*h;st.bx+=st.vx*h;st.bz+=st.vz*h;const b=Math.hypot(st.bx,st.bz);if(b>max){st.bx*=max/b;st.bz*=max/b;const outward=(st.vx*st.bx+st.vz*st.bz)/(max*max);if(outward>0){st.vx-=outward*st.bx;st.vz-=outward*st.bz;}}}if(tx===0&&tz===0&&Math.hypot(st.bx,st.bz)<.0005&&Math.hypot(st.vx,st.vz)<.003){st.bx=st.bz=st.vx=st.vz=0;return true;}return false;}
function target(dx,dz,r,mvx,mvz,max){const d=Math.hypot(dx,dz);if(d>=r)return[0,0];const speed=Math.hypot(mvx,mvz),mv=speed>20?0:speed,mx=mv>.1?mvx/mv:0,mz=mv>.1?mvz/mv:0,nx=d>.05?dx/d:mx,nz=d>.05?dz/d:mz,k=(1-d/r)*max*1.6;return[(nx*.8+mx*.45*Math.min(1,mv/3))*k,(nz*.8+mz*.45*Math.min(1,mv/3))*k];}
const shadows=new WeakMap();
function shadowMaterial(base,distance=false){const key=distance?'distance':'depth';let pair=shadows.get(base);if(!pair){pair=new Map();shadows.set(base,pair);}if(!pair.has(key)){const m=distance?new THREE.MeshDistanceMaterial():new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});m.map=base.map;m.alphaTest=base.alphaTest;m.side=base.side;attach(m,base.userData.sharedWind||null,!!base.userData.sharedWeighted,!!base.userData.sharedRootGrounding);if(base.userData.touchVertex){m.defines={...(m.defines||{}),PLANT_TOUCH:''};const compile=m.onBeforeCompile;m.onBeforeCompile=sh=>{compile(sh);base.userData.touchVertex(sh);};}pair.set(key,m);}return pair.get(key);}
function set(time,x,z,strength){const n=Math.hypot(x,z)||1;uniforms.uPineWind.value.set(x/n,z/n,Math.max(0,Math.min(1,strength)),time);}
window.TDPineWind={spec,uniforms,GLSL,touchGLSL,attach,touchMaterial,advance,target,shadowMaterial,set,exportJson:()=>JSON.stringify(spec)};
})();
