Shader "MapWater/Water"
{
 // マップエディターの書き出しから自動で付く水面（CAV-002 の ImpactWater を一般の地形用にしたもの）。
 // ・深さは、書き出しの高さと水位から作った符号つき水深(_DepthTex)から読む。深度・不透明の画像は使わない（Mobile画質でも同じ絵）。
 // ・背景（地形）は alpha で透かす。水底の屈折のゆがみは無い（CAV-002 との違い）。
 // ・流れ(_FlowTex)で細波を運ぶ、水際の線、早瀬、滝からの泡の帯(_MaskTex)、滝ごとの波紋（グローバルのアトラス）。
 // 座標は固定しない：地図の原点と大きさは _MapRect、滝ごとの窓は MapWaterController が配列で渡す。
 Properties {
  _MapRect("Map origin xz, 1/size xz",Vector)=(0,0,0.015625,0.015625)
  _DetailTex("Shared detail (RG wave normal, B caustic, A foam)",2D)="gray"{}
  _FlowTex("Flow (RG, B stream function, A bank distance)",2D)="gray"{}
  _MaskTex("Mask (R foam trail cover)",2D)="black"{}
  _DepthTex("Signed water depth (m)",2D)="black"{}
  _Phase("Time seconds",Float)=0
  _DetailScale("Fine wave tiles per metre",Float)=0.24
  _NormalStrength("Fine wave slope",Float)=0.11
  _RippleStrength("Simulated ripple slope gain",Float)=1
  _ShallowColor("Shallow water body",Color)=(0.36,0.86,0.80,1)
  _DeepColor("Deep water body",Color)=(0.035,0.15,0.5,1)
  _Absorption("Absorption per metre (RGB)",Vector)=(0.55,0.24,0.12,0)
  _ScatterStrength("Water body brightness",Float)=0.32
  _DeepDepth("Depth reaching the deep body (m)",Float)=3.0
  _CausticStrength("Bed caustics",Float)=0.8
  _CausticScale("Caustic tiles per metre",Float)=0.42
  _FoamStrength("Foam strength",Float)=1
  _FleckStrength("Drifting foam flecks (0 = off)",Float)=1
  _CrestHeight("Wave crest foam starts (m)",Float)=0.018
  _CrestRange("Wave crest foam ramp (m)",Float)=0.03
  _RippleReach("Ripple fade distance from the contact (m)",Float)=2.2
  _FlowMax("Flow map max speed (m/s)",Float)=2.0
  _FlowCycle("Flow phase cycle (s)",Float)=1.6
  _FlowStreak("Fast-water streaks",Float)=0.5
  _ShoreFoam("Shore wet-foam line",Float)=0.9
  _RapidsFoam("Rapids foam",Float)=0.58
  _TrailFoam("Foam trail from the falls (scale)",Float)=0.75
  _TrailMaxCover("Mask R = 255 means this cover",Float)=0.65
  _BankRange("Flow A = 255 means this distance (m)",Float)=1.5
  _Roughness("Perceptual roughness",Float)=0.28
  _WaterIOR("Refractive index",Float)=1.333
  _ReflectionStrength("Reflection",Float)=1
 }
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Transparent" "Queue"="Transparent"}
  Pass {
   Name "WaterSurface"
   Tags {"LightMode"="UniversalForward"}
   Blend SrcAlpha OneMinusSrcAlpha
   ZWrite Off
   Cull Off
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
   TEXTURE2D(_FlowTex);SAMPLER(sampler_FlowTex);
   TEXTURE2D(_MaskTex);SAMPLER(sampler_MaskTex);
   TEXTURE2D(_DepthTex);SAMPLER(sampler_DepthTex);
   // MapWaterController が設定するグローバル（波紋のアトラス。滝ごとの窓）
   TEXTURE2D(_MWRippleTex);SAMPLER(sampler_MWRippleTex);
   float4 _MWFallRect[8];      // x,y = 窓の最小xz  z = 1/窓の大きさ  w = アトラスの窓の番号
   float4 _MWFallContact[8];   // 着水線の両端 (x1,z1,x2,z2) ワールド
   float4 _MWAtlas;            // x = 窓の数(0なら波紋なし)  y = 1/アトラスの幅  z = 1/アトラスの高さ  w = 窓の一辺(テクセル)
   float4 _MWAtlasTiles;       // x = 1行の窓の数
   float _MWDebug;             // 1 = 流れの矢印と速さの色を重ねる（確認用）
   CBUFFER_START(UnityPerMaterial)
    float4 _MapRect,_DetailTex_ST,_ShallowColor,_DeepColor,_Absorption;
    float _Phase,_DetailScale,_NormalStrength,_RippleStrength,_ScatterStrength,_DeepDepth,_CausticStrength,_CausticScale,_FoamStrength,_FleckStrength,_CrestHeight,_CrestRange,_RippleReach,_FlowMax,_FlowCycle,_FlowStreak,_ShoreFoam,_RapidsFoam,_TrailFoam,_TrailMaxCover,_BankRange,_Roughness,_WaterIOR,_ReflectionStrength;
   CBUFFER_END
   struct A {float4 p:POSITION;};
   struct V {float4 p:SV_POSITION;float3 w:TEXCOORD0;};
   V vert(A a){V o;o.w=TransformObjectToWorld(a.p.xyz);o.p=TransformWorldToHClip(o.w);return o;}
   void MWMix(inout float3 rgb,inout float a,float3 rgb2,float a2,float w){
    float a3=lerp(a,a2,w);rgb=lerp(rgb*a,rgb2*a2,w)/max(a3,1e-4);a=a3;
   }
   float GGXSpec(float3 n,float3 v,float3 l,float rough){
    float nl=saturate(dot(n,l)),nv=saturate(dot(n,v));if(nl<=0||nv<=0)return 0;
    float3 h=normalize(v+l);float nh=saturate(dot(n,h)),vh=saturate(dot(v,h));
    float a=rough*rough,a2=a*a;float dd=nh*nh*(a2-1)+1;float D=a2/(PI*dd*dd);
    float k=(rough+1)*(rough+1)/8;float Gv=nv/(nv*(1-k)+k),Gl=nl/(nl*(1-k)+k);
    float F=.02037+.97963*pow(1-vh,5);
    return D*Gv*Gl*F/(4*max(nv,.001)*max(F,.02));
   }
   half4 frag(V i):SV_Target {
    float2 x=i.w.xz;float t=_Phase;
    float2 muv=(x-_MapRect.xy)*_MapRect.zw;
    if(muv.x<=0||muv.y<=0||muv.x>=1||muv.y>=1)discard;
    float depth=SAMPLE_TEXTURE2D_LOD(_DepthTex,sampler_DepthTex,muv,0).r;
    if(depth<=0)discard;
    depth=min(depth,12);
    // 0) 流れ（池→出口、書き出しの画像）
    half4 fl=SAMPLE_TEXTURE2D_LOD(_FlowTex,sampler_FlowTex,muv,0);
    float wetMap=saturate(fl.a*60);
    float bankDist=fl.a*_BankRange;
    float2 flow=(fl.rg*2-1)*_FlowMax*wetMap;
    float speed=length(flow);
    float psi=fl.b;
    float ph0=frac(t/_FlowCycle),ph1=frac(t/_FlowCycle+.5);
    float w0=1-abs(1-2*ph0);
    float2 off0=flow*ph0*_FlowCycle,off1=flow*ph1*_FlowCycle;
    // 1) 細波
    // 流れの向きに引き伸ばした座標（流れがあるほど、模様が流れの向きに長い小さな波になる）
    // 7回目：滝の近く（池）では伸ばさない。滝から放射状に流れ出すので、伸ばすと泡が放射状の白い線（花火）になった
    float fallDist=99;
    [loop]for(int q3=0;q3<8;q3++){if(q3>=(int)_MWAtlas.x)break;fallDist=min(fallDist,length(x-(_MWFallContact[q3].xy+_MWFallContact[q3].zw)*.5));}
    float awayFromFall=smoothstep(11,14,fallDist);
    float2 fdir=flow/max(speed,1e-3),fper=float2(-fdir.y,fdir.x);float aniso=saturate(speed*2.5)*awayFromFall,stretch=1+min(speed*1.6,1.8)*aniso;
    float2 q0=x-off0,q1=x-off1;
    q0=lerp(q0,float2(dot(q0,fdir)/stretch,dot(q0,fper)),aniso);q1=lerp(q1,float2(dot(q1,fdir)/stretch,dot(q1,fper)),aniso);
    half4 dA0=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,q0*_DetailScale+float2(.021,.013)*t);
    half4 dA1=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,q1*_DetailScale+float2(.021,.013)*t+.5);
    half4 dA=dA0*w0+dA1*(1-w0);
    half4 dB=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,x*(_DetailScale*1.73)+float2(-.017,.026)*t+.37);
    half dC=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,(x-off0)*_DetailScale*2.3+float2(.033,-.019)*t+.71).a;   // 泡の帯・水際用の細かい模様（塊を小さく細くする）
    float still=1-saturate(speed/.6)*.6;
    float2 slope=((dA.rg-.5)*(1+speed*.9)+(dB.rg-.5)*.8*still)*_NormalStrength;
    // 2) 滝ごとの波紋（アトラスの窓を1回だけ読む）
    float simFoam=0,crest=0;float2 simSlope=0;
    if(_MWAtlas.x>.5){
     [loop]for(int q=0;q<8;q++){
      if(q>=(int)_MWAtlas.x)break;
      float2 su=(x-_MWFallRect[q].xy)*_MWFallRect[q].z;
      if(su.x>0&&su.y>0&&su.x<1&&su.y<1){
       float tile=_MWFallRect[q].w;float tx=fmod(tile,_MWAtlasTiles.x),ty=floor(tile/_MWAtlasTiles.x);
       float2 auv=(float2(tx,ty)*_MWAtlas.w+su*_MWAtlas.w)*float2(_MWAtlas.y,_MWAtlas.z);
       float4 sim=SAMPLE_TEXTURE2D_LOD(_MWRippleTex,sampler_MWRippleTex,auv,0);
       float2 ca=_MWFallContact[q].xy,cb=_MWFallContact[q].zw,ab=cb-ca;
       float dist=length(x-(ca+ab*saturate(dot(x-ca,ab)/max(dot(ab,ab),1e-4))));
       float envelope=exp(-dist/_RippleReach);
       simSlope=sim.xy*_RippleStrength*envelope;simFoam=sim.z;
       crest=saturate((sim.w-_CrestHeight)/_CrestRange)*exp(-dist/(_RippleReach*1.6));
       break;
      }
     }
    }
    slope+=simSlope;
    float3 n=normalize(float3(-slope.x,1,-slope.y));
    float3 v=normalize(GetWorldSpaceViewDir(i.w));
    float f=.02037+.97963*pow(1-saturate(dot(n,v)),5);
    f=saturate(max(f,.04)*_ReflectionStrength);   // 空の映り込みの下限（のっぺりしないように）
    float3 lightIn=MWRadiance(i.w,i.p);
    // 3) 反射（反射プローブ／空）と主光のきらめき
    float3 env=GlossyEnvironmentReflection(reflect(-v,n),_Roughness,1.0);
    Light sun=GetMainLight(TransformWorldToShadowCoord(i.w));
    float3 surface=env+sun.color*sun.shadowAttenuation*GGXSpec(n,v,sun.direction,_Roughness)*1.2;
    // 4) 水の色と透け具合（屈折の向きは近似：スネルの式で角度だけ使い、画面はずらさない）
    float cosR=sqrt(max(1-(1-v.y*v.y)/(_WaterIOR*_WaterIOR),.04));
    float viewPath=depth/max(cosR,.2);
    float3 T=exp(-_Absorption.rgb*(viewPath+depth));
    float deep=smoothstep(.2,_DeepDepth,depth);
    float3 body=lerp(_ShallowColor.rgb,_DeepColor.rgb,deep)*lightIn*_ScatterStrength;
    float3 rgb=body;float a=1-dot(T,float3(.3,.4,.3));   // 色ごとの透け方は body に、アルファは平均の透け具合
    // 色ごとの吸収を保つ：背景*T + body*(1-T) をアルファ合成の形にそろえる（背景が灰色に近い前提で、T の平均で近似）
    // 4b) 水底の光の網（浅いほど強く、水際では消す。流れで運ぶが速さは0.6 m/sまで）
    float2 cuv=x*_CausticScale+slope*.8;
    float cap=min(1,.6/max(speed,1e-3));
    float ca2=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,cuv-off0*cap*_CausticScale+float2(.013,.008)*t).b;
    float cb2=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,cuv-off1*cap*_CausticScale+float2(.013,.008)*t+.5).b;
    float caustic=(ca2*w0+cb2*(1-w0))*1.5;
    float bedLight=caustic*_CausticStrength*exp(-depth*.5)*saturate(depth*5);
    MWAdd(rgb,a,lightIn*.18*bedLight*dot(T,float3(.3,.4,.3)));
    // 着水の下は泡の粒で白く濁る
    MWLayer(rgb,a,lightIn*float3(.62,.86,.88)*.5,simFoam*.22);
    float3 underRGB=rgb;float underA=a;
    // 反射（フレネル）
    MWLayer(rgb,a,surface,f);
    // 5) 泡
    float3 foamCol=lightIn*float3(.88,.94,.98);
    float pattern=dA.a*.6+dB.a*.4;
    float cover=.65*(1-exp(-simFoam*1.6))+.4*crest*(1-saturate(simFoam));
    float rapids=saturate((speed-.6)/.6)*(1-smoothstep(.8,2.2,depth))*awayFromFall;   // 7回目：池（滝の近く）は着水の泡に任せ、早瀬の泡は出さない
    cover=min(.8,max(cover,_RapidsFoam*rapids));
    float foam=saturate((pattern-(1-cover))*4)*_FoamStrength;
    MWLayer(rgb,a,foamCol,foam*.92);
    // 滝から流れの筋にそった細い泡の帯（書き出しの泡の帯の画像。模様は流れに乗る層A）
    float trail=SAMPLE_TEXTURE2D_LOD(_MaskTex,sampler_MaskTex,muv,0).r*_TrailMaxCover;
    float trailFoam=saturate((dC-(1-trail*_TrailFoam))*3)*_FoamStrength*step(.001,trail);   // 縁をやわらかく（4→3）
    // 水際：ごく浅い所は反射を弱めて水底になじませる
    MWMix(rgb,a,underRGB,underA,smoothstep(.06,0,depth)*.6);
    MWLayer(rgb,a,foamCol,trailFoam*.85);
    // 水際の途切れた泡の線（岸から0.15〜0.6m、または水深10cm未満）。ゆっくり寄せては返す
    float bankNear=(1-smoothstep(.15,.6,bankDist))*step(.04,bankDist);
    float shoreBand=max(smoothstep(.10,.025,depth)*smoothstep(0,.012,depth),bankNear*step(.02,depth));
    float lap=.5+.5*sin(t*1.25+psi*9+(x.x+x.y)*.7);
    float shorePat=dB.a*.6+dC*.4;   // 6回目：流れに伸ばした模様だと水際が波打ち過ぎた → 伸ばさない模様
    float shore=shoreBand*saturate((shorePat-(1-(.58+.04*lap)))*3)*(.7+.3*saturate(speed))*_ShoreFoam;
    MWLayer(rgb,a,foamCol,shore*.8);
    // 滝の着水：中心が明るく、外へ広がって薄れる輪（真上から見ても外への動きが読める）
    float ringF=0;
    [loop]for(int q2=0;q2<8;q2++){
     if(q2>=(int)_MWAtlas.x)break;
     float2 cen=(_MWFallContact[q2].xy+_MWFallContact[q2].zw)*.5;float wid=length(_MWFallContact[q2].zw-_MWFallContact[q2].xy);
     float2 rel=x-cen;float rr=length(rel);if(rr>10)continue;
     ringF+=exp(-rr*rr/(.5+wid*.15))*.55;
     [unroll]for(int k=0;k<3;k++){
      float ph=frac(t*.45+k/3.+q2*.37),R=.3+ph*(3.6+wid*.7);   // 8回目：届く距離 約4.4m→約6.4m（池の面に広がる波紋が無いという判定への対応）
      float arc=smoothstep(.25,.65,MWNoise(float2(atan2(rel.y,rel.x)*2.2+k*7.3+q2*5.,t*.25)));
      ringF+=exp(-pow((rr-R)/.32,2))*pow(1-ph,1.5)*arc*.75;
     }
    }
    MWLayer(rgb,a,foamCol,saturate(ringF)*.75);
    // 速い流れの白い筋（流れ関数ψ。流線にそろう）
    // 流れに乗る小さな泡の小片（流れが読めるように。細かい模様 dC が流れとともに下流へ動く）
    // 6回目：滝の近く（池）では小片を出さない（池が紙吹雪に見えた）。サンプルの池は着水点から最大11.75m（fallDist は上で計算）
    // 8・9回目に丸い点（マスごとの乱数の点）を試したが、点が運ばれずに点滅し、水玉模様に見えたので、ユーザー判断（10-20）で7回目の形に戻した（PLAN_08）
    float fleck=saturate((dC-(1-.24*saturate((speed-.12)/.4)))*7)*step(.12,speed)*smoothstep(11,14,fallDist)*_FoamStrength*_FleckStrength;
    MWLayer(rgb,a,foamCol,fleck*.7);
    if(speed>.2&&awayFromFall>.01){
     float2 dir=flow/max(speed,1e-3);
     float s0=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,float2(psi*.85,dot(x-off0,dir)*.05)+.13).a;
     float s1=SAMPLE_TEXTURE2D(_DetailTex,sampler_DetailTex,float2(psi*.85,dot(x-off1,dir)*.05)+.61).a;
     float streak=smoothstep(.62,.9,1-(s0*w0+s1*(1-w0)))*saturate((speed-.2)/.6)*_FlowStreak*awayFromFall;
     MWLayer(rgb,a,foamCol,streak*.55);
    }
    // 確認用：流れの矢印と速さの色（_MWDebug=1 のときだけ）
    if(_MWDebug>.5){
     MWLayer(rgb,a,lerp(float3(.1,.35,1.),float3(1.,.25,.1),saturate(speed/1.5)),.35);
     float2 cc=(floor(x/1.5)+.5)*1.5;float2 cuv=(cc-_MapRect.xy)*_MapRect.zw;half4 cf=SAMPLE_TEXTURE2D_LOD(_FlowTex,sampler_FlowTex,cuv,0);
     float2 cfl=(cf.rg*2-1)*_FlowMax*saturate(cf.a*60);float cs=length(cfl);
     if(cs>.04){
      float2 dir=cfl/cs;float2 qv=x-cc;float al=dot(qv,dir),pe=abs(dot(qv,float2(-dir.y,dir.x)));float len=.18+.42*saturate(cs/1.5);
      float shaft=step(pe,.045)*step(-len,al)*step(al,len*.55),head=step(len*.55,al)*step(al,len)*step(pe,(len-al)*.55);
      MWLayer(rgb,a,float3(1,1,.2),saturate(shaft+head));
     }
     a=max(a,.9);
    }
    // 岸の縁は透けて消える
    a*=smoothstep(0,.04,depth);
    return half4(rgb,a);
   }
   ENDHLSL
  }
 }
}
