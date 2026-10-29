Shader "MapSharedProps/Lit" {
 Properties {
  _BaseMap("Base colour (sRGB) / alpha", 2D) = "white" {}
  _BaseColor("Linear base colour", Color) = (1,1,1,1)
  _PineBand("Pine minY/maxY/max displacement/enabled", Vector)=(2.15,6.408,.12,0)
  _PineWaves("Pine rates/amplitudes", Vector)=(1.7,.65,2.9,.35)
  _PinePhase("Pine phase coefficients", Vector)=(.17,.13,0,0)
  _PineResponse("Wind strength linear/quadratic/mean/gust", Vector)=(0,0,0,0)
  _PlantCombinedLimit("Optional combined wind/contact cap", Float)=0
  _TDRootSlope("Per renderer static ground plane XZ", Vector)=(0,0,0,0)
  _RootPaint("Derived soil/rubble paint",2D)="black"{} _RootPaintMap("Half size / resolution / enabled",Vector)=(1,1,1,0)
  _RootSurface("Soil band / moss height",Vector)=(.11,.32,0,0)
  _TDRootTerrain("Paint dirt / rubble / grass / ground offset",Vector)=(0,0,0,0)
  _RootGrass("Shared raw grass",2D)="white"{} _RootDirt("Shared raw soil",2D)="white"{}
  _RootGrassParams("Grass tile/mix/rotation",Vector)=(4,.4,.866,.5) _RootDirtParams("Soil tile/mix/rotation",Vector)=(2,.35,.866,.5)
  _RootGrassOffset("Grass UV offset",Vector)=(0,0,0,0) _RootDirtOffset("Soil UV offset",Vector)=(0,0,0,0)
  _RootWaveA("Ground colour wave A",Vector)=(.47,.29,.045,0) _RootWaveB("Ground colour wave B",Vector)=(-.21,.53,.025,0)
  _PlantTouch("Per renderer contact displacement XZ", Vector)=(0,0,0,0)
  _Cutoff("Alpha cutoff", Range(0,1)) = 0
  [Enum(UnityEngine.Rendering.CullMode)] _Cull("Cull", Float) = 2
 }
 SubShader {
  Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" }
  Cull [_Cull]
  Pass {
   Tags { "LightMode"="UniversalForward" }
   HLSLPROGRAM
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma target 3.0
   #pragma shader_feature_local _ ROOT_SURFACE
   #pragma shader_feature_local _ SHARED_GLOW
   #pragma shader_feature_local _ SHARED_BUSH_LEAF
  #pragma shader_feature_local _ ROOT_GROUND
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile_fragment _ _SHADOWS_SOFT
   #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
   #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
   #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
   #pragma shader_feature_local _ SMALL_PROP_LOCAL_LIGHTS
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST, _BaseColor, _PineBand, _PineWaves, _PinePhase, _PineResponse, _PlantTouch, _TDRootSlope, _RootSurface,_TDRootTerrain,_RootPaintMap,_RootGrassParams,_RootDirtParams,_RootGrassOffset,_RootDirtOffset,_RootWaveA,_RootWaveB; float _Cutoff, _Cull, _PlantCombinedLimit;
   CBUFFER_END
   #define SHARED_PLANT_TOUCH_DECLARED
   #include "SharedPineWind.hlsl"
  #include "SharedRootGrounding.hlsl"
#ifdef ROOT_SURFACE
TEXTURE2D(_RootPaint);SAMPLER(sampler_RootPaint);
#define ROOT_PAINT(uv) SAMPLE_TEXTURE2D(_RootPaint,sampler_RootPaint,uv)
TEXTURE2D(_RootGrass);SAMPLER(sampler_RootGrass);TEXTURE2D(_RootDirt);SAMPLER(sampler_RootDirt);
#define ROOT_GRASS(uv) SAMPLE_TEXTURE2D(_RootGrass,sampler_RootGrass,uv).rgb
#define ROOT_DIRT(uv) SAMPLE_TEXTURE2D(_RootDirt,sampler_RootDirt,uv).rgb
#include "SharedRootSurface.hlsl"
#endif

   struct Attributes { float4 positionOS:POSITION; float3 normalOS:NORMAL; float2 uv:TEXCOORD0; float2 weights:TEXCOORD1;
#ifdef SHARED_BUSH_LEAF
float2 bushLeaf:TEXCOORD4;
#endif
#ifdef SHARED_GLOW
float glow:TEXCOORD2;
#endif
#if defined(ROOT_GROUND) || defined(ROOT_SURFACE)
float2 rootMask:TEXCOORD3;
#endif
float4 color:COLOR; };
   struct Varyings { float4 positionCS:SV_POSITION; float3 positionWS:TEXCOORD0; half3 directF:TEXCOORD1; float2 uv:TEXCOORD2; half3 directB:TEXCOORD3; half3 ambientF:TEXCOORD4; half3 ambientB:TEXCOORD5;
#ifdef SMALL_PROP_LOCAL_LIGHTS
 half3 localNormal:TEXCOORD8;
#endif
#ifdef SHARED_GLOW
half2 glow:TEXCOORD6;
#endif
#ifdef ROOT_SURFACE
float4 rootSurface:TEXCOORD7;
#endif
float4 color:COLOR; };
   Varyings Vert(Attributes v) {
    Varyings o; VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);
#ifdef ROOT_SURFACE
o.rootSurface=RootSurfaceInfo(p.positionWS,TransformObjectToWorld(float3(0,0,0)),v.rootMask.x,v.rootMask.y,length(GetObjectToWorldMatrix()._m01_m11_m21));
#endif
#ifdef ROOT_GROUND
    p.positionWS.y+=SharedRootRise(p.positionWS,TransformObjectToWorld(float3(0,0,0)),v.rootMask.x,_TDRootSlope.xy);
    p.positionCS=TransformWorldToHClip(p.positionWS);
#endif
    float2 wind=SharedPlantOffset(v.positionOS.y,v.uv.y,v.weights,TransformObjectToWorld(float3(0,0,0)).xz,length(GetObjectToWorldMatrix()._m00_m10_m20));
    if(dot(wind,wind)>0){p.positionWS.xz+=wind;p.positionCS=TransformWorldToHClip(p.positionWS);}
    #ifdef SHARED_GLOW
    o.glow=half2(v.glow,v.positionOS.y);
    #endif
    o.positionCS=p.positionCS; o.positionWS=p.positionWS; half3 n=TransformObjectToWorldNormal(v.normalOS);
#ifdef ROOT_SURFACE
n=normalize(lerp(n,float3(0,1,0),RootNormalBlend(o.rootSurface.z,v.rootMask.y)));
#endif
#ifdef ROOT_GROUND
n=normalize(n-float3(_TDRootSlope.x,0,_TDRootSlope.y)*n.y*v.rootMask.x);
#endif
#ifdef SMALL_PROP_LOCAL_LIGHTS
 o.localNormal=n;
#endif
 Light light=GetMainLight(); o.directF=light.color*max(0,dot(n,light.direction)); o.directB=light.color*max(0,dot(-n,light.direction)); o.ambientF=SampleSH(n); o.ambientB=SampleSH(-n);
#ifdef SHARED_BUSH_LEAF
 if(v.bushLeaf.x>.5){n=n.y<0?-n:n;half ndl=dot(n,light.direction);o.directF=o.directB=light.color*max(ndl,-ndl*.35);o.ambientF=o.ambientB=SampleSH(n);}
#endif
 o.uv=TRANSFORM_TEX(v.uv,_BaseMap); o.color=v.color; return o;
   }
#ifdef SMALL_PROP_LOCAL_LIGHTS
   half3 SmallPropLocalTerm(Light light,half3 n){return light.color*(light.distanceAttenuation*light.shadowAttenuation*saturate(dot(n,light.direction)));}
   half3 SmallPropLocal(Varyings i,half3 n){half3 result=0;
   #if defined(_ADDITIONAL_LIGHTS) || defined(_ADDITIONAL_LIGHTS_VERTEX) || USE_CLUSTER_LIGHT_LOOP
    InputData inputData=(InputData)0;inputData.positionWS=i.positionWS;inputData.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.positionCS);
    #if USE_CLUSTER_LIGHT_LOOP
     UNITY_LOOP for(uint lightIndex=0;lightIndex<min(URP_FP_DIRECTIONAL_LIGHTS_COUNT,MAX_VISIBLE_LIGHTS);lightIndex++)result+=SmallPropLocalTerm(GetAdditionalLight(lightIndex,i.positionWS,half4(1,1,1,1)),n);
    #endif
    uint count=GetAdditionalLightsCount();
    LIGHT_LOOP_BEGIN(count)
     result+=SmallPropLocalTerm(GetAdditionalLight(lightIndex,i.positionWS,half4(1,1,1,1)),n);
    LIGHT_LOOP_END
   #endif
    return result;
   }
#endif
   half4 Frag(Varyings i, FRONT_FACE_TYPE front:FRONT_FACE_SEMANTIC):SV_Target {
    half4 c=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,i.uv)*_BaseColor*i.color; clip(c.a-_Cutoff);
#ifdef ROOT_SURFACE
    RootSurfaceClip(i.rootSurface);c.rgb=RootSurfaceColor(c.rgb,i.rootSurface);
#endif
    // Diffuse-only vertex lighting, matching the browser's MeshLambertMaterial. No BRDF or reflections.
    half shadow=MainLightRealtimeShadow(TransformWorldToShadowCoord(i.positionWS));
    half3 direct=IS_FRONT_VFACE(front,i.directF,i.directB), ambient=IS_FRONT_VFACE(front,i.ambientF,i.ambientB);
    half3 emission=0;
#ifdef SHARED_GLOW
    emission=c.rgb*i.glow.x*(.85+.15*sin(_TDPineWind.w*9.+i.glow.y*13.));
#endif
    half3 local=0;
#ifdef SMALL_PROP_LOCAL_LIGHTS
    local=SmallPropLocal(i,normalize(IS_FRONT_VFACE(front,i.localNormal,-i.localNormal)));
#endif
    return half4(c.rgb*(ambient+direct*shadow+local)+emission,1);
   }
   ENDHLSL
  }
  Pass {
   Name "ShadowCaster" Tags { "LightMode"="ShadowCaster" } ZWrite On ColorMask 0
   HLSLPROGRAM
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma shader_feature_local _ SMALL_PROP_SHADOW_BIAS
   #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
   #pragma target 3.0
   #pragma shader_feature_local _ ROOT_SURFACE
   #pragma shader_feature_local _ ROOT_GROUND
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#ifdef SMALL_PROP_SHADOW_BIAS
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
   float3 _LightDirection;float3 _LightPosition;
#endif
   TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST, _BaseColor, _PineBand, _PineWaves, _PinePhase, _PineResponse, _PlantTouch, _TDRootSlope, _RootSurface,_TDRootTerrain,_RootPaintMap,_RootGrassParams,_RootDirtParams,_RootGrassOffset,_RootDirtOffset,_RootWaveA,_RootWaveB; float _Cutoff, _Cull, _PlantCombinedLimit;
   CBUFFER_END
   #define SHARED_PLANT_TOUCH_DECLARED
   #include "SharedPineWind.hlsl"
  #include "SharedRootGrounding.hlsl"
#ifdef ROOT_SURFACE
TEXTURE2D(_RootPaint);SAMPLER(sampler_RootPaint);
#define ROOT_PAINT(uv) SAMPLE_TEXTURE2D(_RootPaint,sampler_RootPaint,uv)
TEXTURE2D(_RootGrass);SAMPLER(sampler_RootGrass);TEXTURE2D(_RootDirt);SAMPLER(sampler_RootDirt);
#define ROOT_GRASS(uv) SAMPLE_TEXTURE2D(_RootGrass,sampler_RootGrass,uv).rgb
#define ROOT_DIRT(uv) SAMPLE_TEXTURE2D(_RootDirt,sampler_RootDirt,uv).rgb
#include "SharedRootSurface.hlsl"
#endif

   struct Varyings { float4 positionCS:SV_POSITION; float2 uv:TEXCOORD0;
#ifdef ROOT_SURFACE
float4 rootSurface:TEXCOORD1;
#endif
 };
   Varyings Vert(float4 p:POSITION,float3 normalOS:NORMAL,float2 uv:TEXCOORD0,float2 weights:TEXCOORD1,float2 rootMask:TEXCOORD3) { Varyings o;
#ifdef ROOT_SURFACE
o.rootSurface=RootSurfaceInfo(TransformObjectToWorld(p.xyz),TransformObjectToWorld(float3(0,0,0)),rootMask.x,rootMask.y,length(GetObjectToWorldMatrix()._m01_m11_m21));
#endif
o.positionCS=TransformObjectToHClip(p.xyz);float2 wind=SharedPlantOffset(p.y,uv.y,weights,TransformObjectToWorld(float3(0,0,0)).xz,length(GetObjectToWorldMatrix()._m00_m10_m20));if(dot(wind,wind)>0){float3 wp=TransformObjectToWorld(p.xyz);wp.xz+=wind;o.positionCS=TransformWorldToHClip(wp);}
#ifdef ROOT_GROUND
float3 rootWS=TransformObjectToWorld(p.xyz);rootWS.y+=SharedRootRise(rootWS,TransformObjectToWorld(float3(0,0,0)),rootMask.x,_TDRootSlope.xy);rootWS.xz+=wind;o.positionCS=TransformWorldToHClip(rootWS);
#endif
#ifdef SMALL_PROP_SHADOW_BIAS
// Opted-in small prop only: apply the light's existing URP bias, not new settings.
float3 shadowWS=TransformObjectToWorld(p.xyz);shadowWS.xz+=wind;
#ifdef ROOT_GROUND
shadowWS.y+=SharedRootRise(shadowWS,TransformObjectToWorld(float3(0,0,0)),rootMask.x,_TDRootSlope.xy);
#endif
#if _CASTING_PUNCTUAL_LIGHT_SHADOW
float3 shadowLightDirection=normalize(_LightPosition-shadowWS);
#else
float3 shadowLightDirection=_LightDirection;
#endif
o.positionCS=ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(shadowWS,TransformObjectToWorldNormal(normalOS),shadowLightDirection)));
#endif
 o.uv=TRANSFORM_TEX(uv,_BaseMap); return o; }
   half4 Frag(Varyings i):SV_Target { clip(SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,i.uv).a*_BaseColor.a-_Cutoff);
