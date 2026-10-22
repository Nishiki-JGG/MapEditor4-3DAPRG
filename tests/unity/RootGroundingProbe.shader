Shader "Hidden/MapSharedProps/RootGroundingProbe" {
 Properties {_MainTex("Positions",2D)="black"{} _Masks("Weights",2D)="black"{}}
 SubShader {Cull Off ZTest Always ZWrite Off Pass {
 CGPROGRAM
 #pragma vertex vert_img
 #pragma fragment Frag
 #include "UnityCG.cginc"
 sampler2D _MainTex,_Masks;float4x4 _ProbeMatrix;float4 _PineBand,_PineWaves,_PinePhase,_PineResponse;float _PlantCombinedLimit;float4 _TDRootSlope;
 #include "Assets/MapSharedProps/Runtime/SharedPineWind.hlsl"
 #include "Assets/MapSharedProps/Runtime/SharedRootGrounding.hlsl"
 float4 Frag(v2f_img i):SV_Target{float4 src=tex2D(_MainTex,i.uv);float3 mask=tex2D(_Masks,i.uv).xyz;float4 wp=mul(_ProbeMatrix,float4(src.xyz,1));float2 origin=mul(_ProbeMatrix,float4(0,0,0,1)).xz;wp.y+=SharedRootRise(wp.xyz,mul(_ProbeMatrix,float4(0,0,0,1)).xyz,mask.z,_TDRootSlope.xy);wp.xz+=SharedPlantOffset(src.y,src.w,mask.xy,origin,length(_ProbeMatrix._m00_m10_m20));return float4(wp.xyz,1);}
 ENDCG
 }}
}
