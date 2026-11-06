// Forward pass declarations derived from URP 17.5 Lit.shader.
// Copyright (c) 2020 Unity Technologies ApS. Unity Companion License for Unity-dependent projects:
// https://unity.com/legal/licenses/unity-companion-license
// Provided AS IS, without warranty. Package lighting includes remain unmodified.
// URP 17.5 Lit forward pass wrapper: only albedo/roughness aging; lighting remains package-owned.
Shader "MapRuins/AgedLimestone"
{
    Properties
    {
        
        // Specular vs Metallic workflow
        _WorkflowMode("WorkflowMode", Float) = 1.0

        [MainTexture] _BaseMap("Albedo", 2D) = "white" {}
        [MainColor] _BaseColor("Color", Color) = (1,1,1,1)

        _Cutoff("Alpha Cutoff", Range(0.0, 1.0)) = 0.5

        _Smoothness("Smoothness", Range(0.0, 1.0)) = 0.5
        _SmoothnessTextureChannel("Smoothness texture channel", Float) = 0

        _Metallic("Metallic", Range(0.0, 1.0)) = 0.0
        _MetallicGlossMap("Metallic", 2D) = "white" {}

        _SpecColor("Specular", Color) = (0.2, 0.2, 0.2)
        _SpecGlossMap("Specular", 2D) = "white" {}

        [ToggleOff] _SpecularHighlights("Specular Highlights", Float) = 1.0
        [ToggleOff] _EnvironmentReflections("Environment Reflections", Float) = 1.0

        _BumpScale("Scale", Float) = 1.0
        _BumpMap("Normal Map", 2D) = "bump" {}

        _Parallax("Scale", Range(0.005, 0.08)) = 0.005
        _ParallaxMap("Height Map", 2D) = "black" {}

        _OcclusionStrength("Strength", Range(0.0, 1.0)) = 1.0
        _OcclusionMap("Occlusion", 2D) = "white" {}

        [HDR] _EmissionColor("Color", Color) = (0,0,0)
        _EmissionMap("Emission", 2D) = "white" {}

        _DetailMask("Detail Mask", 2D) = "white" {}
        _DetailAlbedoMapScale("Scale", Range(0.0, 2.0)) = 1.0
        _DetailAlbedoMap("Detail Albedo x2", 2D) = "linearGrey" {}
        _DetailNormalMapScale("Scale", Range(0.0, 2.0)) = 1.0
        [Normal] _DetailNormalMap("Normal Map", 2D) = "bump" {}

        // SRP batching compatibility for Clear Coat (Not used in Lit)
        [HideInInspector] _ClearCoatMask("_ClearCoatMask", Float) = 0.0
        [HideInInspector] _ClearCoatSmoothness("_ClearCoatSmoothness", Float) = 0.0

        // Blending state
        _Surface("__surface", Float) = 0.0
        _Blend("__blend", Float) = 0.0
        _Cull("__cull", Float) = 2.0
        [ToggleUI] _AlphaClip("__clip", Float) = 0.0
        [HideInInspector] _SrcBlend("__src", Float) = 1.0
        [HideInInspector] _DstBlend("__dst", Float) = 0.0
        [HideInInspector] _SrcBlendAlpha("__srcA", Float) = 1.0
        [HideInInspector] _DstBlendAlpha("__dstA", Float) = 0.0
        [HideInInspector] _ZWrite("__zw", Float) = 1.0
        [HideInInspector] _BlendModePreserveSpecular("_BlendModePreserveSpecular", Float) = 1.0
        [HideInInspector] _AlphaToMask("__alphaToMask", Float) = 0.0
        [HideInInspector] _AddPrecomputedVelocity("_AddPrecomputedVelocity", Float) = 0.0
        [HideInInspector] _XRMotionVectorsPass("_XRMotionVectorsPass", Float) = 1.0

        [ToggleUI] _ReceiveShadows("Receive Shadows", Float) = 1.0
        // Editmode props
        _QueueOffset("Queue offset", Float) = 0.0

        // ObsoleteProperties
        [HideInInspector] _MainTex("BaseMap", 2D) = "white" {}
        [HideInInspector] _Color("Base Color", Color) = (1, 1, 1, 1)
        [HideInInspector] _GlossMapScale("Smoothness", Float) = 0.0
        [HideInInspector] _Glossiness("Smoothness", Float) = 0.0
        [HideInInspector] _GlossyReflections("EnvironmentReflections", Float) = 0.0

        [HideInInspector][NoScaleOffset]unity_Lightmaps("unity_Lightmaps", 2DArray) = "" {}
        [HideInInspector][NoScaleOffset]unity_LightmapsInd("unity_LightmapsInd", 2DArray) = "" {}
        [HideInInspector][NoScaleOffset]unity_ShadowMasks("unity_ShadowMasks", 2DArray) = "" {}
    }

    SubShader
    {
        // Universal Pipeline tag is required. If Universal render pipeline is not set in the graphics settings
        // this Subshader will fail. One can add a subshader below or fallback to Standard built-in to make this
        // material work with both Universal Render Pipeline and Builtin Unity Pipeline
        Tags
        {
            "RenderType" = "Opaque"
            "RenderPipeline" = "UniversalPipeline"
            "UniversalMaterialType" = "Lit"
            "IgnoreProjector" = "True"
        }
        LOD 300

        // ------------------------------------------------------------------
        //  Forward pass. Shades all light in a single pass. GI + emission + Fog
        Pass
        {
            // Lightmode matches the ShaderPassName set in UniversalRenderPipeline.cs. SRPDefaultUnlit and passes with
            // no LightMode tag are also rendered by Universal Render Pipeline
            Name "ForwardLit"
            Tags
            {
                "LightMode" = "UniversalForwardOnly"
            }

            // -------------------------------------
            // Render State Commands
            Blend[_SrcBlend][_DstBlend], [_SrcBlendAlpha][_DstBlendAlpha]
            ZWrite[_ZWrite]
            Cull[_Cull]
            AlphaToMask[_AlphaToMask]

            HLSLPROGRAM
            #pragma target 3.0

            // -------------------------------------
            // Shader Stages
            #pragma vertex LitPassVertex
            #pragma fragment LitPassFragment

            // -------------------------------------
            // Material Keywords
            #pragma shader_feature_local _NORMALMAP
            #pragma shader_feature_local _RUINS_DETAIL_V3
            #pragma shader_feature_local _RUINS_ORNAMENT
            #pragma shader_feature_local _PARALLAXMAP
            #pragma shader_feature_local _RECEIVE_SHADOWS_OFF
            #pragma shader_feature_local _ _DETAIL_MULX2 _DETAIL_SCALED
            #pragma shader_feature_local_fragment _SURFACE_TYPE_TRANSPARENT
            #pragma shader_feature_local_fragment _ALPHATEST_ON
            #pragma shader_feature_local_fragment _ _ALPHAPREMULTIPLY_ON _ALPHAMODULATE_ON
            #pragma shader_feature_local_fragment _EMISSION
            #pragma shader_feature_local_fragment _METALLICSPECGLOSSMAP
            #pragma shader_feature_local_fragment _SMOOTHNESS_TEXTURE_ALBEDO_CHANNEL_A
            #pragma shader_feature_local_fragment _OCCLUSIONMAP
            #pragma shader_feature_local_fragment _SPECULARHIGHLIGHTS_OFF
            #pragma shader_feature_local_fragment _ENVIRONMENTREFLECTIONS_OFF
            #pragma shader_feature_local_fragment _SPECULAR_SETUP

            // -------------------------------------
            // Universal Pipeline keywords
#if defined(UNITY_PLATFORM_META_QUEST)
            #pragma multi_compile _ META_QUEST_LIGHTUNROLL
#endif
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile _ EVALUATE_SH_MIXED EVALUATE_SH_VERTEX
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BOX_PROJECTION
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_ATLAS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_fragment _ _SCREEN_SPACE_IRRADIANCE
            #pragma multi_compile_fragment _ _DBUFFER_MRT1 _DBUFFER_MRT2 _DBUFFER_MRT3
            #pragma multi_compile_fragment _ _LIGHT_COOKIES
            #pragma multi_compile _ _LIGHT_LAYERS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
#if defined(UNITY_PLATFORM_META_QUEST)
            #pragma multi_compile _ META_QUEST_ORTHO_PROJ
            #pragma multi_compile _ META_QUEST_NO_SPOTLIGHTS_LIGHT_LOOP
#endif
            #include_with_pragmas "Packages/com.unity.render-pipelines.core/ShaderLibrary/FoveatedRenderingKeywords.hlsl"
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/RenderingLayers.hlsl"


            // -------------------------------------
            // Unity defined keywords
            #pragma multi_compile _ LIGHTMAP_SHADOW_MIXING
            #pragma multi_compile _ SHADOWS_SHADOWMASK
            #pragma multi_compile _ DIRLIGHTMAP_COMBINED
            #pragma multi_compile _ LIGHTMAP_ON
            #pragma multi_compile_fragment _ LIGHTMAP_BICUBIC_SAMPLING
            #pragma multi_compile_fragment _ REFLECTION_PROBE_ROTATION
            #pragma multi_compile _ DYNAMICLIGHTMAP_ON
            #pragma multi_compile _ USE_LEGACY_LIGHTMAPS
            #pragma multi_compile _ LOD_FADE_CROSSFADE
            #pragma multi_compile_fragment _ DEBUG_DISPLAY
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/ProbeVolumeVariants.hlsl"

            //--------------------------------------
            // GPU Instancing
            #pragma multi_compile_instancing
            #pragma instancing_options renderinglayer
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DOTS.hlsl"

            #include "Packages/com.unity.render-pipelines.universal/Shaders/LitInput.hlsl"

float ageHash(float2 p){return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453);}
float ageNoise(float2 p){float2 i=floor(p),f=frac(p);f=f*f*(3.0-2.0*f);return lerp(lerp(ageHash(i),ageHash(i+float2(1,0)),f.x),lerp(ageHash(i+float2(0,1)),ageHash(i+float2(1,1)),f.x),f.y);}
float3 ageMasks(float3 world,float height,float3 normal){
 float horizontal=world.x+world.z*.731;
 float agingPatch=ageNoise(world.xz*1.35+float2(17,31));
 float broad=ageNoise(float2(horizontal*.65,height*.67)+float2(4,19));
 float vertical=1.0-smoothstep(.25,.82,abs(normal.y));
 float ground=(1.0-smoothstep(.04,.5+agingPatch*.5,height))*(.42+.58*agingPatch);

 #if defined(_RUINS_DETAIL_V3)
 float catchment=smoothstep(.24,.68,broad);
 #else
 float catchment=.28+.72*broad;
 #endif
 #if defined(_RUINS_DETAIL_V3)
 // Break long parallel staining into deposits with interrupted runoff paths.
 float streak=smoothstep(.53,.78,ageNoise(float2(horizontal*3.0+broad*2.0,height*1.13)+float2(6,23)))*vertical*catchment*smoothstep(.12,.65,height);
 #else
 float streak=smoothstep(.39,.68,ageNoise(float2(horizontal*5.2,height*.32)+float2(6,23)))*vertical*catchment*smoothstep(.12,.65,height);
 #endif
 float dust=smoothstep(.3,.9,normal.y)*smoothstep(.35,.8,agingPatch)*.32;
 return float3(ground,streak,dust);
}

// Shared engraved limestone motifs. Coordinates are metres within the part.
// Kept identical in GLSL and HLSL; no emission, extra texture or geometry.
// Shared engraved limestone motifs. Coordinates are metres within the part.
// Kept identical in GLSL and HLSL; no emission, extra texture or geometry.
float ornLine(float d,float w){return 1.0-smoothstep(w,w+.012,abs(d));}
float ornDiamond(float2 p,float2 size){return ornLine((abs(p.x)/size.x+abs(p.y)/size.y-1.0)*min(size.x,size.y),.018);}
float ornWrap(float x,float y){return x-y*floor(x/y);}
float ornPattern(float2 p,float kind){
 float a=0.0;
 if(kind<.5){
  // A broad sunken lozenge panel, not hairline ornament. Two metre bays.
  float u=fmod(p.x,2.0)-1.0;
  float d=abs(u)/.57+abs(p.y-1.34)/.39;
  float outer=1.0-smoothstep(.90,1.08,d);
  float inner=1.0-smoothstep(.56,.72,d);
  a=outer*(1.0-.68*inner);
  // Broad recessed framing; leave plain masonry between medallions.
  float band=max(1.0-smoothstep(.028,.078,abs(p.y-.77)),1.0-smoothstep(.028,.078,abs(p.y-1.92)));
  a=max(a,.70*band);
 }else if(kind<1.5){
  float u=p.x-.5;
  float frame=(1.0-smoothstep(.22,.26,abs(u)))*smoothstep(.42,.48,p.y)*(1.0-smoothstep(2.43,2.49,p.y));
  a=max(ornLine(abs(u)-.20,.015)*frame,ornDiamond(float2(u,p.y-1.72),float2(.14,.25)));
  a=max(a,ornLine(length(float2(u,(p.y-2.75)*1.25))-.10,.018));
  a=max(a,max(ornLine(p.y-.23,.018),ornLine(p.y-2.89,.018)));
  a=max(a,ornLine(p.y-.51,.014)*(1.0-smoothstep(.20,.23,abs(u))));
 }else if(kind<2.5){
  // Broad worn archivolt recess follows individual voussoirs; intact stone margins remain.
  float2 q=float2(p.x-2.0,p.y-2.0);float radius=length(q);
  float theta=atan2(q.y,q.x),cell=theta*11.0/3.14159265;
  float centre=floor(cell)+.5,edge=abs(frac(cell)-.5);
  float wear=.5+.5*sin(centre*2.17+.8);
  float lip=.018+.022*wear;
  float panel=smoothstep(1.055+lip,1.085+lip,radius)*(1.0-smoothstep(1.255-lip,1.29-lip,radius));
  float joint=1.0-smoothstep(.29,.46,edge);
  float lost=smoothstep(.50,.91,.5+.5*sin(theta*3.7+.65)*sin(radius*15.0+theta));
  a=panel*(.72+.28*joint)*(.20+.80*(1.0-lost))*smoothstep(1.98,2.04,p.y);
  // Worn impost band, with protected centre retained instead of a razor-thin scratch.
  float post=1.0-smoothstep(.24,.34,abs(abs(p.x-2.0)-1.53));
  a=max(a,(1.0-smoothstep(.035,.075,abs(p.y-1.73)))*post*.65);
  a=max(a,ornDiamond(float2(p.x-2.0,p.y-3.18),float2(.105,.11))*.65);
 }else if(kind<3.5){
  float2 q=abs(p-float2(1.0,1.0));float edge=max(q.x,q.y);
  a=max(ornLine(edge-.80,.019),ornLine(edge-.68,.014));
  a=max(a,ornDiamond(p-float2(1.0,1.0),float2(.39,.39)));
  a=max(a,ornLine(length(p-float2(1.0,1.0))-.14,.016));
  // Deliberately open central stone between the medallion and border.
 }else if(kind<4.5){
  // Narrow junctions carry the same horizontal bands around their exposed sides.
  a=.70*max(1.0-smoothstep(.028,.078,abs(p.y-.77)),1.0-smoothstep(.028,.078,abs(p.y-1.92)));
 }else if(kind<5.5){
  // Broad worn riser inset; no raised detail on the walk surface.
  float u=fmod(p.x,1.0)-.5;
  float d=abs(u)/.32+abs(p.y-.48)/.34;
  a=(1.0-smoothstep(.80,1.08,d))*(1.0-.55*(1.0-smoothstep(.33,.55,d)));
 }else if(kind<6.5){
  // Ascending side frieze stays below the tread line.
  a=.85*(1.0-smoothstep(.035,.095,abs(p.y-p.x+.23)));
 }else if(kind<7.5){
  // Tread-side borders leave the centre and worn nosing readable.
  a=.80*(1.0-smoothstep(.025,.080,abs(abs(p.x-1.0)-.79)));
 }
 else if(kind<9.5){
  // Separate base/capital share a worn stone frieze, not attached metal trim.
  float u=fmod(p.x,1.0)-.5;float centre=kind<8.5?.30:.73;
  float d=abs(u)/.28+abs(p.y-centre)/.16;
  a=max((1.0-smoothstep(.78,1.08,d))*(1.0-.60*(1.0-smoothstep(.35,.55,d))),.7*ornLine(p.y-(kind<8.5?.48:.54),.026));
 }else if(kind<10.5){
  float u=p.x-.5;
  float frame=smoothstep(.12,.20,p.y)*(1.0-smoothstep(2.02,2.12,p.y));
  a=max(ornLine(abs(u)-.20,.018)*frame,ornDiamond(float2(u,p.y-1.35),float2(.15,.30)));
 }
 else if(kind<11.5){
  // Exposed top perimeter only: the central shaft-bearing square remains uncarved.
  float2 q=abs(p-float2(.5,.5));float edge=max(q.x,q.y);
  a=.85*ornLine(edge-.365,.018);
  a=max(a,.65*ornLine(edge-.415,.012));
  float corner=ornDiamond(q-float2(.335,.335),float2(.055,.055));
  a=max(a,corner*smoothstep(.30,.325,edge));
 }
 else if(kind<12.5){
  // Original stone UVs are retained. Upper masonry courses carry worn insets.
  float u=ornWrap(p.x,1.0)-.5,v=ornWrap(p.y,.5)-.25;
  float d=abs(u)/.34+abs(v)/.16;
  a=(1.0-smoothstep(.78,1.10,d))*(1.0-.63*(1.0-smoothstep(.30,.56,d)));
  a=max(a,.60*ornLine(abs(v)-.19,.020));
 }else if(kind<13.5){
  // Low independent edge: a continuous recessed band with spaced stone keys.
  float u=ornWrap(p.x,2.0)-1.0,v=ornWrap(p.y,.5);
  a=.8*ornLine(v-.15,.028);
  a=max(a,ornDiamond(float2(u,v-.15),float2(.16,.09)));
 }else if(kind<14.5){
  // Top of low edge, physically unchanged. Avoid a confusing dark walking stripe.
  float v=ornWrap(p.y+.25,.5);
  a=.65*max(ornLine(v-.10,.018),ornLine(v-.40,.018));
  float u=ornWrap(p.x,2.0)-1.0;
  a=max(a,ornDiamond(float2(u,v-.25),float2(.20,.10)));
 }
 else if(kind<15.5){
  // L-shaped top border: match straight strips at both exact joint faces.
  float d=min(p.x,p.y);
  a=.65*max(ornLine(d+.15,.018),ornLine(d-.15,.018));
 }else if(kind<16.5){
  // Closing U border on the short end cap, open at the joining face.
  a=.65*ornLine(max(p.x,abs(p.y))-.15,.018);
  }else{
  // Rectangular portal: framing belongs to the jambs and lintel, not the void.
  // Broken openings retain only the surviving jamb portions of this carving.
  float ax=abs(p.x), jamb=smoothstep(.16,.30,p.y)*(1.0-smoothstep(2.55,2.72,p.y));
  a=.80*max(ornLine(ax-1.13,.034),.55*ornLine(ax-1.37,.020))*jamb;
  a=max(a,ornDiamond(float2(ax-1.30,p.y-1.40),float2(.20,.34)));
  float lintel=1.0-smoothstep(.95,1.05,ax);
  a=max(a,.8*ornLine(p.y-2.84,.032)*lintel);
  a=max(a,ornDiamond(float2(p.x,p.y-2.85),float2(.28,.10))*lintel);
 }
 // Loss is broad and selective, not an identical distressed outline everywhere.
 float weather=.5+.5*sin(p.x*7.1+kind*2.3)*sin(p.y*4.9+kind*.7);
 float survival=(kind<.5||kind>3.5)?(.65+.35*smoothstep(.13,.48,weather)):smoothstep(.13,.48,weather);
 return a*survival;
}
float ornDepth(float kind){return kind>1.5&&kind<2.5?.014:kind>11.5&&kind<12.5?.045:kind>12.5?.030:kind<.5|| (kind>3.5&&kind<4.5)?.045:kind>7.5?.018:kind>4.5?.032:.008;}
float ornHeight(float2 uv){float2 q=uv*4.0;float kind=floor(q.y/64.0);return -ornDepth(kind)*ornPattern(float2(q.x+128.0,q.y-kind*64.0-16.0),kind);}
float3 ornRelief(float2 uv){if(uv.x> -24.0)return float3(0.0,0.0,0.0);float e=.002;
 float h=ornHeight(uv),dx=(ornHeight(uv+float2(e,0.0))-ornHeight(uv-float2(e,0.0)))/(.016),dy=(ornHeight(uv+float2(0.0,e))-ornHeight(uv-float2(0.0,e)))/(.016);
 return float3(-dx,-dy,clamp(-h/ornDepth(floor(uv.y*4.0/64.0)),0.0,1.0));}

// Sample the interior of an existing limestone block for a carved panel.
// Avoid painting extra mortar joints across a single physical slab.
float2 ornStoneUV(float2 uv){if(uv.x> -24.0)return uv;float2 q=uv*4.0;
 // Each arch stone samples a different intact patch of the shared limestone atlas.
 // Boundaries follow the eleven existing voussoirs, never screen position.
 float ornKind=floor(q.y/64.0);
 if(ornKind>1.5&&ornKind<2.5){
  float2 p=float2(q.x+128.0,q.y-ornKind*64.0-16.0),v=p-float2(2.0,2.0);
  float radius=length(v);
  if(p.y>=2.0&&radius>=.99&&radius<=1.37){
   float cell=atan2(v.y,v.x)*11.0/3.14159265,part=floor(min(cell,10.999));
   float row=ornWrap(part*3.0+2.0,8.0),offset=.13,start=0.0,end=.91;
   if(row<.5){offset=0.0;end=.84;}else if(row<1.5){offset=.46;end=1.13;}
   else if(row<2.5){offset=.13;end=.91;}else if(row<3.5){offset=.61;end=1.04;}
   else if(row<4.5){offset=.25;end=.77;}else if(row<5.5){offset=.74;end=1.16;}
   else if(row<6.5){offset=.08;end=.90;}else{offset=.52;end=.82;}
   float top=row<.5?0.0:row<1.5?.5:row<2.5?1.01:row<3.5?1.5:row<4.5?1.99:row<5.5?2.5:row<6.5?3.01:3.5;
   float along=clamp(frac(cell),0.0,1.0),across=clamp((radius-1.0)/.36,0.0,1.0);
   if(ornWrap(part,2.0)>.5)along=1.0-along;
   return float2(-offset+.055+along*(end-.11),top+.055+across*.39)*.25;
  }
 }

 if(q.y>=12.0*64.0+16.0){float kind=floor(q.y/64.0);return float2(q.x+128.0,q.y-kind*64.0-16.0)*.25;}
 float2 t=abs(frac(q*float2(.37,.61))*2.0-1.0);
 return (float2(.63,2.06)+t*float2(.75,.34))*.25;}

void RuinsAgedSurface(float2 uv,float3 world,float3 normal,out SurfaceData surface){
 #if defined(_RUINS_DETAIL_V3)
 // UV is authored against the common masonry course layout; no per-object drift.
 #endif
 #if defined(_RUINS_ORNAMENT)
 InitializeStandardLitSurfaceData(ornStoneUV(uv),surface);
 #else
 InitializeStandardLitSurfaceData(uv,surface);
 #endif
 #if defined(_RUINS_ORNAMENT)
 float3 relief=ornRelief(uv);surface.albedo*=lerp(1.0,.72,relief.z);surface.normalTS=normalize(float3(surface.normalTS.xy+relief.xy,surface.normalTS.z));
 #endif
 float h=TransformWorldToObject(world).y;
 float3 masks=ageMasks(float3(world.x,world.y,-world.z),h,normal);
 #if defined(_RUINS_DETAIL_V3)
 float3 agingWorld=float3(world.x,world.y,-world.z);
 float mineral=ageNoise(agingWorld.xz*.57+float2(h*.31,h*.19)+float2(43,7));
 surface.albedo*=lerp(float3(.93,.94,.96),float3(1.06,1.035,1.0),mineral);
 #endif
 surface.albedo*=lerp(float3(1,1,1),float3(.53,.46,.35),masks.x);
 #if defined(_RUINS_DETAIL_V3)
 surface.albedo*=lerp(float3(1,1,1),float3(.60,.54,.43),masks.y*.55);
 #else
 surface.albedo*=lerp(float3(1,1,1),float3(.60,.54,.43),masks.y*.85);
 #endif
 surface.albedo=lerp(surface.albedo,surface.albedo*float3(1.04,.96,.82),masks.z);
 surface.smoothness=1-clamp(1-surface.smoothness-masks.x*.10+masks.y*.06+masks.z*.12,.62,.98);
}
#define InitializeStandardLitSurfaceData(uv,surface) RuinsAgedSurface(uv,input.positionWS,normalize(input.normalWS),surface)
#define REQUIRES_WORLD_SPACE_POS_INTERPOLATOR

            #include "Packages/com.unity.render-pipelines.universal/Shaders/LitForwardPass.hlsl"
            ENDHLSL
        }

        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
        UsePass "Universal Render Pipeline/Lit/DepthNormals"
    }
    FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
