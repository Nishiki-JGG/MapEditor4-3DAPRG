// 石と金属の区分は同一UVアトラスのPBR値。頂点色は線形の固有色。
Shader "MapSharedProps/BossDoor" {
 Properties {
  _BaseMap("Colour grain (sRGB)",2D)="white"{}
  _PackedMap("Metallic R / occlusion G / smoothness A",2D)="white"{}
  _BaseColor("Tint",Color)=(1,1,1,1)
  [Enum(UnityEngine.Rendering.CullMode)] _Cull("Cull",Float)=2
 }
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"} Cull [_Cull]
  Pass {
   Name "ForwardLit" Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma target 3.0
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile_instancing
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
   #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
   #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
   #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
   #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
   #pragma multi_compile_fog
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor;float _Cull;
   CBUFFER_END
   TEXTURE2D(_BaseMap);SAMPLER(sampler_BaseMap);
   TEXTURE2D(_PackedMap);SAMPLER(sampler_PackedMap);
   struct A {float4 positionOS:POSITION;float3 normalOS:NORMAL;float2 uv:TEXCOORD0;float4 colour:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID};
   struct V {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;half3 normalWS:TEXCOORD1;float2 uv:TEXCOORD2;float4 colour:COLOR;half fog:TEXCOORD3;half3 vertexLight:TEXCOORD4;UNITY_VERTEX_INPUT_INSTANCE_ID UNITY_VERTEX_OUTPUT_STEREO};
   V Vert(A i){V o=(V)0;UNITY_SETUP_INSTANCE_ID(i);UNITY_TRANSFER_INSTANCE_ID(i,o);UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);VertexPositionInputs p=GetVertexPositionInputs(i.positionOS.xyz);o.positionCS=p.positionCS;o.positionWS=p.positionWS;o.normalWS=TransformObjectToWorldNormal(i.normalOS);o.uv=i.uv;o.colour=i.colour*_BaseColor;o.fog=ComputeFogFactor(p.positionCS.z);o.vertexLight=VertexLighting(p.positionWS,o.normalWS);return o;}
   half4 Frag(V i):SV_Target {
    UNITY_SETUP_INSTANCE_ID(i);UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
    half4 packed=SAMPLE_TEXTURE2D(_PackedMap,sampler_PackedMap,i.uv);
    InputData input=(InputData)0;input.positionWS=i.positionWS;input.normalWS=NormalizeNormalPerPixel(i.normalWS);input.viewDirectionWS=GetWorldSpaceNormalizeViewDir(i.positionWS);input.shadowCoord=TransformWorldToShadowCoord(i.positionWS);input.bakedGI=SampleSH(input.normalWS);input.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.positionCS);input.shadowMask=half4(1,1,1,1);input.vertexLighting=i.vertexLight;
    SurfaceData surface=(SurfaceData)0;surface.albedo=i.colour.rgb*SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,i.uv).rgb;surface.metallic=packed.r;surface.smoothness=packed.a;surface.occlusion=packed.g;surface.alpha=1;surface.normalTS=half3(0,0,1);
    half4 colour=UniversalFragmentPBR(input,surface);colour.rgb=MixFog(colour.rgb,i.fog);return colour;
   }
   ENDHLSL
  }
  Pass {
   Name "ShadowCaster" Tags {"LightMode"="ShadowCaster"} ZWrite On ColorMask 0
   HLSLPROGRAM
   #pragma target 3.0
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile_instancing
   #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor;float _Cull;
   CBUFFER_END
   float3 _LightDirection,_LightPosition;
   struct A {float4 p:POSITION;float3 n:NORMAL;UNITY_VERTEX_INPUT_INSTANCE_ID};
   float4 Vert(A i):SV_POSITION {UNITY_SETUP_INSTANCE_ID(i);float3 w=TransformObjectToWorld(i.p.xyz),n=TransformObjectToWorldNormal(i.n);
   #if _CASTING_PUNCTUAL_LIGHT_SHADOW
    float3 direction=normalize(_LightPosition-w);
   #else
    float3 direction=_LightDirection;
   #endif
    return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(w,n,direction)));
   }
   half4 Frag():SV_Target{return 0;}
   ENDHLSL
  }
  Pass {
   Name "DepthOnly" Tags {"LightMode"="DepthOnly"} ZWrite On ColorMask R
   HLSLPROGRAM
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile_instancing
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   struct A {float4 p:POSITION;UNITY_VERTEX_INPUT_INSTANCE_ID};
   float4 Vert(A i):SV_POSITION {UNITY_SETUP_INSTANCE_ID(i);return TransformObjectToHClip(i.p.xyz);}
   half4 Frag():SV_Target{return 0;}
   ENDHLSL
  }
 }
 Fallback Off
}
