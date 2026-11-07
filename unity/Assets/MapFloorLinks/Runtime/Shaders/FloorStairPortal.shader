Shader "MapFloorLinks/Portal" {
 SubShader {
  Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
  Pass {
   Cull Off ZWrite Off Blend SrcAlpha OneMinusSrcAlpha
   CGPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "UnityCG.cginc"
   struct Input { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
   struct Interpolators { float4 position:SV_POSITION; float2 uv:TEXCOORD0; };
   Interpolators vert(Input v){Interpolators o;o.position=UnityObjectToClipPos(v.vertex);o.uv=v.uv;return o;}
   float hash(float2 p){return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453);}
   float noise(float2 p){float2 i=floor(p),f=frac(p);f=f*f*(3-2*f);return lerp(lerp(hash(i),hash(i+float2(1,0)),f.x),lerp(hash(i+float2(0,1)),hash(i+1),f.x),f.y);}
   float4 frag(Interpolators input):SV_Target {
    float2 p=input.uv*2-1;float r=length(p);clip(1-r);float t=_Time.y;
    float a=atan2(p.y,p.x),sw=a+(1-r)*5+t*1.1;float2 q=float2(cos(sw),sin(sw))*(r*2.5+.3);
    float f=noise(q*1.6+t*.25)*.6+noise(q*3.3-t*.45)*.4;
    float streak=pow(.5+.5*sin(sw*4+f*7+r*9-t*2.6),4);
    float rim=smoothstep(.62,.97,r)*(1-smoothstep(.95,1,r));
    float3 col=float3(.01,.03,.09)+float3(.1,.55,1)*(streak*1.4+f*.7+.15)*smoothstep(0,.8,r)+float3(.55,.95,1)*(rim*2.6+pow(streak,2)*smoothstep(.3,.95,r)*1.3+smoothstep(.75,1,r)*.5);
    float2 sp=floor(p*26);float st=step(.988,hash(sp+floor(t*1.5)*.37))*(1.1-r);col+=float3(.85,.9,1)*st;
    return float4(col,1-smoothstep(.96,1,r));
   }
   ENDCG
  }
 }
}