#ifdef ROOT_SURFACE
RootSurfaceClip(i.rootSurface);
#endif
return 0; }
   ENDHLSL
  }
 }
 SubShader {
  Tags { "RenderType"="Opaque" } Cull [_Cull]
  CGPROGRAM
  #pragma shader_feature_local _ ROOT_SURFACE
  #pragma surface Surf Lambert fullforwardshadows addshadow vertex:WindVert
  #pragma target 3.0
  #pragma shader_feature_local _ SHARED_GLOW
  #pragma shader_feature_local _ ROOT_GROUND
  sampler2D _BaseMap; half4 _BaseColor; half _Cutoff;float _PlantCombinedLimit;
  float4 _PineBand,_PineWaves,_PinePhase,_PineResponse,_TDRootSlope,_RootSurface,_TDRootTerrain,_RootPaintMap,_RootGrassParams,_RootDirtParams,_RootGrassOffset,_RootDirtOffset,_RootWaveA,_RootWaveB;
  #include "SharedPineWind.hlsl"
  #include "SharedRootGrounding.hlsl"
#ifdef ROOT_SURFACE
sampler2D _RootGrass,_RootDirt,_RootPaint;
#define ROOT_PAINT(uv) tex2D(_RootPaint,uv)
#define ROOT_GRASS(uv) tex2D(_RootGrass,uv).rgb
#define ROOT_DIRT(uv) tex2D(_RootDirt,uv).rgb
#include "SharedRootSurface.hlsl"
#endif
  struct Input { float2 uv_BaseMap; float4 color:COLOR; float facing:VFACE; float2 glow;
#ifdef ROOT_SURFACE
float4 rootSurface;
#endif
 };
  void WindVert(inout appdata_full v,out Input o){UNITY_INITIALIZE_OUTPUT(Input,o);
#ifdef ROOT_SURFACE
float3 originalWS=mul(unity_ObjectToWorld,v.vertex).xyz;o.rootSurface=RootSurfaceInfo(originalWS,mul(unity_ObjectToWorld,float4(0,0,0,1)).xyz,v.texcoord3.x,v.texcoord3.y,length(unity_ObjectToWorld._m01_m11_m21));v.normal=normalize(lerp(v.normal,float3(0,1,0),RootNormalBlend(o.rootSurface.z,v.texcoord3.y)));
#endif
#ifdef SHARED_GLOW
  o.glow=float2(v.texcoord2.x,v.vertex.y);
#endif
#ifdef ROOT_GROUND
float4 rootWS=mul(unity_ObjectToWorld,v.vertex);rootWS.y+=SharedRootRise(rootWS.xyz,mul(unity_ObjectToWorld,float4(0,0,0,1)).xyz,v.texcoord3.x,_TDRootSlope.xy);v.vertex=mul(unity_WorldToObject,rootWS);
#endif
float2 wind=SharedPlantOffset(v.vertex.y,v.texcoord.y,v.texcoord1.xy,mul(unity_ObjectToWorld,float4(0,0,0,1)).xz,length(unity_ObjectToWorld._m00_m10_m20));if(dot(wind,wind)>0){float4 wp=mul(unity_ObjectToWorld,v.vertex);wp.xz+=wind;v.vertex=mul(unity_WorldToObject,wp);}}

  void Surf(Input i,inout SurfaceOutput o) {
   half4 c=tex2D(_BaseMap,i.uv_BaseMap)*_BaseColor*i.color; clip(c.a-_Cutoff);
#ifdef ROOT_SURFACE
   RootSurfaceClip(i.rootSurface);c.rgb=RootSurfaceColor(c.rgb,i.rootSurface);
#endif
   o.Albedo=c.rgb;
#ifdef SHARED_GLOW
   o.Emission=c.rgb*i.glow.x*(.85+.15*sin(_TDPineWind.w*9.+i.glow.y*13.));
#endif
   o.Alpha=1; o.Normal=float3(0,0,i.facing>=0?1:-1);
  }
  ENDCG
 }
 Fallback Off
}
