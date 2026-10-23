Shader "MapWater/Sea"
{
 // マップエディターの海（寄せる波・砕け波・打ち上がり・泡・海底の光の網目・海草の斑点・きらめき・濡れた砂）を、エディターと同じ式で描く。
 // 式は MapSeaShared.hlsl（エディターの sea.js から tools/sea/build-sea-hlsl.cjs で生成。直接は直さない）。
 // この shader は、Unity の座標をエディターの座標（x = Unity x − 地図の半分、z = 地図の半分 − Unity z）に直して、その式を呼ぶだけ。
 // メッシュ（MapWaterBuilder が sea_field.png と heightmap から作る。頂点は地図の原点からの位置、y = 静水の水位）：
 //   uv0 = (水際までの距離 s [m、海が＋], 海の重み 0..1)、uv1 = 岸への向き（エディター座標の x,z）、uv2.x = 静水の水深 [m、陸は負]
 Properties {
  _WaveHeight("Wave height (m) = meta.sea.waves.height",Float)=0.38
  _ShallowColor("Shallow colour (meta.sea.colors.shallow, as given)",Vector)=(0.30,0.92,0.86,0)
  _DeepColor("Deep colour (meta.sea.colors.deep, as given)",Vector)=(0.02,0.36,0.56,0)
  _SunDirection("Toward the sun, Unity world (meta.sea.sunDirection)",Vector)=(-0.6,0.77,0.17,0)
  _MapSize("Map size (m) = meta.terrain.size[0]",Float)=64
  _TimeScale("Time scale",Float)=1
 }
 SubShader {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Transparent" "Queue"="Transparent"}
  Pass {
   Name "Sea"
   Tags {"LightMode"="UniversalForward"}
   Blend SrcAlpha OneMinusSrcAlpha
   ZWrite Off
   Cull Off
   Offset 0, -2   // a few depth steps toward the camera, as the editor: on the beach the sheet lies on the sand and must not flicker against it
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #pragma target 3.5
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   CBUFFER_START(UnityPerMaterial)
    float4 _ShallowColor,_DeepColor,_SunDirection;
    float _WaveHeight,_MapSize,_TimeScale;
   CBUFFER_END
   // the globals the shared code reads (editor frame)
   static float seaTime, seaWaveH;
   static float3 seaSun, seaShallow, seaDeep, seaView;
   #include "MapSeaShared.hlsl"

   struct A { float4 p:POSITION; float2 sh:TEXCOORD0; float2 dir:TEXCOORD1; float2 dep:TEXCOORD2; };
   struct V { float4 p:SV_POSITION; float3 w:TEXCOORD0; float4 sea:TEXCOORD1; float2 dir:TEXCOORD2; float2 pe:TEXCOORD3; };   // sea = (weight, distance to the waterline, still depth, wave height)
   void SetGlobals(){
    seaTime=_Time.y*_TimeScale; seaWaveH=_WaveHeight;
    float3 s=normalize(_SunDirection.xyz); seaSun=float3(s.x,s.y,-s.z);   // editor frame: z flipped
    seaShallow=_ShallowColor.rgb; seaDeep=_DeepColor.rgb; seaView=float3(0.,1.,0.);
   }
   // object space of the generated mesh = map space (origin at the map corner) → the editor's frame (origin at the centre, z flipped)
   float2 EditorXZ(float3 o){ return float2(o.x-_MapSize*.5,_MapSize*.5-o.z); }

   // same as the editor's water vertex shader: the surface rises by the wave height (sea.js seaWave); on the beach the sheet
   // lies just on the sand, so the wet sand it draws is never hidden under it
   V vert(A a){
    SetGlobals();
    V o; float2 pe=EditorXZ(a.p.xyz); float s=a.sh.x, seaW=a.sh.y, depth=a.dep.x, h=0., ph=0., brk=0.;
    if(seaW>.001){
     float2 grad=seaWave(pe,s,depth,a.dir,h,ph,brk); h*=seaW;
     if(depth<0.) h=max(h,-depth+.02);
    }
    o.w=TransformObjectToWorld(a.p.xyz+float3(0.,h,0.)); o.p=TransformWorldToHClip(o.w);
    o.sea=float4(seaW,s,depth,_WaveHeight); o.dir=a.dir; o.pe=pe;
    return o;
   }
   // per pixel, as the editor: the wave is worked out again, and its depth here decides the water's edge,
   // so the edge, the crests and their foam follow smooth curves instead of the mesh's triangles
   half4 frag(V i):SV_Target{
    SetGlobals();
    float3 v=normalize(GetCameraPositionWS()-i.w); seaView=float3(v.x,v.y,-v.z);
    float seaW=i.sea.x, s=i.sea.y, d0=i.sea.z, h=0., ph=0., brk=0.;
    float2 grad=seaWave(i.pe,s,d0,i.dir,h,ph,brk)*seaW; h*=seaW; brk*=seaW;
    float d=d0+h; float4 sv=float4(seaW,brk,s,i.sea.w); float4 c=float4(0.,0.,0.,0.);
    if(d<=0.){ if(seaW<.01) discard; c=wetSand(i.pe,d,d0,sv); }   // above the water: wet sand behind the run-up, else nothing
    else c=seaColor(i.pe,d,d0,sv,float2(cos(ph),sin(ph)),grad,i.dir);
    c.a*=saturate(seaW);   // the sea fades out where its weight does (beach far from the water, lakes)
    return half4(pow(max(c.rgb,float3(0.,0.,0.)),float3(2.2,2.2,2.2)),c.a);   // gamma 2.2 → linear, as the editor does
   }
   ENDHLSL
  }
 }
}
