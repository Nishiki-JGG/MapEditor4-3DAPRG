Shader "MapTunnels/Tunnel"
{
 // マップエディターのトンネル（tunnels_mesh.json）の網。頂点の色（岩・石・木。奥ほど暗い色が焼き込み済み）に、環境光と主光と追加灯（松明・ランタン）。
 // 両面を描く（中から見る面も、口のまわりの地面も）。_Emission = 1 で灯りそのもの（光る）。
 // 透かし：主人公が屋根の下にいる間、MapTunnelCutaway が大域の _MapCutA（主人公の足元 xyz と半径 w。0 = 無し）・_MapCutB（カメラ）を渡す。
 //   頭の高さより上で、主人公から半径 w 以内（トンネルの網はすべてトンネルの上）と、カメラから頭への線のまわり 1.1m を描かない（エディターと同じ）。
 // _Shaft = 1：壁の外側の切り口の面（shaft）。透かしでは消さず、視線の線のまわりだけ抜く（透かしたときの穴の側面になる）。
 Properties{_Emission("Emission (lamps)",Float)=0 _Shaft("Cut faces (shaft)",Float)=0}
 SubShader{Tags{"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "Queue"="Geometry"}
 Pass{Name "Tunnel" Tags{"LightMode"="UniversalForward"} Cull Off
 HLSLPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #pragma target 3.5
 #pragma multi_compile _ _ADDITIONAL_LIGHTS
 #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
 #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
 #pragma multi_compile_fragment _ _SHADOWS_SOFT
 #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
 CBUFFER_START(UnityPerMaterial)
 float _Emission,_Shaft;
 CBUFFER_END
 float4 _MapCutA; float3 _MapCutB;
 struct A{float4 p:POSITION;float3 n:NORMAL;float4 c:COLOR;};
 struct V{float4 p:SV_POSITION;float3 w:TEXCOORD0;float3 n:TEXCOORD1;float4 c:COLOR;};
 V vert(A a){V o;o.w=TransformObjectToWorld(a.p.xyz);o.p=TransformWorldToHClip(o.w);o.n=TransformObjectToWorldNormal(a.n);o.c=a.c;return o;}
 bool CutAway(float3 p){
  if(_MapCutA.w<=0||p.y<=_MapCutA.y+1.7)return false;
  if(_Shaft<.5&&length(p.xz-_MapCutA.xz)<_MapCutA.w)return true;
  float3 a=_MapCutA.xyz+float3(0,1,0),ab=_MapCutB-a;float t=saturate(dot(p-a,ab)/max(dot(ab,ab),1e-4));
  return length(p-(a+ab*t))<1.1*(1+.4*t);
 }
 half4 frag(V i,bool front:SV_IsFrontFace):SV_Target{
  if(CutAway(i.w))discard;
  float3 col=pow(saturate(i.c.rgb),2.2);
  if(_Emission>.5)return half4(col*2.5,1);
  float3 n=normalize(front?i.n:-i.n);
  float3 light=SampleSH(n);
  Light main=GetMainLight(TransformWorldToShadowCoord(i.w));
  light+=main.color*main.distanceAttenuation*main.shadowAttenuation*saturate(dot(n,main.direction));
  // 通常ForwardとForward+の双方で、点灯の距離減衰と遮蔽を評価する。
  #if defined(_ADDITIONAL_LIGHTS) || USE_CLUSTER_LIGHT_LOOP
  InputData inputData=(InputData)0;inputData.positionWS=i.w;inputData.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.p);
  #if USE_CLUSTER_LIGHT_LOOP
  UNITY_LOOP for(uint lightIndex=0;lightIndex<min(URP_FP_DIRECTIONAL_LIGHTS_COUNT,MAX_VISIBLE_LIGHTS);lightIndex++){Light l=GetAdditionalLight(lightIndex,i.w,half4(1,1,1,1));light+=l.color*l.distanceAttenuation*l.shadowAttenuation*saturate(dot(n,l.direction));}
  #endif
  uint count=GetAdditionalLightsCount();
  LIGHT_LOOP_BEGIN(count)
  Light l=GetAdditionalLight(lightIndex,i.w,half4(1,1,1,1));light+=l.color*l.distanceAttenuation*l.shadowAttenuation*saturate(dot(n,l.direction));
  LIGHT_LOOP_END
  #endif
  return half4(col*light,1);
 }
 ENDHLSL
 }
 // 見下ろし用の天井カットは表示だけ。実際の壁・天井は光を遮る。
 Pass{Name "ShadowCaster" Tags{"LightMode"="ShadowCaster"} ZWrite On ZTest LEqual ColorMask 0 Cull Off
 HLSLPROGRAM
 #pragma vertex ShadowVert
 #pragma fragment ShadowFrag
 #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
 CBUFFER_START(UnityPerMaterial)
 float _Emission,_Shaft;
 CBUFFER_END
 float3 _LightDirection,_LightPosition;
 float4 ShadowVert(float4 p:POSITION,float3 n:NORMAL):SV_POSITION{float3 w=TransformObjectToWorld(p.xyz);
 #if _CASTING_PUNCTUAL_LIGHT_SHADOW
 float3 d=normalize(_LightPosition-w);
 #else
 float3 d=_LightDirection;
 #endif
 return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(w,TransformObjectToWorldNormal(n),d)));}
 half4 ShadowFrag():SV_Target{return 0;}
 ENDHLSL
 }
 }}
