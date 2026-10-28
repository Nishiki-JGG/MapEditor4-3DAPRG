// Only tiedsack / coiledrope opt in through the Native builder. SharedPropLit is unchanged.
Shader "MapSharedProps/FibreProp" {
 Properties {_BaseMap("Base",2D)="white"{} _BaseColor("Tint",Color)=(1,1,1,1) _FibreKind("0 cloth / 1 rope",Float)=0 _Cutoff("Cutoff",Float)=0 [Enum(UnityEngine.Rendering.CullMode)] _Cull("Cull",Float)=2}
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"} Cull [_Cull]
  Pass {
   Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma target 3.0
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile_fragment _ _SHADOWS_SOFT
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor;float _FibreKind,_Cutoff,_Cull;
   CBUFFER_END
   struct A {float4 p:POSITION;float3 n:NORMAL;float2 uv:TEXCOORD0;float4 color:COLOR;};
   struct V {float4 p:SV_POSITION;float3 world:TEXCOORD0;float3 n:TEXCOORD1;float2 uv:TEXCOORD2;float4 color:COLOR;};
   V Vert(A i){V o;VertexPositionInputs p=GetVertexPositionInputs(i.p.xyz);o.p=p.positionCS;o.world=p.positionWS;o.n=TransformObjectToWorldNormal(i.n);o.uv=i.uv;o.color=i.color*_BaseColor;return o;}
   float3 Detail(float2 uv){if(_FibreKind>.5){float fade=1-smoothstep(.2,1,max(fwidth(uv.x),fwidth(uv.y)*3));float a=6.2831853*(uv.y*3-uv.x),h=sin(a),d=cos(a);return float3(1-.24*pow(.5-.5*h,3)*fade,-6.2831853*d*fade,18.849556*d*fade);}float fade=1-smoothstep(.18,.9,max(fwidth(uv.x*36),fwidth(uv.y*36)));float2 a=uv*226.194671;return float3(1-.012*fade+.012*sin(a.x)*sin(a.y)*fade,226.194671*cos(a.x)*sin(a.y)*fade,226.194671*sin(a.x)*cos(a.y)*fade);}
   float3 FinishNormal(float3 n,float3 p,float2 uv,float2 gradient){float3 dx=ddx(p),dy=ddy(p);float2 ux=ddx(uv),uy=ddy(uv);float3 tangent=dx*uy.y-dy*ux.y,bitangent=dy*ux.x-dx*uy.x;float det=ux.x*uy.y-ux.y*uy.x,scale=rsqrt(max(max(dot(tangent,tangent),dot(bitangent,bitangent)),1e-12));return normalize(n-(tangent*gradient.x+bitangent*gradient.y)*scale*sign(det)*(_FibreKind>.5?.030:.00035));}
   half4 Frag(V i):SV_Target {float3 d=Detail(i.uv),n=FinishNormal(normalize(i.n),i.world,i.uv,d.yz);Light light=GetMainLight();float shadow=MainLightRealtimeShadow(TransformWorldToShadowCoord(i.world));return half4(i.color.rgb*d.x*(SampleSH(n)+light.color*max(0,dot(n,light.direction))*shadow),1);}
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
    float4 _BaseColor;float _FibreKind,_Cutoff,_Cull;
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
 SubShader {
  Tags {"RenderType"="Opaque"} Cull [_Cull]
  CGPROGRAM
  #pragma surface Surf Lambert fullforwardshadows addshadow
  #pragma target 3.0
  sampler2D _BaseMap;float4 _BaseColor;float _FibreKind;
  struct Input {float2 uv_BaseMap;float4 color:COLOR;};
  void Surf(Input i,inout SurfaceOutput o){float2 uv=i.uv_BaseMap;float fade=1-smoothstep(.2,1,max(fwidth(uv.x),fwidth(uv.y)*3));float rope=1-.24*pow(.5-.5*sin(6.2831853*(uv.y*3-uv.x)),3)*fade;float cf=1-smoothstep(.18,.9,max(fwidth(uv.x*36),fwidth(uv.y*36)));float cloth=1-.012*cf+.012*sin(uv.x*226.194671)*sin(uv.y*226.194671)*cf;o.Albedo=i.color.rgb*_BaseColor.rgb*(_FibreKind>.5?rope:cloth);}
  ENDCG
 }
}
