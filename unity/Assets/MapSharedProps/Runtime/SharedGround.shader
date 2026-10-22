Shader "MapSharedGround/Grass" {
 Properties { _GroundMap("Raw sRGB JPEG (manual decode)",2D)="white"{} _GroundParams("Tile m / mix / cos / sin",Vector)=(4,.4,.8660254,.5) _GroundOffset("Second UV offset",Vector)=(.37,.21,0,0) _EditorZero("Unity XZ of editor origin",Vector)=(0,0,0,0) _WaveA("Wave A",Vector)=(.47,.29,.045,0) _WaveB("Wave B",Vector)=(-.21,.53,.025,0) _Decode("Decode exponent",Float)=2.2 _Unlit("Albedo reference",Float)=0
 _DirtMap("Raw sRGB soil",2D)="white"{} _DirtParams("Tile m / mix / cos / sin",Vector)=(2,.35,.8660254,.5) _DirtOffset("Soil second UV offset",Vector)=(.19,.43,0,0) _DirtWeight("Painted soil amount",Range(0,1))=0 _VertexDirt("Use vertex red soil amount",Float)=0 }
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"}
  Pass {
   Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile_fragment _ _SHADOWS_SOFT
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   TEXTURE2D(_GroundMap);SAMPLER(sampler_GroundMap);
   TEXTURE2D(_DirtMap);SAMPLER(sampler_DirtMap);
   CBUFFER_START(UnityPerMaterial)
    float4 _GroundParams,_GroundOffset,_EditorZero,_WaveA,_WaveB,_DirtParams,_DirtOffset;float _Decode,_Unlit,_DirtWeight,_VertexDirt;
   CBUFFER_END
   struct Varyings {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;half3 normalWS:TEXCOORD1;float dirt:TEXCOORD2;};
   Varyings Vert(float4 p:POSITION,float3 n:NORMAL,float4 color:COLOR){Varyings o;VertexPositionInputs v=GetVertexPositionInputs(p.xyz);o.positionCS=v.positionCS;o.positionWS=v.positionWS;o.normalWS=TransformObjectToWorldNormal(n);o.dirt=lerp(_DirtWeight,color.r,_VertexDirt);return o;}
   float Hash21(float2 p){p=frac(p*float2(123.34,456.21));p+=dot(p,p+45.32);return frac(p.x*p.y);}
   float ValueNoise(float2 p){float2 i=floor(p),f=frac(p);f=f*f*(3-2*f);return lerp(lerp(Hash21(i),Hash21(i+float2(1,0)),f.x),lerp(Hash21(i+float2(0,1)),Hash21(i+float2(1,1)),f.x),f.y);}
   float SoilWeight(float2 p,float paint){float a=.5,s=0;p=p*1.6+5;for(int i=0;i<4;i++){s+=a*ValueNoise(p);p=p*2.03+17.1;a*=.5;}return smoothstep(.2,.55,paint+(s-.5)*.35);}
   float3 Dirt(float2 p){float2 uv=p/_DirtParams.x;float2 q=float2(uv.x*_DirtParams.z-uv.y*_DirtParams.w,uv.x*_DirtParams.w+uv.y*_DirtParams.z)+_DirtOffset.xy;return lerp(SAMPLE_TEXTURE2D(_DirtMap,sampler_DirtMap,uv).rgb,SAMPLE_TEXTURE2D(_DirtMap,sampler_DirtMap,q).rgb,_DirtParams.y)*(1+.022*sin(dot(p,float2(.47,.29)))+.014*sin(dot(p,float2(-.21,.53))));}
   float3 Grass(float2 p){
    float2 uv=p/_GroundParams.x;
    float2 q=float2(uv.x*_GroundParams.z-uv.y*_GroundParams.w,uv.x*_GroundParams.w+uv.y*_GroundParams.z)+_GroundOffset.xy;
    float3 c=SAMPLE_TEXTURE2D(_GroundMap,sampler_GroundMap,uv).rgb;
    if(_GroundParams.y>0)c=lerp(c,SAMPLE_TEXTURE2D(_GroundMap,sampler_GroundMap,q).rgb,_GroundParams.y);
    c*=1+_WaveA.z*sin(dot(p,_WaveA.xy))+_WaveB.z*sin(dot(p,_WaveB.xy));
    return c;
   }
   half4 Frag(Varyings i):SV_Target{
    float2 p=float2(i.positionWS.x-_EditorZero.x,_EditorZero.y-i.positionWS.z);half3 c=pow(lerp(Grass(p),Dirt(p),SoilWeight(p,i.dirt)),_Decode);
    if(_Unlit>.5)return half4(c,1);
    InputData input=(InputData)0;input.positionWS=i.positionWS;input.shadowCoord=TransformWorldToShadowCoord(i.positionWS);input.normalWS=normalize(i.normalWS);input.viewDirectionWS=GetWorldSpaceNormalizeViewDir(i.positionWS);input.bakedGI=SampleSH(input.normalWS);input.shadowMask=half4(1,1,1,1);input.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.positionCS);
    SurfaceData surface=(SurfaceData)0;surface.albedo=c;surface.metallic=0;surface.specular=half3(.04,.04,.04);surface.smoothness=.08;surface.normalTS=half3(0,0,1);surface.occlusion=1;surface.alpha=1;
    return UniversalFragmentPBR(input,surface);
   }
   ENDHLSL
  }
 }
 Fallback Off
}
