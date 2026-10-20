Shader "Hidden/MapSharedProps/PineWindReference" {
 Properties {_BaseMap("Map",2D)="white"{} _Cutoff("Cutoff",Float)=.42 _PineBand("Band",Vector)=(2.15,6.408,.12,1) _PineWaves("Waves",Vector)=(1.7,.65,2.9,.35) _PinePhase("Phase",Vector)=(.17,.13,0,0)}
 SubShader {Tags {"RenderPipeline"="UniversalPipeline"} Cull Off Pass {
 HLSLPROGRAM
 #pragma vertex Vert
 #pragma fragment Frag
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 TEXTURE2D(_BaseMap);SAMPLER(sampler_BaseMap);
 float4 _PineBand,_PineWaves,_PinePhase;float _Cutoff;
 #include "Assets/MapSharedProps/Runtime/SharedPineWind.hlsl"
 struct Varyings{float4 p:SV_POSITION;float2 uv:TEXCOORD0;float4 color:COLOR;};
 Varyings Vert(float4 p:POSITION,float2 uv:TEXCOORD0,float4 color:COLOR){Varyings o;o.p=TransformObjectToHClip(p.xyz);float2 wind=SharedPineOffset(p.y,uv.y,TransformObjectToWorld(float3(0,0,0)).xz);if(dot(wind,wind)>0){float3 wp=TransformObjectToWorld(p.xyz);wp.xz+=wind;o.p=TransformWorldToHClip(wp);}o.uv=uv;o.color=color;return o;}
 half4 Frag(Varyings i):SV_Target{half4 c=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,i.uv)*i.color;clip(c.a-_Cutoff);return half4(c.rgb,1);}
 ENDHLSL
 }}
}
