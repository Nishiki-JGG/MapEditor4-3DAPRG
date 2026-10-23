Shader "Hidden/MapSharedProps/CaveFloorProbe" {
 Properties {_Mode("Probe mode",Float)=0}
 SubShader {Pass {ZTest Always ZWrite Off Cull Off
 CGPROGRAM
 #pragma target 3.0
 #pragma vertex vert_img
 #pragma fragment frag
 #include "UnityCG.cginc"
 #include "Assets/MapSharedProps/Runtime/SharedCaveFloor.hlsl"
 float _Mode;
 float4 frag(v2f_img i):SV_Target {
  float2 pixel=i.uv*float2(256,8)-.5;
  CaveFloorSample f=sampleCaveFloor(float2(pixel.x*.127-16.,pixel.y*.343-4.),.7);
  return _Mode<.5?float4(f.albedo,f.wet):float4(f.relief,0,0,1);
 }
 ENDCG
 }}
}
