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
  #if defined(_ADDITIONAL_LIGHTS)
  uint count=GetAdditionalLightsCount();
  [loop]for(uint k=0;k<count;k++){Light l=GetAdditionalLight(k,i.w);light+=l.color*l.distanceAttenuation*saturate(dot(n,l.direction));}
  #endif
  return half4(col*light,1);
 }
 ENDHLSL
 }}}
