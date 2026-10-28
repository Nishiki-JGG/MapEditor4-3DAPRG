// Dedicated to the three upper chest variants. SharedPropLit is unchanged.
Shader "MapSharedProps/ChestMetal" {
 Properties {
   _RoyalPBR("Royal URP metallic reflection",Range(0,1))=0
   _RoyalReflection("Shared artistic reflection",Cube)="black"{}
   _RoyalArtReflection("Use artistic reflection; zero uses scene probes",Range(0,1))=0
  [HideInInspector] _ChestMean0("Wood far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean1("Worn far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean2("Metal far mean",Vector)=(1,1,1,1) [HideInInspector] _ChestMean3("Etched far mean",Vector)=(1,1,1,1)
  [HideInInspector] _ChestGoldMean0("Gold face 0 mean",Vector)=(1,1,1,1)
  [HideInInspector] _ChestGoldMean1("Gold face 1 mean",Vector)=(1,1,1,1)
  [HideInInspector] _ChestGoldMean2("Gold face 2 mean",Vector)=(1,1,1,1)
  [HideInInspector] _ChestGoldMean3("Gold face 3 mean",Vector)=(1,1,1,1)
  [HideInInspector] _ChestGoldMean4("Gold face 4 mean",Vector)=(1,1,1,1)
  _ChestColour("Surface colour sRGB",2D)="white"{} _ChestPacked("NormalXY roughness AO",2D)="white"{} _ChestVariant("Surface variant",Float)=4 _ChestWoodRect("Wood UV rectangle",Vector)=(0,0,1,1)
  _RoyalRubyEnabled("Opaque faceted ruby",Float)=0
  _RoyalFinish("Royal intrinsic RGB roughness A",2D)="white"{} _RoyalFinishEnabled("Royal finish enabled",Float)=0
  _RoyalNormal("Royal tangent XYZ",2D)="bump"{} _RoyalAO("Royal AO",2D)="white"{} _RoyalColour("Royal linear colour",Vector)=(.48515,.254152,.035601,1) _RoyalRuby("Ruby linear colour",Vector)=(.376,.004,.018,1)
  _BaseMap("Base colour",2D)="white"{} _BaseColor("Tint",Color)=(1,1,1,1)
  _Rainbow("Iridescent coat",Range(0,1))=0 _ChestTime("Time override; negative uses runtime",Float)=-1
  _Cutoff("Cutoff",Float)=0 [Enum(UnityEngine.Rendering.CullMode)] _Cull("Cull",Float)=2
 }
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"} Cull [_Cull]
  HLSLINCLUDE
  // Presentation only; root geometry and collider remain unchanged.
  float3 ChestSeamPosition(float3 p,float marked,float variant){if(variant>4.5&&variant<5.5&&marked>.5&&p.y>.43&&abs(abs(p.x)-.20)<.0076)p.x=sign(p.x)*.20+(p.x-sign(p.x)*.20)*.20;return p;}
  ENDHLSL
  Pass {
   Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma target 3.0
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma shader_feature_local _ CHEST_ROYAL_ROOT CHEST_ROYAL_RELIEF
   #pragma shader_feature_local _ CHEST_ORNAMENT
   #pragma shader_feature_local _ CHEST_GOLD_ATLAS CHEST_PART_ATLAS
   #pragma shader_feature_local _ CHEST_SURFACE
   #pragma multi_compile_instancing
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
   // URP 17.5 Forward and Forward+; chest detail/shadows are evaluated per pixel.
   #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
   #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
   #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _RoyalColour,_RoyalRuby;float _RoyalFinishEnabled,_RoyalRubyEnabled,_RoyalPBR,_RoyalArtReflection;
    float4 _ChestGoldMean0,_ChestGoldMean1,_ChestGoldMean2,_ChestGoldMean3,_ChestGoldMean4;float4 _BaseColor,_ChestWoodRect,_ChestMean0,_ChestMean1,_ChestMean2,_ChestMean3;float _Rainbow,_ChestTime,_Cutoff,_Cull,_ChestVariant;
   CBUFFER_END
   // Royal variants require the shared surface helpers even when authored without CHEST_SURFACE.
   #if (defined(CHEST_ROYAL_ROOT) || defined(CHEST_ROYAL_RELIEF)) && !defined(CHEST_SURFACE)
   #define CHEST_SURFACE 1
   #endif
   #if defined(CHEST_SURFACE)
   #include "ChestSurface.hlsl"
   #endif
   TEXTURECUBE(_RoyalReflection);SAMPLER(sampler_RoyalReflection);
   TEXTURE2D(_RoyalFinish);SAMPLER(sampler_RoyalFinish);TEXTURE2D(_RoyalNormal);SAMPLER(sampler_RoyalNormal);TEXTURE2D(_RoyalAO);SAMPLER(sampler_RoyalAO);
   struct A {float4 positionOS:POSITION;float3 normalOS:NORMAL;float4 color:COLOR;float glow:TEXCOORD2;float2 uv:TEXCOORD0;UNITY_VERTEX_INPUT_INSTANCE_ID
   #if defined(CHEST_ORNAMENT)
   float finish:TEXCOORD3;float surfaceMode:TEXCOORD1;
   #endif
   #if defined(CHEST_ROYAL_RELIEF)
   float4 tangentOS:TANGENT;float2 royalMask:TEXCOORD4;
   #endif
   };
   struct V {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;float3 normalWS:TEXCOORD1;float3 positionOS:TEXCOORD2;float4 color:COLOR;float glow:TEXCOORD3;float finish:TEXCOORD4;float ink:TEXCOORD5;float3 surface:TEXCOORD6;
   #if (defined(CHEST_GOLD_ATLAS) || defined(CHEST_PART_ATLAS)) && !defined(CHEST_ROYAL_ROOT) && !defined(CHEST_ROYAL_RELIEF)
   float3 goldNormalOS:TEXCOORD7;
   #endif
   #if defined(CHEST_ROYAL_RELIEF)
   float4 royalTangentWS:TEXCOORD7;float4 royalUVMask:TEXCOORD8;
   #elif defined(CHEST_ROYAL_ROOT)
   float4 rubyX:TEXCOORD7;float4 rubyZ:TEXCOORD8;
   #endif
   };
   #if defined(CHEST_ROYAL_ROOT)
float3 ChestRubyDirect(float3 n,float3 v,float3 l,float3 radiance,float2 q,float3 x,float3 z,float3 inner,float absorption,float edge){
 float nl=max(dot(n,l),0.),nv=clamp(dot(n,v),0.,1.);float3 h=(l+v)/max(length(l+v),.00001);
 float inside=pow(max(dot(inner,h),0.),10.);
 float depth=clamp(.14+.24*nl+.08*(1.-nv)+.10*edge+.64*inside,0.,1.);
 float3 tint=lerp(float3(.055,.0006,.003),float3(.62,.008,.025),depth)*absorption;
 float3 lambert=radiance*(nl*INV_PI),weight=clamp(lambert*2.,float3(0.,0.,0.),float3(1.,1.,1.));
 float2 centre=clamp(float2(dot(h,x),dot(h,z))*2.8,float2(-.60,-.60),float2(.60,.60));
 float2 delta=(q-centre)*float2(4.8,7.);float shape=max(abs(delta.x)+abs(delta.y)*.25,abs(delta.y)+abs(delta.x)*.25);
 float reflectionMask=1.-smoothstep(.52,.72,shape),halfAngle=max(dot(n,h),0.);
 float3 white=float3(1.,.97,.95)*weight*reflectionMask*(pow(halfAngle,220.)*2.6+pow(halfAngle,36.)*.06);
 float3 internalReflection=float3(.75,.055,.10)*weight*pow(max(dot(inner,h),0.),28.)*2.;
 return tint*lambert*.95+white+internalReflection;
}
   #endif
   // URP supplies distance, cone and shadow attenuation; never reconstruct a light radius here.
   void ChestAccumulateLocal(Light source,float3 n,float3 viewWS,float exponent,float roughSpec,
                             inout float3 diffuse,inout float3 specular,inout float energy) {
    float3 radiance=source.color*source.distanceAttenuation*source.shadowAttenuation;
    float facing=saturate(dot(n,source.direction));
    diffuse+=radiance*facing;
    energy+=dot(radiance,float3(.2126,.7152,.0722))*facing;
    if(facing>0)specular+=radiance*pow(saturate(dot(n,SafeNormalize(source.direction+viewWS))),exponent)*roughSpec*facing;
   }
   V Vert(A v){UNITY_SETUP_INSTANCE_ID(v);
   #if defined(CHEST_SURFACE)
    float seamMark=1-step(-3,v.uv.x);
    #if defined(CHEST_ORNAMENT)
    seamMark=max(seamMark,v.finish);
    #endif
    v.positionOS.xyz=ChestSeamPosition(v.positionOS.xyz,seamMark,_ChestVariant);
   #endif
   V o;VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);o.positionCS=p.positionCS;o.positionWS=p.positionWS;o.normalWS=TransformObjectToWorldNormal(v.normalOS);o.positionOS=v.positionOS.xyz;o.color=v.color*_BaseColor;o.color.a=v.normalOS.y;o.glow=v.glow;o.finish=0;o.ink=1-step(-3,v.uv.x);o.surface=0;
   #if defined(CHEST_SURFACE)
   #if defined(CHEST_ORNAMENT)
   o.surface=ChestOrnamentUV(v.positionOS.xyz,v.surfaceMode,v.glow);
   #else
   o.surface=ChestSurfaceUV(v.positionOS.xyz,v.normalOS,v.uv,v.glow);
   #endif
   #endif
   #if defined(CHEST_ORNAMENT)
   o.finish=v.finish;o.ink=max(o.ink,v.finish);
   #endif
   #if (defined(CHEST_GOLD_ATLAS) || defined(CHEST_PART_ATLAS)) && !defined(CHEST_ROYAL_ROOT) && !defined(CHEST_ROYAL_RELIEF)
   o.goldNormalOS=v.normalOS;
   #endif
   #if defined(CHEST_ROYAL_RELIEF)
   o.royalTangentWS=float4(TransformObjectToWorldDir(v.tangentOS.xyz),v.tangentOS.w*GetOddNegativeScale());o.royalUVMask=float4(v.uv,v.royalMask);o.surface=ChestSurfaceUV(v.positionOS.xyz,v.normalOS,v.uv,v.glow);
   #endif
   #if defined(CHEST_ROYAL_ROOT)
   float3 rubyUp=mul((float3x3)UNITY_MATRIX_V,TransformObjectToWorldNormal(float3(0,1,0)));o.rubyX=float4(mul((float3x3)UNITY_MATRIX_V,TransformObjectToWorldNormal(float3(1,0,0))),rubyUp.x);o.rubyZ=float4(mul((float3x3)UNITY_MATRIX_V,TransformObjectToWorldNormal(float3(0,0,1))),rubyUp.y);o.color.a=rubyUp.z;
   #endif
   return o;}
   half4 Frag(V i):SV_Target {
    float3 n=normalize(i.normalWS),finishColour=i.color.rgb;float surfaceMask=0;float royalAO=1,royalFinishMask=0;float4 detail=float4(.5,.5,.5,1);
    #if defined(CHEST_ROYAL_ROOT) || defined(CHEST_ROYAL_RELIEF)
    surfaceMask=1;float4 finishSample=float4(_RoyalColour.rgb,.4);
    if(_RoyalFinishEnabled>.5){float2 finishUV;
    #if defined(CHEST_ROYAL_RELIEF)
    royalFinishMask=i.royalUVMask.w;finishUV=i.royalUVMask.xy;
    #else
    float3 fp=i.positionOS;fp.z=-fp.z;float ax=abs(fp.x);royalFinishMask=smoothstep(.062,.080,ax)*(1-smoothstep(.330,.348,ax))*step(.61,fp.y)*step(fp.y,.728)*step(abs(fp.z),.326);float fv=saturate((fp.z+.325)/.65);if(fp.x<0)fv=1-fv;finishUV=float2(.37+saturate((ax-.062)/.286)*.18,.04+fv*.44);
    #endif
    finishSample=lerp(finishSample,SAMPLE_TEXTURE2D(_RoyalFinish,sampler_RoyalFinish,finishUV),royalFinishMask);}
    detail=ChestApplyPacked(float4(.5,.5,finishSample.a,1),i.surface,i.positionOS);finishColour=lerp(finishSample.rgb,_RoyalRuby.rgb,step(i.color.g*2.5,i.color.r));
    #if defined(CHEST_ROYAL_RELIEF)
    float3 tangent=normalize(i.royalTangentWS.xyz-n*dot(n,i.royalTangentWS.xyz));float3 bitangent=cross(n,tangent)*i.royalTangentWS.w;
    float3 mapN=SAMPLE_TEXTURE2D(_RoyalNormal,sampler_RoyalNormal,i.royalUVMask.xy).xyz*2-1;float3 mapped=normalize(tangent*mapN.x+bitangent*mapN.y+n*mapN.z);n=normalize(lerp(n,mapped,i.royalUVMask.z));royalAO=lerp(1,lerp(1,SAMPLE_TEXTURE2D(_RoyalAO,sampler_RoyalAO,i.royalUVMask.xy).r,.25),i.royalUVMask.z);
    #endif
    #elif defined(CHEST_SURFACE)
    #if defined(CHEST_GOLD_ATLAS) || defined(CHEST_PART_ATLAS)
    float goldFace=ChestGoldFace(i.positionOS,i.goldNormalOS);float2 goldUV=ChestGoldUV(i.positionOS,goldFace);detail=ChestApplyPacked(ChestGoldRaw(goldUV,goldFace),i.surface,i.positionOS);surfaceMask=step(.5,i.surface.z);n=ChestDetailNormal(n,i.positionWS,goldUV,(detail.xy*2-1)*surfaceMask);finishColour=lerp(finishColour,ChestGoldColour(goldUV,goldFace),surfaceMask*(1-ChestGoldKeyhole(i.positionOS)));
    #else
    float3 surfaceUV=ChestSurfaceSampleUV(i.surface,i.positionOS);detail=ChestPacked(surfaceUV,i.surface,i.positionOS);surfaceMask=step(.5,i.surface.z);n=ChestDetailNormal(n,i.positionWS,surfaceUV.xy,(detail.xy*2-1)*surfaceMask);finishColour*=lerp(1,ChestColour(surfaceUV,i.surface,i.positionOS)*detail.a,surfaceMask);
    #endif
    #endif
    float3 nv=normalize(mul((float3x3)UNITY_MATRIX_V,n)),cv=normalize(mul((float3x3)UNITY_MATRIX_V,GetWorldSpaceNormalizeViewDir(i.positionWS)));
    // This shader has no lightmap input; retain legacy probe occlusion and realtime shadows.
    half4 chestShadowMask=unity_ProbesOcclusion;
    Light light=GetMainLight(TransformWorldToShadowCoord(i.positionWS),i.positionWS,chestShadowMask);float3 cl=normalize(mul((float3x3)UNITY_MATRIX_V,float3(-.3,.8,.5)));
    #if defined(CHEST_SURFACE)
    cl=normalize(mul((float3x3)UNITY_MATRIX_V,light.direction));
    #endif
    float3 mainRadiance=light.color*light.distanceAttenuation*light.shadowAttenuation;
    float cs=pow(max(0,dot(nv,normalize(cl+cv))),lerp(lerp(80,160,i.finish),lerp(180,18,detail.b),surfaceMask)),cr=pow(1-max(0,dot(nv,cv)),3),t=_ChestTime<0?_Time.y:_ChestTime;
    cs*=lerp(1,lerp(1.12,.42,detail.b),surfaceMask);
    float3 refl=reflect(-cv,nv);float env=.14+.45*smoothstep(-.10,.55,refl.y)+.65*pow(max(0,1-abs(refl.y-.4)),lerp(16,lerp(48,6,detail.b),surfaceMask));
    env*=lerp(1,lerp(1.18,.48,detail.b),surfaceMask)*royalAO;float3 coat=.5+.5*cos(float3(0,2.094,4.188)+dot(nv,cv)*9+t*.45);
    float3 ambientUp=max(SampleSH(float3(0,1,0)),0),ambientFace=max(SampleSH(n),0);
    float ambientEnergy=dot(ambientUp,float3(.2126,.7152,.0722));
    float oldGain=saturate(ambientEnergy/.35);
    float mainEnergy=dot(mainRadiance,float3(.2126,.7152,.0722));
    float3 localDiffuse=0,localSpec=0;float localEnergy=0;
    #if defined(CHEST_ROYAL_ROOT)
    bool rubyActive=_RoyalRubyEnabled>.5&&i.color.r>i.color.g*2.5;
    float rubyNV=saturate(dot(nv,cv));float3 rubyX=normalize(i.rubyX.xyz),rubyZ=-normalize(i.rubyZ.xyz),rubyY=normalize(float3(i.rubyX.w,i.rubyZ.w,i.color.a));
    float2 rubyQ=float2(i.positionOS.x,-i.positionOS.z)/float2(.092,.07728);float rubyEdge=saturate(length(rubyQ));
    float2 rubyRay=float2(dot(cv,rubyX),dot(cv,rubyZ))/max(dot(cv,rubyY),.30),rubyInside=rubyQ-rubyRay*.20;
    float rubySector=floor(atan2(rubyInside.y,rubyInside.x)/.785398163+.5)*.785398163;
    float rubyRing=step(.48,dot(rubyInside,float2(cos(rubySector),sin(rubySector)))),rubyAngle=rubySector+rubyRing*.392699082;
    float3 rubyInner=normalize(rubyY*lerp(.78,.54,rubyRing)-(rubyX*cos(rubyAngle)+rubyZ*sin(rubyAngle))*lerp(.626,.842,rubyRing));
    float rubyAbsorption=.70+.30*smoothstep(.16,.85,length(rubyInside));
    float3 rubyDirectRadiance=0;if(rubyActive)rubyDirectRadiance=ChestRubyDirect(nv,cv,mul((float3x3)UNITY_MATRIX_V,light.direction),mainRadiance,rubyQ,rubyX,rubyZ,rubyInner,rubyAbsorption,rubyEdge);
    #endif

    float exponent=lerp(lerp(80,160,i.finish),lerp(180,18,detail.b),surfaceMask);
    float roughSpec=lerp(1,lerp(1.12,.42,detail.b),surfaceMask);
    InputData inputData=(InputData)0;
    inputData.positionWS=i.positionWS;inputData.normalWS=n;
    inputData.viewDirectionWS=GetWorldSpaceNormalizeViewDir(i.positionWS);
    inputData.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.positionCS);
    #if defined(_ADDITIONAL_LIGHTS) || defined(_ADDITIONAL_LIGHTS_VERTEX) || USE_CLUSTER_LIGHT_LOOP
    // Forward+ non-main directional lights live outside the clustered punctual loop.
    #if USE_CLUSTER_LIGHT_LOOP
    UNITY_LOOP for(uint lightIndex=0;lightIndex<min(URP_FP_DIRECTIONAL_LIGHTS_COUNT,MAX_VISIBLE_LIGHTS);lightIndex++) {
     Light additionalLight=GetAdditionalLight(lightIndex,inputData.positionWS,chestShadowMask);
     ChestAccumulateLocal(additionalLight,n,inputData.viewDirectionWS,exponent,roughSpec,localDiffuse,localSpec,localEnergy);
     #if defined(CHEST_ROYAL_ROOT)
     if(rubyActive)rubyDirectRadiance+=ChestRubyDirect(nv,cv,mul((float3x3)UNITY_MATRIX_V,additionalLight.direction),additionalLight.color*additionalLight.distanceAttenuation*additionalLight.shadowAttenuation,rubyQ,rubyX,rubyZ,rubyInner,rubyAbsorption,rubyEdge);
     #endif
    }
    #endif
    uint pixelLightCount=GetAdditionalLightsCount();
    LIGHT_LOOP_BEGIN(pixelLightCount)
     Light additionalLight=GetAdditionalLight(lightIndex,inputData.positionWS,chestShadowMask);
     ChestAccumulateLocal(additionalLight,n,inputData.viewDirectionWS,exponent,roughSpec,localDiffuse,localSpec,localEnergy);
     #if defined(CHEST_ROYAL_ROOT)
     if(rubyActive)rubyDirectRadiance+=ChestRubyDirect(nv,cv,mul((float3x3)UNITY_MATRIX_V,additionalLight.direction),additionalLight.color*additionalLight.distanceAttenuation*additionalLight.shadowAttenuation,rubyQ,rubyX,rubyZ,rubyInner,rubyAbsorption,rubyEdge);
     #endif
    LIGHT_LOOP_END
    #endif
    // SampleSH already represents diffuse irradiance; do not apply Web's extra 1/pi again.
    float gain=min(oldGain,lerp(saturate(ambientEnergy),oldGain,saturate((mainEnergy+localEnergy)/1.05)));
    cs*=saturate(mainEnergy/1.05);
    float3 specTint=lerp(lerp(float3(1,1,1),finishColour,.35),float3(.025,.025,.025)+finishColour*.8,i.ink);
    specTint=lerp(specTint,float3(.04,.04,.04)+finishColour*.86,royalFinishMask);
    float3 rgb=finishColour*(ambientFace*royalAO+mainRadiance*saturate(dot(n,light.direction))+localDiffuse)*lerp(.46,.92,i.finish);
    rgb+=finishColour*env*lerp(.62,.08,i.finish)*gain+specTint*(cs*lerp(.95,.35,i.finish)+cr*.14)*gain;
    rgb+=specTint*localSpec*.95*oldGain;
    rgb+=(1-i.ink)*_Rainbow*coat*(.10+cr*.14)*gain+finishColour*i.glow*(.72+.28*sin(t*3+i.positionOS.x*17+i.positionOS.z*11));
    float3 rainBase=max(finishColour,0);float rainMax=max(rainBase.r,max(rainBase.g,rainBase.b)),rainMin=min(rainBase.r,min(rainBase.g,rainBase.b));
    float rainBody=smoothstep(.12,.35,(rainMax-rainMin)/max(rainMax,.01))*(1-i.ink)*_Rainbow;
    float3 rainSpectrum=.5+.5*cos(float3(0,2.094,4.188)+i.positionOS.x*2.2-i.positionOS.z*1.4+t*.5);
    float rainSeam=exp(-abs(i.positionOS.y-.435)*65),rainRole=1;
    #if defined(CHEST_ORNAMENT)
    rainRole=.65;
    #endif
    float rainWork=(.24+.16*max(i.color.a,0)+.20*rainSeam)*rainRole;
    rgb+=lerp(rainBase,rainSpectrum*rainMax,.22)*rainWork*(.94+.06*sin(t*.9+i.positionOS.y*3))*rainBody;
    #if defined(CHEST_ROYAL_ROOT) || defined(CHEST_ROYAL_RELIEF)
    // Native URP BRDF: gold has no Lambert diffuse; preserve the authored finish and baked normal.
    if(_RoyalPBR>.5){
     SurfaceData goldSurface=(SurfaceData)0;
     goldSurface.albedo=float3(.95,.56,.10)*clamp(finishColour/max(_RoyalColour.rgb,float3(.001,.001,.001)),float3(.55,.55,.55),float3(1,1,1));
     goldSurface.metallic=1;goldSurface.smoothness=1-clamp(detail.b*.70,.12,1);
     goldSurface.normalTS=float3(0,0,1);goldSurface.occlusion=royalAO;goldSurface.alpha=1;
     inputData.shadowCoord=TransformWorldToShadowCoord(i.positionWS);inputData.bakedGI=ambientFace;inputData.shadowMask=chestShadowMask;
     if(_RoyalArtReflection<.5)rgb=UniversalFragmentPBR(inputData,goldSurface).rgb;
     else{
      BRDFData goldBRDF;InitializeBRDFData(goldSurface,goldBRDF);
      float3 reflectedWS=reflect(-inputData.viewDirectionWS,n);
      float reflectionMip=PerceptualRoughnessToMipmapLevel(goldBRDF.perceptualRoughness);
      float environmentGain=saturate(ambientEnergy*3+(mainEnergy+localEnergy)*.5);
      half3 reflectedRadiance=SAMPLE_TEXTURECUBE_LOD(_RoyalReflection,sampler_RoyalReflection,reflectedWS,reflectionMip).rgb*environmentGain;
      rgb=EnvironmentBRDF(goldBRDF,ambientFace,reflectedRadiance,Pow4(1-saturate(dot(n,inputData.viewDirectionWS))))*royalAO;
      rgb+=LightingPhysicallyBased(goldBRDF,light,n,inputData.viewDirectionWS);
      #if defined(_ADDITIONAL_LIGHTS) || defined(_ADDITIONAL_LIGHTS_VERTEX) || USE_CLUSTER_LIGHT_LOOP
      #if USE_CLUSTER_LIGHT_LOOP
      UNITY_LOOP for(uint goldIndex=0;goldIndex<min(URP_FP_DIRECTIONAL_LIGHTS_COUNT,MAX_VISIBLE_LIGHTS);goldIndex++){
       Light goldLight=GetAdditionalLight(goldIndex,inputData.positionWS,chestShadowMask);
       rgb+=LightingPhysicallyBased(goldBRDF,goldLight,n,inputData.viewDirectionWS);
      }
      #endif
      uint goldCount=GetAdditionalLightsCount();
      LIGHT_LOOP_BEGIN(goldCount)
       Light goldLight=GetAdditionalLight(lightIndex,inputData.positionWS,chestShadowMask);
       rgb+=LightingPhysicallyBased(goldBRDF,goldLight,n,inputData.viewDirectionWS);
      LIGHT_LOOP_END
      #endif
     }
    }
    #endif
    #if defined(CHEST_ROYAL_ROOT)
    if(rubyActive){
     float3 rubyAmbientTint=lerp(float3(.055,.0006,.003),float3(.62,.008,.025),.14+.08*(1-rubyNV)+.10*rubyEdge)*rubyAbsorption;
     float rubyFresnel=.078+.922*pow(1-rubyNV,5);
     // URP SH is integrated indirect diffuse. INV_PI is applied only to direct light in ChestRubyDirect.
     rgb=rubyDirectRadiance+rubyAmbientTint*ambientFace*.95+float3(.30,.002,.012)*env*.12*gain+float3(.85,.90,1)*rubyFresnel*.16*gain;
    }
    #endif
    return half4(rgb,1);
   }
   ENDHLSL
  }
  // Standard URP caster bias belongs to this new material, never a global override.
  Pass {
   Name "ShadowCaster" Tags {"LightMode"="ShadowCaster"} ZWrite On ColorMask 0
   HLSLPROGRAM
   #pragma target 3.0
   #pragma shader_feature_local _ CHEST_SURFACE
   #pragma shader_feature_local _ CHEST_ORNAMENT
   #pragma vertex ShadowVert
   #pragma multi_compile_instancing
   #pragma fragment ShadowFrag
   #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _RoyalColour,_RoyalRuby;float _RoyalFinishEnabled,_RoyalRubyEnabled,_RoyalPBR,_RoyalArtReflection;
    float4 _ChestGoldMean0,_ChestGoldMean1,_ChestGoldMean2,_ChestGoldMean3,_ChestGoldMean4;float4 _BaseColor,_ChestWoodRect,_ChestMean0,_ChestMean1,_ChestMean2,_ChestMean3;float _Rainbow,_ChestTime,_Cutoff,_Cull,_ChestVariant;
   CBUFFER_END
   float3 _LightDirection;float3 _LightPosition;
   struct SA {float4 p:POSITION;float3 normalOS:NORMAL;float2 uv:TEXCOORD0;
   #if defined(CHEST_ORNAMENT)
   float finish:TEXCOORD3;
   #endif
   UNITY_VERTEX_INPUT_INSTANCE_ID};
   float4 ShadowVert(SA i):SV_POSITION {
    UNITY_SETUP_INSTANCE_ID(i);
    #if defined(CHEST_SURFACE)
    float seamMark=1-step(-3,i.uv.x);
    #if defined(CHEST_ORNAMENT)
    seamMark=max(seamMark,i.finish);
    #endif
    i.p.xyz=ChestSeamPosition(i.p.xyz,seamMark,_ChestVariant);
    #endif
    float3 positionWS=TransformObjectToWorld(i.p.xyz),normalWS=TransformObjectToWorldNormal(i.normalOS);
    #if _CASTING_PUNCTUAL_LIGHT_SHADOW
    float3 direction=normalize(_LightPosition-positionWS);
    #else
    float3 direction=_LightDirection;
    #endif
    return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(positionWS,normalWS,direction)));
   }
   half4 ShadowFrag():SV_Target{return 0;}
   ENDHLSL
  }
 }
 SubShader {
  Tags {"RenderType"="Opaque"} Cull [_Cull]
  CGPROGRAM
  #pragma surface Surf Standard fullforwardshadows addshadow
  #pragma target 3.0
  half4 _BaseColor;half _Rainbow;float _ChestTime;
  struct Input {float4 color:COLOR;float3 viewDir;float2 uv_BaseMap;};
  void Surf(Input i,inout SurfaceOutputStandard o){o.Albedo=i.color.rgb*_BaseColor.rgb;o.Metallic=.65;o.Smoothness=.78;float t=_ChestTime<0?_Time.y:_ChestTime;o.Emission=step(-3,i.uv_BaseMap.x)*_Rainbow*(.5+.5*cos(float3(0,2.094,4.188)+i.viewDir.z*9+t*.45))*.14;}
  ENDCG
 }
}
