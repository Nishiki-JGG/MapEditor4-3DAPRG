Shader "Hidden/MapSharedProps/PineWindProbe" {
 Properties {_MainTex("Positions and UV mask",2D)="black"{}}
 SubShader {Cull Off ZTest Always ZWrite Off Pass {
 CGPROGRAM
 #pragma vertex vert_img
 #pragma fragment Frag
 #include "UnityCG.cginc"
 sampler2D _MainTex;float4x4 _ProbeMatrix;float4 _PineBand,_PineWaves,_PinePhase;
 #include "Assets/MapSharedProps/Runtime/SharedPineWind.hlsl"
 float4 Frag(v2f_img i):SV_Target{float4 src=tex2D(_MainTex,i.uv);float4 wp=mul(_ProbeMatrix,float4(src.xyz,1));float2 origin=mul(_ProbeMatrix,float4(0,0,0,1)).xz;wp.xz+=SharedPineOffset(src.y,src.w,origin);return float4(wp.xyz,1);}
 ENDCG
 }}
}
