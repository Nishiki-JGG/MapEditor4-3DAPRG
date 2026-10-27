// Four wood-family chests only. Original mesh, collider and legacy UV remain unchanged.
Shader "MapSharedProps/ChestWood" {
 Properties {
  [HideInInspector] _ChestMean0("Wood far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean1("Worn far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean2("Metal far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean3("Etched far mean",Vector)=(1,1,1,1)
  _BaseMap("Legacy atlas",2D)="white"{} _BaseColor("Tint",Color)=(1,1,1,1) _ChestColour("Colour sRGB",2D)="white"{} _ChestPacked("NormalXY roughness AO linear",2D)="white"{} _ChestVariant("Variant",Float)=1 _ChestWoodRect("Legacy wood UV rectangle",Vector)=(0,0,1,1) _Cutoff("Legacy cutoff",Float)=0 [Enum(UnityEngine.Rendering.CullMode)] _Cull("Cull",Float)=2}
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"} Cull [_Cull]
  Pass {
   Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma target 3.0
   #pragma shader_feature_local _ CHEST_SURFACE
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile_instancing
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile_fragment _ _SHADOWS_SOFT
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor,_ChestWoodRect,_ChestMean0,_ChestMean1,_ChestMean2,_ChestMean3;float _ChestVariant,_Cutoff,_Cull;
   CBUFFER_END
   #include "ChestSurface.hlsl"
   struct A {float4 p:POSITION;float3 n:NORMAL;float2 uv:TEXCOORD0;float4 colour:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID};
   struct V {float4 p:SV_POSITION;float3 world:TEXCOORD0;float3 n:TEXCOORD1;float3 surface:TEXCOORD2;float4 colour:COLOR;};
   V Vert(A i){UNITY_SETUP_INSTANCE_ID(i);V o;VertexPositionInputs p=GetVertexPositionInputs(i.p.xyz);o.p=p.positionCS;o.world=p.positionWS;o.n=TransformObjectToWorldNormal(i.n);o.surface=ChestSurfaceUV(i.p.xyz,i.n,i.uv,0);float woodMask=step(.5,o.surface.z)*(1-step(1.5,o.surface.z));o.colour=float4(lerp(i.colour.rgb,float3(.85,.85,.85),woodMask),i.colour.a)*_BaseColor;return o;}
   half4 Frag(V i):SV_Target {float4 packed=ChestPacked(i.surface,i.surface,0);InputData input=(InputData)0;input.positionWS=i.world;input.normalWS=ChestDetailNormal(normalize(i.n),i.world,i.surface.xy,(packed.xy*2-1)*step(.5,i.surface.z));input.viewDirectionWS=GetWorldSpaceNormalizeViewDir(i.world);input.shadowCoord=TransformWorldToShadowCoord(i.world);input.bakedGI=SampleSH(input.normalWS);input.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.p);input.shadowMask=1;SurfaceData surface=(SurfaceData)0;surface.albedo=i.colour.rgb*lerp(1,ChestColour(i.surface,i.surface,0),step(.5,i.surface.z));surface.metallic=i.surface.z>1.5?.65:0;surface.smoothness=1-lerp(.22,packed.b,step(.5,i.surface.z));surface.occlusion=lerp(1,packed.a,step(.5,i.surface.z));surface.alpha=1;surface.normalTS=float3(0,0,1);return UniversalFragmentPBR(input,surface);}
   ENDHLSL
  }
  Pass {
   Name "ShadowCaster" Tags {"LightMode"="ShadowCaster"} ZWrite On ColorMask 0
   HLSLPROGRAM
   #pragma target 3.0
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor,_ChestWoodRect,_ChestMean0,_ChestMean1,_ChestMean2,_ChestMean3;float _ChestVariant,_Cutoff,_Cull;
   CBUFFER_END
   float3 _LightDirection,_LightPosition;
   float4 Vert(float4 p:POSITION,float3 normal:NORMAL):SV_POSITION {float3 w=TransformObjectToWorld(p.xyz),n=TransformObjectToWorldNormal(normal);
   #if _CASTING_PUNCTUAL_LIGHT_SHADOW
   float3 direction=normalize(_LightPosition-w);
   #else
   float3 direction=_LightDirection;
   #endif
   return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(w,n,direction)));}
   half4 Frag():SV_Target{return 0;}
   ENDHLSL
  }
 }
 Fallback "MapSharedProps/Lit"
}
