// Dedicated to the three upper chest variants. SharedPropLit is unchanged.
Shader "MapSharedProps/ChestMetal" {
 Properties {
  [HideInInspector] _ChestMean0("Wood far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean1("Worn far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean2("Metal far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean3("Etched far mean",Vector)=(1,1,1,1)
  _ChestColour("Surface colour sRGB",2D)="white"{} _ChestPacked("NormalXY roughness AO",2D)="white"{} _ChestVariant("Surface variant",Float)=4 _ChestWoodRect("Wood UV rectangle",Vector)=(0,0,1,1)
  _BaseMap("Base colour",2D)="white"{} _BaseColor("Tint",Color)=(1,1,1,1)
  _Rainbow("Iridescent coat",Range(0,1))=0 _ChestTime("Time override; negative uses runtime",Float)=-1
  _Cutoff("Cutoff",Float)=0 [Enum(UnityEngine.Rendering.CullMode)] _Cull("Cull",Float)=2
 }
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"} Cull [_Cull]
  HLSLINCLUDE
  // Presentation only; root geometry and collider remain unchanged.
  float3 ChestSeamPosition(float3 p,float marked,float variant){if(variant>4.5&&variant<5.5&&marked>.5&&p.y>.43&&abs(abs(p.x)-.20)<.0076)p.x=sign(p.x)*.20+(p.x-sign(p.x)*.20)*.20;return p;}
  ENDHLSL
  Pass {
   Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma target 3.0
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma shader_feature_local _ CHEST_ORNAMENT
   #pragma shader_feature_local _ CHEST_SURFACE
   #pragma multi_compile_instancing
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile_fragment _ _SHADOWS_SOFT
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor,_ChestWoodRect,_ChestMean0,_ChestMean1,_ChestMean2,_ChestMean3;float _Rainbow,_ChestTime,_Cutoff,_Cull,_ChestVariant;
   CBUFFER_END
   #if defined(CHEST_SURFACE)
   #include "ChestSurface.hlsl"
   #endif
   struct A {float4 positionOS:POSITION;float3 normalOS:NORMAL;float4 color:COLOR;float glow:TEXCOORD2;float2 uv:TEXCOORD0;UNITY_VERTEX_INPUT_INSTANCE_ID
   #if defined(CHEST_ORNAMENT)
   float finish:TEXCOORD3;float surfaceMode:TEXCOORD1;
   #endif
   };
   struct V {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;float3 normalWS:TEXCOORD1;float3 positionOS:TEXCOORD2;float4 color:COLOR;float glow:TEXCOORD3;float finish:TEXCOORD4;float ink:TEXCOORD5;float3 surface:TEXCOORD6;};
   V Vert(A v){UNITY_SETUP_INSTANCE_ID(v);
   #if defined(CHEST_SURFACE)
    float seamMark=1-step(-3,v.uv.x);
    #if defined(CHEST_ORNAMENT)
    seamMark=max(seamMark,v.finish);
    #endif
    v.positionOS.xyz=ChestSeamPosition(v.positionOS.xyz,seamMark,_ChestVariant);
   #endif
   V o;VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);o.positionCS=p.positionCS;o.positionWS=p.positionWS;o.normalWS=TransformObjectToWorldNormal(v.normalOS);o.positionOS=v.positionOS.xyz;o.color=v.color*_BaseColor;o.glow=v.glow;o.finish=0;o.ink=1-step(-3,v.uv.x);o.surface=0;
   #if defined(CHEST_SURFACE)
   #if defined(CHEST_ORNAMENT)
   o.surface=ChestOrnamentUV(v.positionOS.xyz,v.surfaceMode,v.glow);
   #else
   o.surface=ChestSurfaceUV(v.positionOS.xyz,v.normalOS,v.uv,v.glow);
   #endif
   #endif
   #if defined(CHEST_ORNAMENT)
   o.finish=v.finish;o.ink=max(o.ink,v.finish);
   #endif
   return o;}
   half4 Frag(V i):SV_Target {
    float3 n=normalize(i.normalWS),finishColour=i.color.rgb;float surfaceMask=0;float4 detail=float4(.5,.5,.5,1);
    #if defined(CHEST_SURFACE)
    float3 surfaceUV=ChestSurfaceSampleUV(i.surface,i.positionOS);detail=ChestPacked(surfaceUV,i.surface,i.positionOS);surfaceMask=step(.5,i.surface.z);n=ChestDetailNormal(n,i.positionWS,surfaceUV.xy,(detail.xy*2-1)*surfaceMask);finishColour*=lerp(1,ChestColour(surfaceUV,i.surface,i.positionOS)*detail.a,surfaceMask);
    #endif
    float3 nv=normalize(mul((float3x3)UNITY_MATRIX_V,n)),cv=normalize(mul((float3x3)UNITY_MATRIX_V,GetWorldSpaceNormalizeViewDir(i.positionWS)));
    Light light=GetMainLight();float3 cl=normalize(mul((float3x3)UNITY_MATRIX_V,float3(-.3,.8,.5)));
    #if defined(CHEST_SURFACE)
    cl=normalize(mul((float3x3)UNITY_MATRIX_V,light.direction));
    #endif
    float shadow=MainLightRealtimeShadow(TransformWorldToShadowCoord(i.positionWS));
    float cs=pow(max(0,dot(nv,normalize(cl+cv))),lerp(lerp(80,160,i.finish),lerp(180,18,detail.b),surfaceMask)),cr=pow(1-max(0,dot(nv,cv)),3),t=_ChestTime<0?_Time.y:_ChestTime;
    cs*=lerp(1,lerp(1.12,.42,detail.b),surfaceMask);
    float3 refl=reflect(-cv,nv);float env=.14+.45*smoothstep(-.10,.55,refl.y)+.65*pow(max(0,1-abs(refl.y-.4)),lerp(16,lerp(48,6,detail.b),surfaceMask));
    env*=lerp(1,lerp(1.18,.48,detail.b),surfaceMask);float3 coat=.5+.5*cos(float3(0,2.094,4.188)+dot(nv,cv)*9+t*.45);
    float gain=saturate(dot(SampleSH(float3(0,1,0)),float3(.2126,.7152,.0722))/.35);
    float3 rgb=finishColour*(SampleSH(n)+light.color*max(0,dot(n,light.direction))*shadow)*lerp(.46,.92,i.finish);
    rgb+=finishColour*env*lerp(.62,.08,i.finish)*gain+lerp(lerp(float3(1,1,1),finishColour,.35),float3(.025,.025,.025)+finishColour*.8,i.ink)*(cs*lerp(.95,.35,i.finish)+cr*.14)*gain;
    rgb+=(1-i.ink)*_Rainbow*coat*(.10+cr*.14)*gain+finishColour*i.glow*(.72+.28*sin(t*3+i.positionOS.x*17+i.positionOS.z*11));
    return half4(rgb,1);
   }
   ENDHLSL
  }
  // Standard URP caster bias belongs to this new material, never a global override.
  Pass {
   Name "ShadowCaster" Tags {"LightMode"="ShadowCaster"} ZWrite On ColorMask 0
   HLSLPROGRAM
   #pragma target 3.0
   #pragma shader_feature_local _ CHEST_SURFACE
   #pragma shader_feature_local _ CHEST_ORNAMENT
   #pragma vertex ShadowVert
   #pragma multi_compile_instancing
   #pragma fragment ShadowFrag
   #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor,_ChestWoodRect,_ChestMean0,_ChestMean1,_ChestMean2,_ChestMean3;float _Rainbow,_ChestTime,_Cutoff,_Cull,_ChestVariant;
   CBUFFER_END
   float3 _LightDirection;float3 _LightPosition;
   struct SA {float4 p:POSITION;float3 normalOS:NORMAL;float2 uv:TEXCOORD0;
   #if defined(CHEST_ORNAMENT)
   float finish:TEXCOORD3;
   #endif
   UNITY_VERTEX_INPUT_INSTANCE_ID};
   float4 ShadowVert(SA i):SV_POSITION {
    UNITY_SETUP_INSTANCE_ID(i);
    #if defined(CHEST_SURFACE)
    float seamMark=1-step(-3,i.uv.x);
    #if defined(CHEST_ORNAMENT)
    seamMark=max(seamMark,i.finish);
    #endif
    i.p.xyz=ChestSeamPosition(i.p.xyz,seamMark,_ChestVariant);
    #endif
    float3 positionWS=TransformObjectToWorld(i.p.xyz),normalWS=TransformObjectToWorldNormal(i.normalOS);
    #if _CASTING_PUNCTUAL_LIGHT_SHADOW
    float3 direction=normalize(_LightPosition-positionWS);
    #else
    float3 direction=_LightDirection;
    #endif
    return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(positionWS,normalWS,direction)));
   }
   half4 ShadowFrag():SV_Target{return 0;}
   ENDHLSL
  }
 }
 SubShader {
  Tags {"RenderType"="Opaque"} Cull [_Cull]
  CGPROGRAM
  #pragma surface Surf Standard fullforwardshadows addshadow
  #pragma target 3.0
  half4 _BaseColor;half _Rainbow;float _ChestTime;
  struct Input {float4 color:COLOR;float3 viewDir;float2 uv_BaseMap;};
  void Surf(Input i,inout SurfaceOutputStandard o){o.Albedo=i.color.rgb*_BaseColor.rgb;o.Metallic=.65;o.Smoothness=.78;float t=_ChestTime<0?_Time.y:_ChestTime;o.Emission=step(-3,i.uv_BaseMap.x)*_Rainbow*(.5+.5*cos(float3(0,2.094,4.188)+i.viewDir.z*9+t*.45))*.14;}
  ENDCG
 }
}
