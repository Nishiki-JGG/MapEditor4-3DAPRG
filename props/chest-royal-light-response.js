// Royal gold only. Native source parity is present; execution is held.
window.TDChestRoyalLightResponse=(()=>{
const response={value:1},local={value:1},shadow={value:1};
const gain=`
float chestDirectEnergy=0.;float chestAmbientEnergy=0.;
#if NUM_DIR_LIGHTS > 0
for(int ci=0;ci<NUM_DIR_LIGHTS;ci++){chestDirectEnergy+=dot(directionalLights[ci].color,vec3(.2126,.7152,.0722));}
#endif
#if NUM_HEMI_LIGHTS > 0
for(int ci=0;ci<NUM_HEMI_LIGHTS;ci++){chestAmbientEnergy+=max(dot(hemisphereLights[ci].skyColor,vec3(.2126,.7152,.0722)),dot(hemisphereLights[ci].groundColor,vec3(.2126,.7152,.0722)));}
#endif

float chestLocalEnergy=0.;vec3 chestLocalSpec=vec3(0.);
float chestExponent=mix(80.,mix(180.,18.,surfaceNR.b),surfaceMask);
float chestRoughSpec=mix(1.,mix(1.12,.42,surfaceNR.b),surfaceMask);
#if NUM_POINT_LIGHTS > 0
#pragma unroll_loop_start
for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
 {IncidentLight incident;getPointLightInfo(pointLights[ i ],-vChestV,incident);
#if defined(USE_SHADOWMAP) && (UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS)
 PointLightShadow chestShadow=pointLightShadows[ i ];
 float visibility=(incident.visible && receiveShadow)?getPointShadow(pointShadowMap[ i ],chestShadow.shadowMapSize,chestShadow.shadowBias,chestShadow.shadowRadius,vPointShadowCoord[ i ],chestShadow.shadowCameraNear,chestShadow.shadowCameraFar):1.;
 incident.color*=mix(1.,visibility,uChestShadowMix);
#endif
 float nl=max(dot(cn,incident.direction),0.);
 chestLocalEnergy+=dot(incident.color,vec3(.2126,.7152,.0722))*nl;
 if(nl>0.)chestLocalSpec+=incident.color*pow(max(dot(cn,normalize(incident.direction+cv)),0.),chestExponent)*chestRoughSpec*nl;}
}
#pragma unroll_loop_end
#endif
#if NUM_SPOT_LIGHTS > 0
#pragma unroll_loop_start
for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
 {IncidentLight incident;getSpotLightInfo(spotLights[ i ],-vChestV,incident);
#if defined(USE_SHADOWMAP) && (UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS)
 SpotLightShadow chestShadow=spotLightShadows[ i ];
 float visibility=(incident.visible && receiveShadow)?getShadow(spotShadowMap[ i ],chestShadow.shadowMapSize,chestShadow.shadowBias,chestShadow.shadowRadius,vSpotLightCoord[ i ]):1.;
 incident.color*=mix(1.,visibility,uChestShadowMix);
#endif
 float nl=max(dot(cn,incident.direction),0.);
 chestLocalEnergy+=dot(incident.color,vec3(.2126,.7152,.0722))*nl;
 if(nl>0.)chestLocalSpec+=incident.color*pow(max(dot(cn,normalize(incident.direction+cv)),0.),chestExponent)*chestRoughSpec*nl;}
}
#pragma unroll_loop_end
#endif

float chestOldGain=clamp(uChestAmbient,.03,1.);
float chestDirectPresence=clamp((chestDirectEnergy+chestLocalEnergy*uChestLocalMix)/1.05,0.,1.);
float chestAmbientEnvelope=clamp(chestAmbientEnergy*RECIPROCAL_PI,0.,1.);
float chestSceneGain=min(chestOldGain,mix(chestAmbientEnvelope,chestOldGain,chestDirectPresence));
float gain=mix(chestOldGain,chestSceneGain,uChestResponseMix);
cs*=mix(1.,clamp(chestDirectEnergy/1.05,0.,1.),uChestResponseMix);
`;
const extra=`outgoingLight+=mix(mix(vec3(1.),diffuseColor.rgb,.35),vec3(.025)+diffuseColor.rgb*.8,vChestInk)*chestLocalSpec*.95*chestOldGain*uChestLocalMix;`;
function configure(sh){
 const hook='float gain=clamp(uChestAmbient,.03,1.);';
 if(sh.fragmentShader.split(hook).length!==2)throw Error('Chest response hook mismatch');
 sh.uniforms.uChestResponseMix=response;sh.uniforms.uChestLocalMix=local;sh.uniforms.uChestShadowMix=shadow;
 sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uChestResponseMix;uniform float uChestLocalMix;uniform float uChestShadowMix;').replace(hook,gain).replace('#include <opaque_fragment>',extra+'\n#include <opaque_fragment>');
}
return{configure,response,local,shadow};
})();
