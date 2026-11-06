Shader "MapRuins/SoilGround" {
 Properties { [HideInInspector] _TerrainHolesTexture("Holes",2D)="white"{} _TerrainSize("Terrain size",Vector)=(24,24,0,0)  _GroundMap("Raw sRGB JPEG (manual decode)",2D)="white"{} _GroundParams("Tile m / mix / cos / sin",Vector)=(4,.4,.8660254,.5) _GroundOffset("Second UV offset",Vector)=(.37,.21,0,0) _EditorZero("Unity XZ of editor origin",Vector)=(0,0,0,0) _WaveA("Wave A",Vector)=(.47,.29,.045,0) _WaveB("Wave B",Vector)=(-.21,.53,.025,0) _Decode("Decode exponent",Float)=2.2 _Unlit("Albedo reference",Float)=0
  _DirtMap("Raw sRGB soil",2D)="white"{} _DirtParams("Tile m / mix / cos / sin",Vector)=(2,.35,.8660254,.5) _DirtOffset("Soil second UV offset",Vector)=(.19,.43,0,0) _DirtWeight("Painted soil amount",Range(0,1))=0 _VertexDirt("Use vertex red soil amount",Float)=0
  _PureBlackMask("Export mask_3 blue (linear)",2D)="black"{} _PureBlackMapSize("Map size metres XZ",Vector)=(1,1,0,0) _PureBlackEnabled("Use opaque unlit black floor",Float)=0 }
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "TerrainCompatible"="True" "Queue"="Geometry-100"}
  Pass {
   Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma target 3.5
   #pragma multi_compile_instancing
   #pragma instancing_options assumeuniformscaling nomatrices nolightprobe nolightmap
   #pragma shader_feature_local _SOIL_TERRAIN
   #pragma multi_compile_fragment _ _ALPHATEST_ON
   #pragma multi_compile _ _ADDITIONAL_LIGHTS
   #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
   #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile_fragment _ _SHADOWS_SOFT
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   TEXTURE2D(_GroundMap);SAMPLER(sampler_GroundMap);
   TEXTURE2D(_DirtMap);SAMPLER(sampler_DirtMap);
    TEXTURE2D(_PureBlackMask);SAMPLER(sampler_PureBlackMask);
   CBUFFER_START(UnityPerMaterial)
     float4 _TerrainSize,_GroundParams,_GroundOffset,_EditorZero,_WaveA,_WaveB,_DirtParams,_DirtOffset,_PureBlackMapSize,_PureBlackMask_TexelSize;float _Decode,_Unlit,_DirtWeight,_VertexDirt,_PureBlackEnabled;
   CBUFFER_END

   // URP 17.5 Terrain patch reconstruction, matching TerrainLitInput.hlsl.
   CBUFFER_START(_Terrain)
   float4 _TerrainHeightmapRecipSize,_TerrainHeightmapScale;
   CBUFFER_END
   #ifdef UNITY_INSTANCING_ENABLED
   TEXTURE2D(_TerrainHeightmapTexture);TEXTURE2D(_TerrainNormalmapTexture);
   #endif
   TEXTURE2D(_TerrainHolesTexture);SAMPLER(sampler_TerrainHolesTexture);
   UNITY_INSTANCING_BUFFER_START(Terrain)
   UNITY_DEFINE_INSTANCED_PROP(float4,_TerrainPatchInstanceData)
   UNITY_INSTANCING_BUFFER_END(Terrain)
   struct Attributes{float4 positionOS:POSITION;float3 normalOS:NORMAL;UNITY_VERTEX_INPUT_INSTANCE_ID};
   struct Varyings{float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;half3 normalWS:TEXCOORD1;float2 holesUV:TEXCOORD2;};
   Varyings Vert(Attributes i){UNITY_SETUP_INSTANCE_ID(i);Varyings o;float4 p=i.positionOS;float3 n=i.normalOS;
   #ifdef UNITY_INSTANCING_ENABLED
    float4 patch=UNITY_ACCESS_INSTANCED_PROP(Terrain,_TerrainPatchInstanceData);
    float2 coords=(p.xy+patch.xy)*patch.z;
    p.xz=coords*_TerrainHeightmapScale.xz;p.y=UnpackHeightmap(_TerrainHeightmapTexture.Load(int3(coords,0)))*_TerrainHeightmapScale.y;
    n=_TerrainNormalmapTexture.Load(int3(coords,0)).rgb*2-1;
   #endif
    o.holesUV=p.xz/_TerrainSize.xy;VertexPositionInputs v=GetVertexPositionInputs(p.xyz);o.positionCS=v.positionCS;o.positionWS=v.positionWS;o.normalWS=TransformObjectToWorldNormal(n);return o;
   }
   float Hash21(float2 p){p=frac(p*float2(123.34,456.21));p+=dot(p,p+45.32);return frac(p.x*p.y);}
   float ValueNoise(float2 p){float2 i=floor(p),f=frac(p);f=f*f*(3-2*f);return lerp(lerp(Hash21(i),Hash21(i+float2(1,0)),f.x),lerp(Hash21(i+float2(0,1)),Hash21(i+float2(1,1)),f.x),f.y);}
   float SoilWeight(float2 p,float paint){float a=.5,s=0;p=p*1.6+5;for(int i=0;i<4;i++){s+=a*ValueNoise(p);p=p*2.03+17.1;a*=.5;}return smoothstep(.2,.55,paint+(s-.5)*.35);}
   #define ROOT_DIRT(uv) SAMPLE_TEXTURE2D(_DirtMap,sampler_DirtMap,uv).rgb
float SoilDetailNoise(float2 p){float2 i=floor(p),f=frac(p);f=f*f*(3-2*f);float4 n=frac(sin(float4(dot(i,float2(127.1,311.7)),dot(i+float2(1,0),float2(127.1,311.7)),dot(i+float2(0,1),float2(127.1,311.7)),dot(i+float2(1,1),float2(127.1,311.7))))*43758.5453);return lerp(lerp(n.x,n.y,f.x),lerp(n.z,n.w,f.x),f.y);}
float3 SoilDetailGrain(float2 p){float2 cell=floor(p*5.5),f=frac(p*5.5);float seed=frac(sin(dot(cell,float2(127.1,311.7)))*43758.5453);float2 centre=.25+.5*float2(frac(seed*71.3),frac(seed*113.7));float r=length((f-centre)*float2(1,1.35)),aa=max(fwidth(r),.008),radius=.035+.055*frac(seed*29);float stone=(1-smoothstep(radius-aa,radius+aa,r))*step(.72,seed);return float3(stone,seed,(1-smoothstep(0,radius+aa,r))*step(.72,seed));}
float3 DetailedDirt(float2 p){float2 uv=p/_DirtParams.x;float2 q=float2(uv.x*_DirtParams.z-uv.y*_DirtParams.w,uv.x*_DirtParams.w+uv.y*_DirtParams.z)+_DirtOffset.xy;float3 c=lerp(ROOT_DIRT(uv),ROOT_DIRT(q),_DirtParams.y),fine=ROOT_DIRT(p/.47+float2(.37,.81));c*=.82+.36*saturate(dot(fine,float3(.333,.333,.333))/.5);float mottle=SoilDetailNoise(p*.9+float2(8.2,3.7)),grain=SoilDetailNoise(p*23);c*=.83+.30*mottle;c=lerp(c,c*float3(.80,.78,.72),smoothstep(.57,.78,SoilDetailNoise(p*3.8+13))*.35);c*=.90+.20*grain;float3 g=SoilDetailGrain(p);return lerp(c,lerp(float3(.37,.32,.24),float3(.69,.63,.51),g.y),g.x*.68);}
#undef ROOT_DIRT

   float3 Grass(float2 p){
    float2 uv=p/_GroundParams.x;
    float2 q=float2(uv.x*_GroundParams.z-uv.y*_GroundParams.w,uv.x*_GroundParams.w+uv.y*_GroundParams.z)+_GroundOffset.xy;
    float3 c=SAMPLE_TEXTURE2D(_GroundMap,sampler_GroundMap,uv).rgb;
    if(_GroundParams.y>0)c=lerp(c,SAMPLE_TEXTURE2D(_GroundMap,sampler_GroundMap,q).rgb,_GroundParams.y);
    c*=1+_WaveA.z*sin(dot(p,_WaveA.xy))+_WaveB.z*sin(dot(p,_WaveB.xy));
    return c;
   }
   half4 Frag(Varyings i):SV_Target{
    #if defined(_SOIL_TERRAIN) && defined(_ALPHATEST_ON)
    clip(SAMPLE_TEXTURE2D(_TerrainHolesTexture,sampler_TerrainHolesTexture,i.holesUV).r-.0005);
    #endif
     // Opaque floor, not a hole or a black PBR albedo. No lighting or fog on full coverage.
     float black=0;
     if(_PureBlackEnabled>.5){float2 uv=saturate(i.positionWS.xz/_PureBlackMapSize.xy);uv=uv*(1-_PureBlackMask_TexelSize.xy)+.5*_PureBlackMask_TexelSize.xy;black=saturate(SAMPLE_TEXTURE2D(_PureBlackMask,sampler_PureBlackMask,uv).b);if(black>=1)return half4(0,0,0,1);}
    float2 p=float2(i.positionWS.x-_EditorZero.x,_EditorZero.y-i.positionWS.z);half3 c=DetailedDirt(p);
#ifndef UNITY_COLORSPACE_GAMMA
 c=pow(c,_Decode);
#endif
     if(_Unlit>.5)return half4(c*(1-black),1);
    InputData input=(InputData)0;input.positionWS=i.positionWS;input.shadowCoord=TransformWorldToShadowCoord(i.positionWS);input.normalWS=normalize(i.normalWS);input.viewDirectionWS=GetWorldSpaceNormalizeViewDir(i.positionWS);input.bakedGI=SampleSH(input.normalWS);input.shadowMask=half4(1,1,1,1);input.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.positionCS);
    SurfaceData surface=(SurfaceData)0;surface.albedo=c;surface.metallic=0;surface.specular=half3(.04,.04,.04);surface.smoothness=.08;surface.normalTS=half3(0,0,1);surface.occlusion=1;surface.alpha=1;
     half4 lit=UniversalFragmentPBR(input,surface);lit.rgb*=1-black;return lit;
   }
   ENDHLSL
  }
  UsePass "Universal Render Pipeline/Terrain/Lit/ShadowCaster"
  UsePass "Universal Render Pipeline/Terrain/Lit/DepthOnly"
 }
 Fallback Off
}
