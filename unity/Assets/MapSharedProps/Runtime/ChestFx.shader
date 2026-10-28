// Fixed GPU slots: no light components, simulation buffers, texture or bloom dependency.
Shader "MapSharedProps/ChestFx" {
 Properties {_ChestSeed("Instance phase",Float)=0 _ChestFxTime("Time override",Float)=-1}
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Transparent" "Queue"="Transparent+3" "DisableBatching"="True"}
  Pass {
   Blend SrcAlpha One ZWrite Off ZTest LEqual Cull Off
   HLSLPROGRAM
   #pragma target 3.0
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile_instancing
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   UNITY_INSTANCING_BUFFER_START(Chest)
    UNITY_DEFINE_INSTANCED_PROP(float,_ChestSeed)
    UNITY_DEFINE_INSTANCED_PROP(float,_ChestFxTime)
   UNITY_INSTANCING_BUFFER_END(Chest)
   struct A {float3 positionOS:POSITION;float2 uv:TEXCOORD0;float4 start:TEXCOORD1;float4 end:TEXCOORD2;float4 shape:TEXCOORD3;float4 color:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID};
   struct V {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;float4 color:COLOR;float kind:TEXCOORD1;float phase:TEXCOORD2;float time:TEXCOORD3;};
   V Vert(A i){UNITY_SETUP_INSTANCE_ID(i);V o;float override=UNITY_ACCESS_INSTANCED_PROP(Chest,_ChestFxTime);float t=override<0?_Time.y:override;float phase=i.end.w+UNITY_ACCESS_INSTANCED_PROP(Chest,_ChestSeed);float kind=i.start.w,age=frac(t*.38+phase),alpha=1;float4 mv;
    if(kind<.5||(kind>1.5&&kind<2.5)){float gold=1-step(.5,kind);float3 c=i.start.xyz+float3(sin(phase*31.7+age*4)*age*lerp(.16,.065,gold),age*lerp(.30,.20,gold),-cos(phase*23.2+age*3)*age*lerp(.14,.055,gold));mv=mul(UNITY_MATRIX_V,mul(UNITY_MATRIX_M,float4(c,1)));float scale=length(mul((float3x3)UNITY_MATRIX_M,float3(1,0,0)));mv.xy+=i.positionOS.xy*i.shape.x*scale*(.8+.2*sin(t*7+phase*32));alpha=sin(3.14159265*age);if(kind<.5)alpha*=.45+.55*pow(.5+.5*sin(t*5+phase*19),3);}
    else {float3 d=i.end.xyz-i.start.xyz;float3 tangent=kind>2.5?float3(0,1,0):normalize(float3(d.z,0,-d.x));float3 p=lerp(i.start.xyz,i.end.xyz,i.uv.y)+tangent*i.positionOS.x*lerp(i.shape.x,i.shape.y,i.uv.y);mv=mul(UNITY_MATRIX_V,mul(UNITY_MATRIX_M,float4(p,1)));alpha=.78+.22*sin(t*1.5+phase*6.2831853);}
    o.positionCS=mul(UNITY_MATRIX_P,mv);o.uv=i.uv;o.color=i.color;o.color.a*=alpha*(1-smoothstep(12,20,length(mv.xyz)));o.kind=kind;o.phase=phase;o.time=t;return o;
   }
   float FxSquare(float x){return x*x;}
   half4 Frag(V i):SV_Target {float2 p=i.uv*2-1;float edge;if(i.kind>2.5)edge=pow(max(0,1-abs(p.x)),2)*smoothstep(0,.12,i.uv.y)*(1-smoothstep(.88,1,i.uv.y));else if(i.kind>.5&&i.kind<1.5)edge=pow(max(0,1-FxSquare(p.x+.16*sin(i.uv.y*3.14159265+i.phase*6.2831853))),2)*pow(saturate(1-i.uv.y),.7)*smoothstep(0,.12,i.uv.y);else{float star=max(pow(max(0,1-abs(p.x)),18)*pow(max(0,1-abs(p.y)),3),pow(max(0,1-abs(p.y)),18)*pow(max(0,1-abs(p.x)),3));edge=pow(max(0,1-dot(p,p)),2)*(.35+.65*star);}if(i.kind<.5){float star=max(pow(max(0,1-abs(p.x)),12)*pow(max(0,1-abs(p.y)),2),pow(max(0,1-abs(p.y)),12)*pow(max(0,1-abs(p.x)),2));edge=.12*pow(max(0,1-dot(p,p)),3)+.88*star;}float a=i.color.a*edge;clip(a-.0001);float3 c=i.color.rgb;if(i.kind<.5)c*=5.;if(i.kind>.5)c=lerp(c,.45+.55*cos(float3(0,2.094,4.188)+i.time*.55+i.phase*6.2831853+(i.kind>2.5?i.uv.y*6.2831853:0)),i.kind>2.5?.8:.28);return half4(c,a);}
   ENDHLSL
  }
 }
 SubShader {
  Tags {"RenderType"="Transparent" "Queue"="Transparent+3" "DisableBatching"="True"}
  Pass {
   Blend SrcAlpha One ZWrite Off ZTest LEqual Cull Off
   CGPROGRAM
   #pragma target 3.0
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile_instancing
   #include "UnityCG.cginc"
   UNITY_INSTANCING_BUFFER_START(Chest)
    UNITY_DEFINE_INSTANCED_PROP(float,_ChestSeed)
    UNITY_DEFINE_INSTANCED_PROP(float,_ChestFxTime)
   UNITY_INSTANCING_BUFFER_END(Chest)
   struct A {float3 positionOS:POSITION;float2 uv:TEXCOORD0;float4 start:TEXCOORD1;float4 end:TEXCOORD2;float4 shape:TEXCOORD3;float4 color:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID};
   struct V {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;float4 color:COLOR;float kind:TEXCOORD1;float phase:TEXCOORD2;float time:TEXCOORD3;};
   V Vert(A i){UNITY_SETUP_INSTANCE_ID(i);V o;float override=UNITY_ACCESS_INSTANCED_PROP(Chest,_ChestFxTime);float t=override<0?_Time.y:override;float phase=i.end.w+UNITY_ACCESS_INSTANCED_PROP(Chest,_ChestSeed);float kind=i.start.w,age=frac(t*.38+phase),alpha=1;float4 mv;
    if(kind<.5||(kind>1.5&&kind<2.5)){float gold=1-step(.5,kind);float3 c=i.start.xyz+float3(sin(phase*31.7+age*4)*age*lerp(.16,.065,gold),age*lerp(.30,.20,gold),-cos(phase*23.2+age*3)*age*lerp(.14,.055,gold));mv=mul(UNITY_MATRIX_V,mul(UNITY_MATRIX_M,float4(c,1)));float scale=length(mul((float3x3)UNITY_MATRIX_M,float3(1,0,0)));mv.xy+=i.positionOS.xy*i.shape.x*scale*(.8+.2*sin(t*7+phase*32));alpha=sin(3.14159265*age);if(kind<.5)alpha*=.45+.55*pow(.5+.5*sin(t*5+phase*19),3);}
    else {float3 d=i.end.xyz-i.start.xyz;float3 tangent=kind>2.5?float3(0,1,0):normalize(float3(d.z,0,-d.x));float3 p=lerp(i.start.xyz,i.end.xyz,i.uv.y)+tangent*i.positionOS.x*lerp(i.shape.x,i.shape.y,i.uv.y);mv=mul(UNITY_MATRIX_V,mul(UNITY_MATRIX_M,float4(p,1)));alpha=.78+.22*sin(t*1.5+phase*6.2831853);}
    o.positionCS=mul(UNITY_MATRIX_P,mv);o.uv=i.uv;o.color=i.color;o.color.a*=alpha*(1-smoothstep(12,20,length(mv.xyz)));o.kind=kind;o.phase=phase;o.time=t;return o;
   }
   float FxSquare(float x){return x*x;}
   half4 Frag(V i):SV_Target {float2 p=i.uv*2-1;float edge;if(i.kind>2.5)edge=pow(max(0,1-abs(p.x)),2)*smoothstep(0,.12,i.uv.y)*(1-smoothstep(.88,1,i.uv.y));else if(i.kind>.5&&i.kind<1.5)edge=pow(max(0,1-FxSquare(p.x+.16*sin(i.uv.y*3.14159265+i.phase*6.2831853))),2)*pow(saturate(1-i.uv.y),.7)*smoothstep(0,.12,i.uv.y);else{float star=max(pow(max(0,1-abs(p.x)),18)*pow(max(0,1-abs(p.y)),3),pow(max(0,1-abs(p.y)),18)*pow(max(0,1-abs(p.x)),3));edge=pow(max(0,1-dot(p,p)),2)*(.35+.65*star);}if(i.kind<.5){float star=max(pow(max(0,1-abs(p.x)),12)*pow(max(0,1-abs(p.y)),2),pow(max(0,1-abs(p.y)),12)*pow(max(0,1-abs(p.x)),2));edge=.12*pow(max(0,1-dot(p,p)),3)+.88*star;}float a=i.color.a*edge;clip(a-.0001);float3 c=i.color.rgb;if(i.kind<.5)c*=5.;if(i.kind>.5)c=lerp(c,.45+.55*cos(float3(0,2.094,4.188)+i.time*.55+i.phase*6.2831853+(i.kind>2.5?i.uv.y*6.2831853:0)),i.kind>2.5?.8:.28);return half4(c,a);}
   ENDCG
  }
 }
}
