Shader "MapWater/Splash"{
 // 着水の飛沫と霧と白い欠片（1回の描画）。CAV-002 の SparseSplash を、物体空間にしたもの：
 // 物体の原点＝着水点（水面の上）、+Z＝水源の向き（崖）、-Z＝下流、着水線は X 軸ぞい。物体を回せばどの向きの滝にも付く。
 // メッシュ：POSITION=発生点 NORMAL=初速 UV0=四隅 UV1=(位相, 寿命, 大きさ, 種類 0=水滴 1=霧 2=白い欠片)
 Properties{_Phase("Time",Float)=0 _DetailTex("Shared detail",2D)="gray"{}}
 SubShader{Tags{"RenderPipeline"="UniversalPipeline" "RenderType"="Transparent" "Queue"="Transparent+20"}
 Pass{Tags{"LightMode"="UniversalForward"} Blend SrcAlpha OneMinusSrcAlpha ZWrite Off Cull Off
 HLSLPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #pragma target 3.5
 #pragma multi_compile _ _ADDITIONAL_LIGHTS
 #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
 #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
 #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
 #pragma multi_compile_fragment _ _SHADOWS_SOFT
 #include "MapWaterCommon.hlsl"
 TEXTURE2D(_DetailTex);SAMPLER(sampler_DetailTex);
 CBUFFER_START(UnityPerMaterial)
 float _Phase;float4 _DetailTex_ST;
 CBUFFER_END
 struct A{float4 p:POSITION;float3 velocity:NORMAL;float2 uv:TEXCOORD0;float4 data:TEXCOORD1;};
 struct V{float4 p:SV_POSITION;float3 w:TEXCOORD0;float2 uv:TEXCOORD1;float3 info:TEXCOORD2;};
 V vert(A a){V o;
  float life=a.data.y,age=frac(_Phase/life+a.data.x)*life,k=age/life;
  bool mist=a.data.w>.5&&a.data.w<1.5;
  bool crown=a.data.w>1.5;
  float3 right=float3(UNITY_MATRIX_I_V[0][0],UNITY_MATRIX_I_V[1][0],UNITY_MATRIX_I_V[2][0]);
  float3 up=float3(UNITY_MATRIX_I_V[0][1],UNITY_MATRIX_I_V[1][1],UNITY_MATRIX_I_V[2][1]);
  float3 center,w;float fade;
  const float waterY=0;   // 物体空間の水面
  if(crown){
   float drag=1.6,e=exp(-drag*age);
   float3 vel=float3(a.velocity.x*e,a.velocity.y-9.81*age,a.velocity.z*e);
   center=a.p.xyz+float3(a.velocity.x,0,a.velocity.z)*(1-e)/drag+float3(0,a.velocity.y*age-4.905*age*age,0);
   bool onWater=center.y<waterY+.03;
   center.y=max(center.y,waterY+.03);
   if(onWater)vel.y=0;
   float3 centerW=TransformObjectToWorld(center);
   float3 view=normalize(centerW-_WorldSpaceCameraPos);
   float3 velW=TransformObjectToWorldDir(vel);
   float3 along=velW-dot(velW,view)*view;float speed=length(along);
   along=speed>1e-3?along/speed:up;
   float3 side=normalize(cross(view,along));
   float size=a.data.z*(.7+1.3*k);
   w=centerW+side*a.uv.x*size*.8+along*a.uv.y*(size+speed*.03);   // 6回目：伸びを .08→.03（池に放射状の線＝花火に見えた）
   float near=exp(-length(center.xz)/1.4);
   fade=smoothstep(0,.06,k)*(1-smoothstep(.35,.8,k))*lerp(.35,1,near);
  }else if(mist){
   float drag=1.4;
   center=a.p.xyz+a.velocity*(1-exp(-drag*age))/drag;
   float3 centerW=TransformObjectToWorld(center);
   float size=a.data.z*(.55+.9*k);
   float ang=a.data.x*6.28+age*.25;float2 cs=float2(cos(ang),sin(ang));
   float2 c=float2(a.uv.x*cs.x-a.uv.y*cs.y,a.uv.x*cs.y+a.uv.y*cs.x);
   w=centerW+(right*c.x+up*c.y*.55)*size;   // 縦に潰した楕円（球に見えない）
   fade=sin(PI*k)*smoothstep(0,.12,k)*lerp(.45,1,exp(-length(center.xz)/1.4));
  }else{
   float3 vel=a.velocity+float3(0,-9.81,0)*age;
   center=a.p.xyz+a.velocity*age+float3(0,-4.905*age*age,0);
   float3 centerW=TransformObjectToWorld(center);
   float3 view=normalize(centerW-_WorldSpaceCameraPos);
   float3 velW=TransformObjectToWorldDir(vel);
   float3 along=velW-dot(velW,view)*view;float speed=length(along);
   along=speed>1e-3?along/speed:up;
   float3 side=normalize(cross(view,along));
   w=centerW+side*a.uv.x*a.data.z*1.6+along*a.uv.y*(a.data.z*1.6+speed*.04);
   fade=smoothstep(0,.06,age)*(1-smoothstep(.7,1,k))*smoothstep(waterY+.01,waterY+.06,center.y);
  }
  o.w=w;o.p=TransformWorldToHClip(w);o.uv=a.uv*2;o.info=float3(fade,crown?2:(mist?1:0),a.data.x);return o;}
 half4 frag(V i):SV_Target{
  float alpha;
  if(i.info.y>1.5){
   float r2=dot(i.uv,i.uv);
   float n=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,i.uv*.2+i.info.z*3.7+_Phase*.06).a;
   alpha=exp(-r2*2.2)*(.7+.3*n)*.42*i.info.x;
  }else if(i.info.y>.5){
   float r=length(i.uv);
   float n=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,i.uv*.18+i.info.z+_Phase*.015).a;
   alpha=(1-smoothstep(.15,1,r))*(.30+.70*n)*.34*i.info.x;
  }else{
   float r=length(i.uv);
   alpha=(1-smoothstep(.35,1,r))*lerp(.45,1,saturate(i.uv.y*.5+.5))*.6*i.info.x;
  }
  clip(alpha-.01);
  return half4(MWRadiance(i.w,i.p),alpha);
 }
 ENDHLSL
 }}}
