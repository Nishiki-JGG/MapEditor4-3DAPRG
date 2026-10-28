Shader "MapSharedProps/ChestSanctum" {
 Properties { _BaseMap("Base",2D)="white"{} _BaseColor("Tint",Color)=(1,1,1,1) _Cutoff("Cutoff",Float)=0 _Cull("Cull",Float)=2 _Support("Support",Float)=0 _UseMaps("Maps",Float)=0 _Normal("Relief normal",2D)="bump"{} _Mask("Relief RGA",2D)="white"{} _Relief("Relief",Float)=0 _Crystal("Crystal",Float)=0 _ChestTime("Time",Float)=0 }
 SubShader {Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"}Pass{Tags{"LightMode"="UniversalForwardOnly"}
 HLSLPROGRAM
 #pragma multi_compile_instancing
 #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
 #pragma multi_compile_fragment _ _REFLECTION_PROBE_BOX_PROJECTION
 #pragma vertex Vert
 #pragma fragment Frag
 #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
 #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
 #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
 #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
 #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
 TEXTURE2D(_Normal);SAMPLER(sampler_Normal);TEXTURE2D(_Mask);SAMPLER(sampler_Mask);
 CBUFFER_START(UnityPerMaterial) float4 _BaseColor;float _Relief,_Crystal,_ChestTime,_Support,_UseMaps; CBUFFER_END
 struct A{UNITY_VERTEX_INPUT_INSTANCE_ID float3 positionOS:POSITION;float3 normalOS:NORMAL;float4 tangentOS:TANGENT;float2 uv:TEXCOORD0;};
 struct V{UNITY_VERTEX_INPUT_INSTANCE_ID float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;float3 normalWS:TEXCOORD1;float4 tangentWS:TEXCOORD2;float3 local:TEXCOORD3;float2 uv:TEXCOORD4;};
 V Vert(A a){V o;UNITY_SETUP_INSTANCE_ID(a);UNITY_TRANSFER_INSTANCE_ID(a,o);VertexPositionInputs p=GetVertexPositionInputs(a.positionOS);o.positionCS=p.positionCS;o.positionWS=p.positionWS;o.normalWS=TransformObjectToWorldNormal(a.normalOS);o.tangentWS=float4(TransformObjectToWorldDir(a.tangentOS.xyz),a.tangentOS.w*GetOddNegativeScale());o.local=a.positionOS;o.uv=a.uv;return o;}
 half4 Frag(V i):SV_Target{UNITY_SETUP_INSTANCE_ID(i);float3 p=i.local,n=normalize(i.normalWS),view=GetWorldSpaceNormalizeViewDir(i.positionWS);float ao=1;
 if(_Relief>.5&&_UseMaps>.5){float3 t=normalize(i.tangentWS.xyz),b=cross(n,t)*i.tangentWS.w;float3 normalTS=UnpackNormal(SAMPLE_TEXTURE2D(_Normal,sampler_Normal,i.uv));n=normalize(t*normalTS.x+b*normalTS.y+n*normalTS.z);ao=SAMPLE_TEXTURE2D(_Mask,sampler_Mask,i.uv).g;}
 float phase=p.x*4.5+p.z*2.3+p.y*1.4+(_ChestTime<0?_Time.y:_ChestTime)*.35;float3 spectrum=.5+.5*cos(phase+float3(0,2.094395,4.18879));spectrum=lerp(.035.xxx,1.0.xxx,pow(spectrum,1.65));
 float front=step(.20,p.y)*(1-step(.50,p.y))*(1-step(.43,abs(p.x)))*step(.29,abs(p.z));float lid=step(.602,p.y)*(1-step(.34,abs(p.x)))*(1-step(.33,abs(p.z)));
 float straps=max(1-step(.075,abs(p.x)),1-step(.034,abs(abs(p.x)-.375)));float panel=saturate(max(front,lid)*(1-straps))*(1-_Relief)*(1-_Support);
 float seam=exp(-abs(p.y-.55)*170);float rim=pow(1-saturate(dot(n,view)),3);float facets=.30+.70*abs(dot(n,normalize(float3(.3,.8,-.5))));
 SurfaceData surface=(SurfaceData)0;surface.albedo=lerp(float3(.70,.81,.94),spectrum*.65,panel);surface.metallic=lerp(.9,.65,panel);surface.smoothness=.84;surface.occlusion=ao;surface.alpha=1;surface.normalTS=float3(0,0,1);
 surface.emission=spectrum*(panel*(.8+.20*rim)+seam*.45)*(1-_Relief)+float3(.07,.10,.15)*_Relief*ao;
 if(_Support>.5){surface.albedo=float3(.692,.869,1.);surface.emission=0;}
 if(_Crystal>.5){float3 viewOS=normalize(TransformWorldToObjectDir(view));float2 cutUV=float2(p.x+p.z*.63,p.y*.67-p.z*.54)*18.+viewOS.xy*.55;float2 cutFold=abs(frac(float2(cutUV.x+cutUV.y*.47,cutUV.y-cutUV.x*.39))-.5)*2.;float cut=pow(clamp(1.-max(cutFold.x,cutFold.y)*.82,0.,1.),2.);float edgeDepth=.18+.82*pow(abs(dot(viewOS,normalize(float3(.35,.75,.55)))),2.);float3 internal=lerp(spectrum*float3(.21,.10,.34),spectrum,cut);surface.albedo=internal*(.12+.30*edgeDepth);surface.metallic=.12;surface.smoothness=.955;surface.emission=internal*(.38+1.15*cut)+spectrum*rim*.55;}
 surface.albedo*=_BaseColor.rgb;surface.emission*=_BaseColor.rgb;
 InputData inputData=(InputData)0;inputData.positionWS=i.positionWS;inputData.normalWS=n;inputData.viewDirectionWS=view;inputData.shadowCoord=TransformWorldToShadowCoord(i.positionWS);inputData.bakedGI=SampleSH(n);inputData.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.positionCS);inputData.shadowMask=half4(1,1,1,1);return UniversalFragmentPBR(inputData,surface);}
 ENDHLSL }
 UsePass "Universal Render Pipeline/Lit/ShadowCaster"
 UsePass "Universal Render Pipeline/Lit/DepthOnly"
 }
}
