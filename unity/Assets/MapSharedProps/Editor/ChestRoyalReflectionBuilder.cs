using System.IO;using UnityEngine;using UnityEditor;
// Immutable, shared material-local reflection source. Never changes scene lighting or probes.
namespace MapSharedProps.EditorTools {
public static class ChestRoyalReflectionBuilder {
 static float Bell(float x,float centre,float width){return Mathf.Exp(-Mathf.Pow((x-centre)/width,4));}
 public static void Configure(Material material){material.SetFloat("_RoyalPBR",1);material.SetFloat("_RoyalArtReflection",1);material.SetTexture("_RoyalReflection",Get());}
 public static Cubemap Get(){
  if(!AssetDatabase.IsValidFolder(SharedImportCache.Root))AssetDatabase.CreateFolder("Assets","MapSharedAssetCache");
  const string path=SharedImportCache.Root+"/royal-reflection-v1.asset";
  var cube=AssetDatabase.LoadAssetAtPath<Cubemap>(path);
  if(!cube){if(File.Exists(path)||File.Exists(path+".meta"))throw new IOException("Reflection cache path is occupied");const int size=128;cube=new Cubemap(size,TextureFormat.RGBAHalf,true);cube.name="Shared gold studio reflection";
   for(int f=0;f<6;f++){var pixels=new Color[size*size];for(int y=0;y<size;y++)for(int x=0;x<size;x++){float u=(x+.5f)/size*2-1,v=(y+.5f)/size*2-1;Vector3 d=f==0?new Vector3(1,-v,-u):f==1?new Vector3(-1,-v,u):f==2?new Vector3(u,1,v):f==3?new Vector3(u,-1,-v):f==4?new Vector3(u,-v,1):new Vector3(-u,-v,-1);d.Normalize();float phi=Mathf.Atan2(d.x,-d.z),elevation=Mathf.Asin(d.y);
    float front=(Bell(phi,-.95f,.48f)+.7f*Bell(phi,.35f,.40f))*Bell(elevation,-.10f,.85f);
    float top=Bell(phi,-2.60f,.85f)*Bell(elevation,.62f,.35f),side=Bell(phi,1.6f,.38f)*Bell(elevation,.2f,.95f);
    float value=.04f+.08f*Mathf.SmoothStep(0,1,(d.y+.35f)/1.15f)+1.3f*front*(1-.88f*Bell(phi,-.62f,.14f))+.60f*top+1.1f*side;pixels[y*size+x]=new Color(value,value*.97f,value*.91f,1);
   }cube.SetPixels(pixels,(CubemapFace)f);}cube.filterMode=FilterMode.Trilinear;cube.wrapMode=TextureWrapMode.Clamp;cube.Apply(true,true);AssetDatabase.CreateAsset(cube,path);}
  return cube;
 }
}

}
