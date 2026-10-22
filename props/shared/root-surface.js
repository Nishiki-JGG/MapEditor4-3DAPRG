// 根元の不透明な表面だけを馴染ませる。地面パッチ、透過板、追加描画は使わない。
(() => {
function attach(material, spec, shadow=false) {
 if (!spec || !window.TDGround) return material;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.userData.rootSurfaceSpec=spec;
 material.defaultAttributeValues={...material.defaultAttributeValues,rootTerrain:[0,0,0,0]};
 material.onBeforeCompile=sh=>{
  compile(sh);Object.assign(sh.uniforms,TDGround.uniforms,{uRootPaint:{value:TDGround.rootPaint?.texture||TDGround.texture},uRootPaintMap:{value:TDGround.rootPaint?.params||new THREE.Vector4(1,1,1,0)},uRootSurface:{value:new THREE.Vector2(spec.bandMetres,spec.mossHeightMetres)}});
  sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
attribute float rootWood;attribute vec4 rootTerrain;varying vec4 vRootSurface;varying vec3 vRootTerrain;uniform vec2 uRootSurface;`)
  .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
mat4 surfaceNormalMatrix=modelMatrix;
#ifdef USE_INSTANCING
surfaceNormalMatrix=modelMatrix*instanceMatrix;
#endif
vec4 normalP=surfaceNormalMatrix*vec4(position,1.);vec3 normalOrigin=surfaceNormalMatrix[3].xyz;
float normalH=(normalP.y+sharedRootRise(surfaceNormalMatrix)-normalOrigin.y-rootTerrain.w-dot(rootSlope,normalP.xz-normalOrigin.xz))/max(length(surfaceNormalMatrix[1].xyz),.0001);
float normalBlend=(1.-smoothstep(0.,uRootSurface.x*.6,normalH))*rootWood*min(1.,dot(rootTerrain.xyz,vec3(1.)));
objectNormal=normalize(mix(objectNormal,vec3(0.,1.,0.),normalBlend*.4));`)
  .replace('#include <begin_vertex>',`#include <begin_vertex>
mat4 surfaceMatrix=modelMatrix;
#ifdef USE_INSTANCING
surfaceMatrix=modelMatrix*instanceMatrix;
#endif
vec4 surfaceP=surfaceMatrix*vec4(position,1.);vec3 surfaceOrigin=surfaceMatrix[3].xyz;
float surfaceY=(surfaceP.y+sharedRootRise(surfaceMatrix)-surfaceOrigin.y-rootTerrain.w-dot(rootSlope,surfaceP.xz-surfaceOrigin.xz))/max(length(surfaceMatrix[1].xyz),.0001);
vRootSurface=vec4(surfaceP.xz,surfaceY,rootWood);vRootTerrain=rootTerrain.xyz;`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
varying vec4 vRootSurface;varying vec3 vRootTerrain;uniform vec2 uRootSurface;
${shadow?'':TDGround.GLSL+'\nuniform sampler2D uRootPaint;uniform vec4 uRootPaintMap;'}
float rootHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float rootNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(rootHash(i),rootHash(i+vec2(1,0)),f.x),mix(rootHash(i+vec2(0,1)),rootHash(i+vec2(1,1)),f.x),f.y);}
${shadow?'':`
float rootSoilWeight(vec2 p,float paint){float a=.5,s=0.;p=p*1.6+5.;for(int i=0;i<4;i++){s+=a*rootNoise(p);p=p*2.03+17.1;a*=.5;}return smoothstep(.2,.55,paint+(s-.5)*.35);}
vec2 rootPaint(vec2 p){if(uRootPaintMap.w<.5)return vRootTerrain.xy;vec2 uv=clamp((p+uRootPaintMap.xy)/(2.*uRootPaintMap.xy),0.,1.);return texture2D(uRootPaint,uv*(1.-1./uRootPaintMap.z)+.5/uRootPaintMap.z).ba;}
vec3 rootSurfaceColor(vec3 bark){
 float enabled=dot(vRootTerrain,vec3(1.));float h=vRootSurface.z;
 if(vRootSurface.w<.5||enabled<.001||h>uRootSurface.y)return bark;
 vec2 p=vRootSurface.xy;float coarse=rootNoise(p*8.7),fine=rootNoise(p*31.);
 float soil=(1.-smoothstep(uRootSurface.x*.12,uRootSurface.x*(.55+.9*coarse),h))*vRootSurface.w;
 vec3 grass=sharedGrass(p),dirt=sharedDirt(p),stone=mix(vec3(.42,.40,.35),vec3(.60,.57,.50),coarse)*(.84+.16*fine);
 vec2 paint=rootPaint(p);float soilWeight=rootSoilWeight(p,paint.x),rubble=clamp(paint.y,0.,1.),grassWeight=(1.-soilWeight)*(1.-rubble);vec3 ground=mix(mix(grass,dirt,soilWeight),stone,rubble);
 vec3 c=mix(bark,pow(max(ground,vec3(0.)),vec3(2.2)),soil);
 float moss=(1.-smoothstep(.035,uRootSurface.y*(.45+.55*coarse),h))*smoothstep(.36,.71,coarse+.12*fine)*grassWeight*.30;
 c=mix(c,pow(max(grass*.83,vec3(0.)),vec3(2.2)),moss);
 return c*(1.-.055*(1.-smoothstep(0.,uRootSurface.x*1.5,h)));
}`}`)
  .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
if(vRootSurface.w>.5&&dot(vRootTerrain,vec3(1.))>.001&&vRootSurface.z<uRootSurface.x*.20*(rootNoise(vRootSurface.xy*17.3)-.18))discard;`);
  if(!shadow)sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=rootSurfaceColor(diffuseColor.rgb);');
 };
 material.customProgramCacheKey=()=>key()+'/root-surface/3'+(shadow?'/shadow':'');return material;
}
window.TDRootSurface={attach};
})();
