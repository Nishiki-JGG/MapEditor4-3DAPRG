Shader "MapSharedProps/FireSurface" {
 Properties { _Phase("Phase",Float)=0 }
 SubShader { Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Transparent" "RenderType"="Transparent"} Cull Off ZWrite Off Blend SrcAlpha OneMinusSrcAlpha
 Pass { HLSLPROGRAM
 #pragma vertex Vert
 #pragma fragment Frag
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 CBUFFER_START(UnityPerMaterial) float _Phase; CBUFFER_END
 struct A {float4 positionOS:POSITION;float2 uv:TEXCOORD0;};struct V {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;};
 V Vert(A a){V o;float3 p=a.positionOS.xyz;p.x+=sin(a.uv.y*7-_Time.y*3+_Phase)*a.uv.y*a.uv.y*.075;o.positionCS=TransformObjectToHClip(p);o.uv=a.uv;return o;}
 float hash(float2 p){return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453);}float noise(float2 p){float2 i=floor(p),f=frac(p);f=f*f*(3-2*f);return lerp(lerp(hash(i),hash(i+float2(1,0)),f.x),lerp(hash(i+float2(0,1)),hash(i+1),f.x),f.y);}
 half4 Frag(V i):SV_Target{float t=_Time.y*1.7+_Phase;float2 p=float2(i.uv.x*2-1,i.uv.y);float n=noise(float2(p.x*3+_Phase,p.y*5-t*2))*.65+noise(float2(p.x*7-t*.3,p.y*11-t*3))*.35;float spine=sin(p.y*8-t*2)*.11*p.y;float w=pow(max(0,1-p.y),.7)*(.60+.24*n);float d=abs(p.x-spine)/max(.02,w);float a=(1-smoothstep(.55,1.,d))*smoothstep(0.,.045,p.y)*(1-smoothstep(.76,1.,p.y))*(.38+.28*n);float heat=saturate(1.25-p.y*1.3-d*.6+n*.16);float3 c=lerp(float3(.65,.035,.002),float3(1.,.35,.018),smoothstep(.05,.65,heat));c=lerp(c,float3(1.3,.95,.40),smoothstep(.6,1.,heat));return half4(c,a);}
 ENDHLSL } }
}
