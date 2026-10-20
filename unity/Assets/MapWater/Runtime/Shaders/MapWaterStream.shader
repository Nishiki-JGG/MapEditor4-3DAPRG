Shader "MapWater/Stream"
{
 // 滝の上の小川（水源から落ち口まで）の帯。マップエディターの小川（streamMat）を、Unity 用にしたもの。
 // メッシュ：uv0 = (横 0..1, 水源から落ち口まで 0..1)、uv1.x = 水源からの距離(m)。
 Properties{_Phase("Time",Float)=0}
 SubShader{Tags{"RenderPipeline"="UniversalPipeline" "RenderType"="Transparent" "Queue"="Transparent+5"}
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
 float _Phase;
 CBUFFER_END
 struct A{float4 p:POSITION;float2 uv:TEXCOORD0;float2 uv1:TEXCOORD1;};
 struct V{float4 p:SV_POSITION;float3 w:TEXCOORD0;float3 info:TEXCOORD1;};
 V vert(A a){V o;o.w=TransformObjectToWorld(a.p.xyz);o.p=TransformWorldToHClip(o.w);o.info=float3(a.uv.x,a.uv.y,a.uv1.x);return o;}
 float MWFbm(float2 p){return MWNoise(p)*.6+MWNoise(p*2.07+5.2)*.28+MWNoise(p*4.1+9)*.12;}
 half4 frag(V i):SV_Target{
  float x=i.info.x,t=i.info.y,dist=i.info.z;
  float s1=MWFbm(float2(x*5.,dist*1.3-_Phase*1.9)),s2=MWNoise(float2(x*14.,dist*3.-_Phase*3.2));
  float3 c=lerp(float3(.14,.34,.33),float3(.07,.24,.28),smoothstep(.2,.5,-abs(x-.5)+.5));   // 7回目：上から鮮やかなターコイズの台形に見えた → 彩度と明るさを下げる   // 池・川の青緑に寄せた（鮮やかなシアンだと別の材質に見えた）
  c=lerp(c,float3(.80,.93,.95),smoothstep(.55,.85,s1*.8+s2*.4)*.30);
  float rapids=smoothstep(.75,1.,t)+smoothstep(.12,0.,t)*.7;   // 落ち口と水源の白い波
  c=lerp(c,float3(.92,.97,.98),saturate(rapids)*(.18+.30*s2));   // 落ち口の白飛びを弱めた
  float edge=smoothstep(0.,.18,x)*smoothstep(1.,.82,x);
  c=lerp(c,float3(.95,1.,1.),(1-edge)*.5*s1);
  float3 light=MWRadiance(i.w,i.p);
  float lum=saturate(dot(light,float3(.3,.59,.11))*.75+.2);   // 6回目：上から日光で明るく浮いた
  float lip=smoothstep(1.,.92,t)*smoothstep(0.,.06,t);   // 水源側の端もぼかす   // 落ち口の縁はぼかして滝の板へつなぐ（直線の平らな板に見えた）
  return half4(pow(c,2.2)*lum,(edge*.62+.05)*lip);   // 7回目：不透明（.9）だと地面の上の色の板に見えた → 下の地面が透ける
 }
 ENDHLSL
 }}}
