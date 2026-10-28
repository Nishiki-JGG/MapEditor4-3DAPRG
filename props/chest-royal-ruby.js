// Opaque pseudo-gem: facet normals, absorption tint and light-driven white glints.
// No refraction, transmission, emission, extra texture, light or geometry.
window.TDChestRoyalRuby=(()=>{
 const descriptor={version:1,mode:'opaque-faceted-v1'};
 const helpers=`
vec3 royalRubyDirect(vec3 n,vec3 v,vec3 l,vec3 radiance,vec2 q,vec3 x,vec3 z,vec3 inner,float absorption,float edge){
 float nl=max(dot(n,l),0.),nv=clamp(dot(n,v),0.,1.);vec3 h=(l+v)/max(length(l+v),.00001);
 float inside=pow(max(dot(inner,h),0.),10.);
 float depth=clamp(.14+.24*nl+.08*(1.-nv)+.10*edge+.64*inside,0.,1.);
 vec3 tint=mix(vec3(.055,.0006,.003),vec3(.62,.008,.025),depth)*absorption;
 vec3 lambert=radiance*(nl*RECIPROCAL_PI),weight=clamp(lambert*2.,vec3(0.),vec3(1.));
 vec2 centre=clamp(vec2(dot(h,x),dot(h,z))*2.8,vec2(-.60),vec2(.60));
 vec2 delta=(q-centre)*vec2(4.8,7.);float shape=max(abs(delta.x)+abs(delta.y)*.25,abs(delta.y)+abs(delta.x)*.25);
 float reflectionMask=1.-smoothstep(.52,.72,shape),halfAngle=max(dot(n,h),0.);
 vec3 white=vec3(1.,.97,.95)*weight*reflectionMask*(pow(halfAngle,220.)*2.6+pow(halfAngle,36.)*.06);
 vec3 internalReflection=vec3(.75,.055,.10)*weight*pow(max(dot(inner,h),0.),28.)*2.;
 return tint*lambert*.95+white+internalReflection;
}
`;
 const fragment=`
if(vRoyalRuby>.5){
 float rubyNV=clamp(dot(cn,cv),0.,1.);
 vec3 rubyX=normalize(vRubyX),rubyZ=normalize(vRubyZ),rubyY=normalize(vRubyUp);
 vec2 rubyQ=vChestP.xz/vec2(.092,.07728);
 float rubyEdge=clamp(length(rubyQ),0.,1.);
 vec2 rubyRay=vec2(dot(cv,rubyX),dot(cv,rubyZ))/max(dot(cv,rubyY),.30),rubyInside=rubyQ-rubyRay*.20;
 float rubySector=floor(atan(rubyInside.y,rubyInside.x)/.785398163+.5)*.785398163;
 float rubyRing=step(.48,dot(rubyInside,vec2(cos(rubySector),sin(rubySector)))),rubyAngle=rubySector+rubyRing*.392699082;
 vec3 rubyInner=normalize(rubyY*mix(.78,.54,rubyRing)-(rubyX*cos(rubyAngle)+rubyZ*sin(rubyAngle))*mix(.626,.842,rubyRing));
 float rubyAbsorption=.70+.30*smoothstep(.16,.85,length(rubyInside));
 vec3 rubyDirectRadiance=vec3(0.);
 RUBY_LIGHT_LOOPS
 // Indirect Lambert response is already integrated by Three; do not multiply it by pi again.
 vec3 rubyAmbientTint=mix(vec3(.055,.0006,.003),vec3(.62,.008,.025),.14+.08*(1.-rubyNV)+.10*rubyEdge)*rubyAbsorption;
 vec3 rubyIndirect=reflectedLight.indirectDiffuse/max(vColor.rgb,vec3(.001));
 float rubyFresnel=.078+.922*pow(1.-rubyNV,5.);
 outgoingLight=rubyDirectRadiance+rubyAmbientTint*rubyIndirect*.95+vec3(.30,.002,.012)*env*.12*gain+vec3(.85,.90,1.)*rubyFresnel*.16*gain;
}
`;
 function configure(sh){
 sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRubyX;varying vec3 vRubyZ;varying vec3 vRubyUp;').replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
 vec3 rubyX=vec3(1.,0.,0.),rubyZ=vec3(0.,0.,1.),rubyUp=vec3(0.,1.,0.);
 #ifdef USE_INSTANCING
 mat3 rubyMatrix=mat3(instanceMatrix);vec3 rubyScale=vec3(dot(rubyMatrix[0],rubyMatrix[0]),dot(rubyMatrix[1],rubyMatrix[1]),dot(rubyMatrix[2],rubyMatrix[2]));
 rubyX=rubyMatrix*(rubyX/rubyScale);rubyZ=rubyMatrix*(rubyZ/rubyScale);rubyUp=rubyMatrix*(rubyUp/rubyScale);
 #endif
 vRubyX=normalize(normalMatrix*rubyX);vRubyZ=normalize(normalMatrix*rubyZ);vRubyUp=normalize(normalMatrix*rubyUp);
 `);
 sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRubyX;varying vec3 vRubyZ;varying vec3 vRubyUp;');
 const hook='#include <opaque_fragment>';if(sh.fragmentShader.split(hook).length!==2)throw Error('Ruby shader hook');const chunk=THREE.ShaderChunk.lights_fragment_begin;const loops=chunk.slice(chunk.indexOf('IncidentLight directLight;'),chunk.indexOf('#if ( NUM_RECT_AREA_LIGHTS')).replaceAll('geometryPosition','(-vChestV)').replaceAll('RE_Direct( directLight, (-vChestV), geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );','rubyDirectRadiance+=royalRubyDirect(cn,cv,directLight.direction,directLight.color,rubyQ,rubyX,rubyZ,rubyInner,rubyAbsorption,rubyEdge);');if(loops.includes('RE_Direct('))throw Error('Ruby light-loop hook');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+helpers).replace(hook,fragment.replace('RUBY_LIGHT_LOOPS',loops)+'\n'+hook);}
 return{configure,export:()=>({...descriptor})};
})();
