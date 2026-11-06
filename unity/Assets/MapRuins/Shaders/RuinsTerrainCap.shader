// Bind terrain engine properties as persistent mesh material properties. Lighting is URP 17.5 Terrain/Lit.
Shader "MapRuins/TerrainCap" {
 Properties {
  [HideInInspector] _Control_TexelSize("Control texel size",Vector)=(1,1,1,1)
  [HideInInspector] _Control("Weights",2D)="red" {}
  [HideInInspector] _NumLayersCount("Layer count",Float)=1
  [HideInInspector] _HeightTransition("Height transition",Float)=0
  [HideInInspector] _TerrainBasemapDistance("Basemap distance",Float)=100000
  [HideInInspector] _EnableInstancedPerPixelNormal("Instanced normals",Float)=0
  [HideInInspector] _TerrainHolesTexture("Holes",2D)="white" {}
  [HideInInspector] _Splat0("Layer 0",2D)="white" {}
  [HideInInspector] _Normal0("Normal 0",2D)="bump" {}
  [HideInInspector] _Mask0("Mask 0",2D)="grey" {}
  [HideInInspector] _NormalScale0("NormalScale 0",Float)=1
  [HideInInspector] _Metallic0("Metallic 0",Float)=0
  [HideInInspector] _Smoothness0("Smoothness 0",Float)=.5
  [HideInInspector] _LayerHasMask0("LayerHasMask 0",Float)=0
  [HideInInspector] _SmoothnessSource0("SmoothnessSource 0",Float)=2
  [HideInInspector] _DiffuseHasAlpha0("DiffuseHasAlpha 0",Float)=1
  [HideInInspector] _DiffuseRemapScale0("DiffuseRemapScale 0",Vector)=(1,1,1,1)
  [HideInInspector] _MaskMapRemapOffset0("MaskMapRemapOffset 0",Vector)=(0,0,0,0)
  [HideInInspector] _MaskMapRemapScale0("MaskMapRemapScale 0",Vector)=(1,1,1,1)
  [HideInInspector] _Splat1("Layer 1",2D)="white" {}
  [HideInInspector] _Normal1("Normal 1",2D)="bump" {}
  [HideInInspector] _Mask1("Mask 1",2D)="grey" {}
  [HideInInspector] _NormalScale1("NormalScale 1",Float)=1
  [HideInInspector] _Metallic1("Metallic 1",Float)=0
  [HideInInspector] _Smoothness1("Smoothness 1",Float)=.5
  [HideInInspector] _LayerHasMask1("LayerHasMask 1",Float)=0
  [HideInInspector] _SmoothnessSource1("SmoothnessSource 1",Float)=2
  [HideInInspector] _DiffuseHasAlpha1("DiffuseHasAlpha 1",Float)=1
  [HideInInspector] _DiffuseRemapScale1("DiffuseRemapScale 1",Vector)=(1,1,1,1)
  [HideInInspector] _MaskMapRemapOffset1("MaskMapRemapOffset 1",Vector)=(0,0,0,0)
  [HideInInspector] _MaskMapRemapScale1("MaskMapRemapScale 1",Vector)=(1,1,1,1)
  [HideInInspector] _Splat2("Layer 2",2D)="white" {}
  [HideInInspector] _Normal2("Normal 2",2D)="bump" {}
  [HideInInspector] _Mask2("Mask 2",2D)="grey" {}
  [HideInInspector] _NormalScale2("NormalScale 2",Float)=1
  [HideInInspector] _Metallic2("Metallic 2",Float)=0
  [HideInInspector] _Smoothness2("Smoothness 2",Float)=.5
  [HideInInspector] _LayerHasMask2("LayerHasMask 2",Float)=0
  [HideInInspector] _SmoothnessSource2("SmoothnessSource 2",Float)=2
  [HideInInspector] _DiffuseHasAlpha2("DiffuseHasAlpha 2",Float)=1
  [HideInInspector] _DiffuseRemapScale2("DiffuseRemapScale 2",Vector)=(1,1,1,1)
  [HideInInspector] _MaskMapRemapOffset2("MaskMapRemapOffset 2",Vector)=(0,0,0,0)
  [HideInInspector] _MaskMapRemapScale2("MaskMapRemapScale 2",Vector)=(1,1,1,1)
  [HideInInspector] _Splat3("Layer 3",2D)="white" {}
  [HideInInspector] _Normal3("Normal 3",2D)="bump" {}
  [HideInInspector] _Mask3("Mask 3",2D)="grey" {}
  [HideInInspector] _NormalScale3("NormalScale 3",Float)=1
  [HideInInspector] _Metallic3("Metallic 3",Float)=0
  [HideInInspector] _Smoothness3("Smoothness 3",Float)=.5
  [HideInInspector] _LayerHasMask3("LayerHasMask 3",Float)=0
  [HideInInspector] _SmoothnessSource3("SmoothnessSource 3",Float)=2
  [HideInInspector] _DiffuseHasAlpha3("DiffuseHasAlpha 3",Float)=1
  [HideInInspector] _DiffuseRemapScale3("DiffuseRemapScale 3",Vector)=(1,1,1,1)
  [HideInInspector] _MaskMapRemapOffset3("MaskMapRemapOffset 3",Vector)=(0,0,0,0)
  [HideInInspector] _MaskMapRemapScale3("MaskMapRemapScale 3",Vector)=(1,1,1,1)
 }
 SubShader {
 Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "Queue"="Geometry-100"}
  UsePass "Universal Render Pipeline/Terrain/Lit/ForwardLit"
  UsePass "Universal Render Pipeline/Terrain/Lit/GBuffer"
  UsePass "Universal Render Pipeline/Terrain/Lit/ShadowCaster"
  UsePass "Universal Render Pipeline/Terrain/Lit/DepthOnly"
  UsePass "Universal Render Pipeline/Terrain/Lit/DepthNormals"
 }
}
