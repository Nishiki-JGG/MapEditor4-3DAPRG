#ifndef MAPWATER_COMMON
#define MAPWATER_COMMON
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
// マップ用の水の共通部分。CAV-002 の ImpactShared.hlsl（R120FoamRadiance）を、名前を変えて引き継いだもの。
float MWHash(float2 p){p=frac(p*float2(.1031,.11369));p+=dot(p,p.yx+19.19);return frac(p.x*p.y);}
float MWNoise(float2 p){float2 i=floor(p),f=frac(p),u=f*f*(3-2*f);return lerp(lerp(MWHash(i),MWHash(i+float2(1,0)),u.x),lerp(MWHash(i+float2(0,1)),MWHash(i+1),u.x),u.y);}
// その場所の水平な白い面が受ける明るさ（環境光＋主光＋追加灯）。水の色と泡の明るさの基準
float3 MWRadiance(float3 w,float4 positionCS){
 float3 colour=SampleSH(float3(0,1,0))*.85;
 Light main=GetMainLight(TransformWorldToShadowCoord(w));
 colour+=main.color*main.distanceAttenuation*main.shadowAttenuation*saturate(main.direction.y)*.40;
 InputData inputData=(InputData)0;inputData.positionWS=w;inputData.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(positionCS);
 half4 shadowMask=half4(1,1,1,1);uint count=GetAdditionalLightsCount();
 #if defined(_ADDITIONAL_LIGHTS)
 #if USE_CLUSTER_LIGHT_LOOP
 [loop]for(uint lightIndex=0;lightIndex<min(URP_FP_DIRECTIONAL_LIGHTS_COUNT,MAX_VISIBLE_LIGHTS);lightIndex++){
  CLUSTER_LIGHT_LOOP_SUBTRACTIVE_LIGHT_CHECK
  Light l=GetAdditionalLight(lightIndex,w,shadowMask);
  colour+=l.color*l.distanceAttenuation*l.shadowAttenuation*saturate(l.direction.y)*.50;
 }
 #endif
 LIGHT_LOOP_BEGIN(count)
  Light l=GetAdditionalLight(lightIndex,w,shadowMask);
  colour+=l.color*l.distanceAttenuation*l.shadowAttenuation*saturate(l.direction.y)*.50;
 LIGHT_LOOP_END
 #endif
 return colour*float3(.88,.94,.98);
}
// アルファ合成の「背景込みの見かけの色」E = rgb*a + 背景*(1-a) を保ったまま、E を (1-m)E + m*F にする（泡や水際の重ね）
void MWLayer(inout float3 rgb,inout float a,float3 F,float m){
 m=saturate(m);float a2=(1-m)*a+m;rgb=((1-m)*rgb*a+m*F)/max(a2,1e-4);a=a2;
}
// E に c を足す（水底に当たる光の網など。背景の明るさに足される）
void MWAdd(inout float3 rgb,float a,float3 c){rgb+=c/max(a,1e-3);}
#endif
