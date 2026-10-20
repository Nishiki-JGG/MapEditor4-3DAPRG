// Test-only: deliberately no lighting, normals or vertex colours, to isolate UV/PNG orientation.
Shader "Hidden/MapSharedProps/Reference" {
 Properties { _BaseMap("Image",2D)="white"{} _BaseColor("Colour",Color)=(1,1,1,1) _Cutoff("Cutoff",Float)=0 _Cull("Cull",Float)=0 }
 SubShader { Tags{"LightMode"="SRPDefaultUnlit"} Cull [_Cull]
  Pass {
   CGPROGRAM
   #pragma vertex Vert
   #pragma fragment Frag
   #include "UnityCG.cginc"
   sampler2D _BaseMap; half4 _BaseColor; float _Cutoff;
   struct V {float4 p:SV_POSITION;float2 uv:TEXCOORD0;};
   V Vert(float4 p:POSITION,float2 uv:TEXCOORD0){V o;o.p=UnityObjectToClipPos(p);o.uv=uv;return o;}
   half4 Frag(V i):SV_Target {half4 c=tex2D(_BaseMap,i.uv)*_BaseColor;clip(c.a-_Cutoff);return half4(c.rgb,1);}
   ENDCG
  }
 }
}
