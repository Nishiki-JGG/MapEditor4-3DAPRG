Shader "Hidden/MapSharedProps/RootSurfaceProbe" {
 Properties {_MainTex("Surface samples",2D)="black"{} _Contexts("Terrain contexts",2D)="black"{} _RootGrass("Raw grass",2D)="white"{} _RootDirt("Raw soil",2D)="white"{}}
 SubShader { Pass { ZTest Always ZWrite Off Cull Off
 CGPROGRAM
 #pragma target 3.0
 #pragma vertex vert_img
 #pragma fragment frag
 #include "UnityCG.cginc"
 sampler2D _MainTex,_Contexts,_RootGrass,_RootDirt;
 float4 _RootSurface,_RootGrassParams,_RootDirtParams,_RootGrassOffset,_RootDirtOffset,_RootWaveA,_RootWaveB,_TDRootSlope;
 float2 _TDPineOrigin;static float4 rootProbeTerrain;
 #define _TDRootTerrain rootProbeTerrain
 #define ROOT_GRASS(uv) tex2D(_RootGrass,uv).rgb
 #define ROOT_DIRT(uv) tex2D(_RootDirt,uv).rgb
 #include "Assets/MapSharedProps/Runtime/SharedRootGrounding.hlsl"
 #include "Assets/MapSharedProps/Runtime/SharedRootSurface.hlsl"
 float4 frag(v2f_img i):SV_Target{float4 info=tex2D(_MainTex,i.uv);_TDRootTerrain=tex2D(_Contexts,i.uv);return float4(RootSurfaceColor(float3(.12,.09,.06),info),1);}
 ENDCG
 } } }
