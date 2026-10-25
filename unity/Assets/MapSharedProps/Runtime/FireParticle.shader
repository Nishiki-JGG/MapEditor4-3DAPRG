Shader "MapSharedProps/FireParticle" {
 Properties {_DstBlend("Destination blend",Float)=10}
 SubShader {Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Transparent" "RenderType"="Transparent"} Cull Off ZWrite Off Blend SrcAlpha [_DstBlend]
 Pass { HLSLPROGRAM
 #pragma vertex Vert
 #pragma fragment Frag
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 struct A {float4 positionOS:POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};struct V {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;half4 color:COLOR;};
 V Vert(A a){V o;o.positionCS=TransformObjectToHClip(a.positionOS.xyz);o.uv=a.uv;o.color=a.color;return o;}
 half4 Frag(V i):SV_Target{float2 p=i.uv*2-1;float edge=pow(max(0,1-dot(p,p)),2)*(.8+.2*sin(p.x*9+sin(p.y*8)));return half4(i.color.rgb,i.color.a*edge);}
 ENDHLSL } }
}
