Shader "MapSharedProps/Lit" {
 Properties {
  _BaseMap("Base colour (sRGB) / alpha", 2D) = "white" {}
  _BaseColor("Linear base colour", Color) = (1,1,1,1)
  _PineBand("Pine minY/maxY/max displacement/enabled", Vector)=(2.15,6.408,.12,0)
  _PineWaves("Pine rates/amplitudes", Vector)=(1.7,.65,2.9,.35)
  _PinePhase("Pine phase coefficients", Vector)=(.17,.13,0,0)
  _PineResponse("Wind strength linear/quadratic/mean/gust", Vector)=(0,0,0,0)
  _PlantCombinedLimit("Optional combined wind/contact cap", Float)=0
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
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile_fragment _ _SHADOWS_SOFT
   #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST, _BaseColor, _PineBand, _PineWaves, _PinePhase, _PineResponse, _PlantTouch; float _Cutoff, _Cull, _PlantCombinedLimit;
   CBUFFER_END
   #define SHARED_PLANT_TOUCH_DECLARED
   #include "SharedPineWind.hlsl"
   struct Attributes { float4 positionOS:POSITION; float3 normalOS:NORMAL; float2 uv:TEXCOORD0; float2 weights:TEXCOORD1; float4 color:COLOR; };
   struct Varyings { float4 positionCS:SV_POSITION; float3 positionWS:TEXCOORD0; half3 directF:TEXCOORD1; float2 uv:TEXCOORD2; half3 directB:TEXCOORD3; half3 ambientF:TEXCOORD4; half3 ambientB:TEXCOORD5; float4 color:COLOR; };
   Varyings Vert(Attributes v) {
    Varyings o; VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);
    float2 wind=SharedPlantOffset(v.positionOS.y,v.uv.y,v.weights,TransformObjectToWorld(float3(0,0,0)).xz,length(GetObjectToWorldMatrix()._m00_m10_m20));
    if(dot(wind,wind)>0){p.positionWS.xz+=wind;p.positionCS=TransformWorldToHClip(p.positionWS);}
    o.positionCS=p.positionCS; o.positionWS=p.positionWS; half3 n=TransformObjectToWorldNormal(v.normalOS); Light light=GetMainLight(); o.directF=light.color*max(0,dot(n,light.direction)); o.directB=light.color*max(0,dot(-n,light.direction)); o.ambientF=SampleSH(n); o.ambientB=SampleSH(-n); o.uv=TRANSFORM_TEX(v.uv,_BaseMap); o.color=v.color; return o;
   }
   half4 Frag(Varyings i, FRONT_FACE_TYPE front:FRONT_FACE_SEMANTIC):SV_Target {
    half4 c=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,i.uv)*_BaseColor*i.color; clip(c.a-_Cutoff);
    // Diffuse-only vertex lighting, matching the browser's MeshLambertMaterial. No BRDF or reflections.
    half shadow=MainLightRealtimeShadow(TransformWorldToShadowCoord(i.positionWS));
    half3 direct=IS_FRONT_VFACE(front,i.directF,i.directB), ambient=IS_FRONT_VFACE(front,i.ambientF,i.ambientB);
    return half4(c.rgb*(ambient+direct*shadow),1);
   }
   ENDHLSL
  }
  Pass {
   Name "ShadowCaster" Tags { "LightMode"="ShadowCaster" } ZWrite On ColorMask 0
   HLSLPROGRAM
   #pragma vertex Vert
   #pragma fragment Frag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST, _BaseColor, _PineBand, _PineWaves, _PinePhase, _PineResponse, _PlantTouch; float _Cutoff, _Cull, _PlantCombinedLimit;
   CBUFFER_END
   #define SHARED_PLANT_TOUCH_DECLARED
   #include "SharedPineWind.hlsl"
   struct Varyings { float4 positionCS:SV_POSITION; float2 uv:TEXCOORD0; };
   Varyings Vert(float4 p:POSITION,float2 uv:TEXCOORD0,float2 weights:TEXCOORD1) { Varyings o; o.positionCS=TransformObjectToHClip(p.xyz);float2 wind=SharedPlantOffset(p.y,uv.y,weights,TransformObjectToWorld(float3(0,0,0)).xz,length(GetObjectToWorldMatrix()._m00_m10_m20));if(dot(wind,wind)>0){float3 wp=TransformObjectToWorld(p.xyz);wp.xz+=wind;o.positionCS=TransformWorldToHClip(wp);} o.uv=TRANSFORM_TEX(uv,_BaseMap); return o; }
   half4 Frag(Varyings i):SV_Target { clip(SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,i.uv).a*_BaseColor.a-_Cutoff); return 0; }
   ENDHLSL
  }
 }
 SubShader {
  Tags { "RenderType"="Opaque" } Cull [_Cull]
  CGPROGRAM
  #pragma surface Surf Lambert fullforwardshadows addshadow vertex:WindVert
  #pragma target 3.0
  sampler2D _BaseMap; half4 _BaseColor; half _Cutoff;float _PlantCombinedLimit;
  float4 _PineBand,_PineWaves,_PinePhase,_PineResponse;
  #include "SharedPineWind.hlsl"
  void WindVert(inout appdata_full v){float2 wind=SharedPlantOffset(v.vertex.y,v.texcoord.y,v.texcoord1.xy,mul(unity_ObjectToWorld,float4(0,0,0,1)).xz,length(unity_ObjectToWorld._m00_m10_m20));if(dot(wind,wind)>0){float4 wp=mul(unity_ObjectToWorld,v.vertex);wp.xz+=wind;v.vertex=mul(unity_WorldToObject,wp);}}
  struct Input { float2 uv_BaseMap; float4 color:COLOR; float facing:VFACE; };
  void Surf(Input i,inout SurfaceOutput o) {
   half4 c=tex2D(_BaseMap,i.uv_BaseMap)*_BaseColor*i.color; clip(c.a-_Cutoff);
   o.Albedo=c.rgb; o.Alpha=1; o.Normal=float3(0,0,i.facing>=0?1:-1);
  }
  ENDCG
 }
 Fallback Off
}
