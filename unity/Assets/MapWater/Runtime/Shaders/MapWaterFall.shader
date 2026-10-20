Shader "MapWater/Fall"
{
 // 滝の板。CAV-002 の NaturalFall（開始基準 R120 と同じ、透明で軽い）を、落差に合わせて使えるようにしたもの。
 // 板の uv：x = 横 0..1、y = 上(-2)から下(+2)。_FallHeight（落差m）で縦の模様を引き伸ばす（基準は落差6mで uv 4 = v 10）。
 Properties{_Phase("Time",Float)=0 _FallHeight("Fall height (m)",Float)=6 _WaterY("Water surface world y",Float)=0}
 SubShader{Tags{"RenderPipeline"="UniversalPipeline" "RenderType"="Transparent" "Queue"="Transparent+10"}
 Pass{Tags{"LightMode"="UniversalForward"} Blend SrcAlpha OneMinusSrcAlpha ZWrite Off Cull Off
 HLSLPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #pragma target 3.5
 #pragma multi_compile _ _ADDITIONAL_LIGHTS
 #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
 #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
 #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
 #pragma multi_compile_fragment _ _SHADOWS_SOFT
 #include "MapWaterCommon.hlsl"
 CBUFFER_START(UnityPerMaterial)
 float _Phase,_FallHeight,_WaterY;
 CBUFFER_END
 struct A{float4 p:POSITION;float2 uv:TEXCOORD0;};
 struct V{float4 p:SV_POSITION;float3 w:TEXCOORD0;float2 uv:TEXCOORD1;};
 V vert(A a){V o;o.w=TransformObjectToWorld(a.p.xyz);o.p=TransformWorldToHClip(o.w);o.uv=a.uv;return o;}
 half4 frag(V i):SV_Target{
  float stretch=_FallHeight/6.0;
  float u=i.uv.x,y4=i.uv.y+2,v=y4*2.5*stretch-_Phase*6.2;
  float warp=(MWNoise(float2(v*.18,_Phase*.22))-.5)*.13;
  float ropes=.60*MWNoise(float2((u+warp)*6.3,v*.30))+.27*MWNoise(float2(u*17.7+3,v*.83))+.13*MWNoise(float2(u*39.1,v*1.9));
  float body=smoothstep(.30,.62,ropes);   // 水の筋（束）。束と束の間は透ける
  float left=.045+.085*MWNoise(float2(v*.4,1.1)),right=.955-.085*MWNoise(float2(v*.35,8.7));
  float silhouette=smoothstep(left,left+.13,u)*(1-smoothstep(right-.13,right,u));   // 左右の縁は柔らかく消える
  float lower=smoothstep(.80,1,y4*.25);
  float breakup=lerp(1,lerp(.15,1,smoothstep(.25,.68,MWNoise(float2(u*15,v*2)))),lower*.7);
  float submerged=1-smoothstep(.01,.19,_WaterY-i.w.y);
  float topFade=smoothstep(0,.35,y4);   // 落ち口でなじませる
  float alpha=silhouette*(.08+.40*body)*breakup*submerged*topFade;   // 最大でも約0.6：背後の崖が透ける（昼の日光で灰白色の板にならないよう上限を下げた）
  clip(alpha-.018);
  float3 light=MWRadiance(i.w,i.p);
  float lum=saturate(dot(light,float3(.3,.59,.11)));
  float3 tint=float3(.30,.55,.62)*(.35+.65*lum);                       // 水の色（束の間・薄い所）
  float3 c=lerp(tint,light*.85,body*.75);                              // 束の芯は明るい白
  return half4(c,alpha);
 }
 ENDHLSL
 }}}
