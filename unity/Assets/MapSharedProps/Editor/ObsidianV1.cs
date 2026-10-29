using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEditor;

namespace MapSharedProps.EditorTools {
// Bounded optional extension. Missing/invalid data must not interrupt the core 43 assets.
public static class ObsidianV1 {
 [Serializable] public class Descriptor { public int version; public SmallPropsV1.Asset asset; }
 static void Require(bool ok,string why){if(!ok)throw new InvalidDataException(why);}
 static bool Finite(float f)=>!float.IsNaN(f)&&!float.IsInfinity(f);
 static void ArrayOf(float[] values,int count){Require(values!=null&&values.Length==count&&values.All(Finite),"array size/nonfinite");}
 public static Descriptor Optional(Descriptor d){
  if(d==null||(d.version==0&&d.asset==null))return null;
  try{Require(d.version==1&&d.asset!=null,"version/asset");var a=d.asset;
   Require(a.id=="obsidian"&&a.assetKey=="tdj/obsidian"&&a.source=="editor-procedural-mesh"&&a.material=="gloss","identity");
   ArrayOf(a.positions,360);ArrayOf(a.normals,360);ArrayOf(a.colors,360);ArrayOf(a.uv,240);ArrayOf(a.glow,120);
   Require(a.triangles!=null&&a.triangles.Length==120&&a.triangles.Distinct().Count()==120&&a.triangles.All(i=>i>=0&&i<120),"40 independent triangles");
   Require(a.positions.All(v=>Mathf.Abs(v)<4)&&a.normals.All(v=>Mathf.Abs(v)<=1.001f)&&a.colors.All(v=>v>=0&&v<=1)&&a.glow.All(v=>v==0),"mesh values");
   Require(Finite(a.radius)&&Mathf.Abs(a.radius-.4f)<.000001f&&Finite(a.height)&&Mathf.Abs(a.height-1.58f)<.000001f&&Finite(a.groundSink)&&Mathf.Abs(a.groundSink-.05f)<.000001f&&a.shape,"placement contract");
   Require(a.light==null||a.light.Length==0,"non-emissive");return d;
  }catch(Exception e)when(e is InvalidDataException||e is NullReferenceException){Debug.LogWarning("Optional obsidian ignored; core assets retained: "+e.Message);return null;}
 }
 // URP/Lit does not read vertex colours. Rasterize the existing linear colours into
 // a small padded per-face atlas, without recolouring or changing mesh geometry.
 static Texture2D ColourAtlas(Mesh mesh){const int size=128,tile=16;var pixels=new Color32[size*size];var uv=new Vector2[mesh.vertexCount];var ix=mesh.triangles;var c=mesh.colors;
  for(int f=0;f<40;f++){int ox=f%8*tile,oy=f/8*tile;int ia=ix[f*3],ib=ix[f*3+1],ic=ix[f*3+2];uv[ia]=new Vector2((ox+2.5f)/size,(oy+2.5f)/size);uv[ib]=new Vector2((ox+13.5f)/size,(oy+2.5f)/size);uv[ic]=new Vector2((ox+2.5f)/size,(oy+13.5f)/size);
   for(int y=0;y<tile;y++)for(int x=0;x<tile;x++){float b=Mathf.Max(0,(x-2f)/11),cc=Mathf.Max(0,(y-2f)/11),sum=b+cc;if(sum>1){b/=sum;cc/=sum;}var colour=c[ia]*(1-b-cc)+c[ib]*b+c[ic]*cc;colour.a=1;pixels[(oy+y)*size+ox+x]=colour.gamma;}}
  mesh.uv=uv;var image=new Texture2D(size,size,TextureFormat.RGBA32,false,false);image.SetPixels32(pixels);image.Apply();var png=image.EncodeToPNG();UnityEngine.Object.DestroyImmediate(image);return SharedImportCache.Image(png,".png",true,true,TextureWrapMode.Clamp,FilterMode.Trilinear,2,128);
 }
 static float Number(string s){float n=float.Parse(s,CultureInfo.InvariantCulture);Require(Finite(n),"placement nonfinite");return n;}
 public static int Build(string directory,string folder,Transform parent,Dictionary<string,GameObject> prefabs,SmallPropsV1.Data data){var d=data.obsidianV1;if(d==null)return 0;var a=d.asset;
  var source=SmallPropsV1.MeshOf(a.positions,a.normals,a.colors,a.triangles,a.glow);source.name="obsidian collision";source=SharedImportCache.StoreMesh(source,"obsidian-collision/1\n"+JsonUtility.ToJson(a));
  var visual=UnityEngine.Object.Instantiate(source);var atlas=ColourAtlas(visual);visual.name="obsidian";visual=SharedImportCache.StoreMesh(visual,"obsidian-visual/1\n"+JsonUtility.ToJson(a));
  var shader=Shader.Find("Universal Render Pipeline/Lit");Require(shader&&shader.isSupported,"URP/Lit required");var material=new Material(shader){name="obsidian-glass",enableInstancing=true};material.SetTexture("_BaseMap",atlas);material.SetColor("_BaseColor",Color.white);material.SetFloat("_Metallic",.1f);material.SetFloat("_Smoothness",.9f);material.SetFloat("_Cull",2);material.SetFloat("_EnvironmentReflections",1);material.DisableKeyword("_ENVIRONMENTREFLECTIONS_OFF");material.DisableKeyword("_EMISSION");AssetDatabase.CreateAsset(material,folder+"/small-obsidian.mat");
  var root=new GameObject("obsidian");root.AddComponent<MeshFilter>().sharedMesh=visual;var renderer=root.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.reflectionProbeUsage=ReflectionProbeUsage.BlendProbes;renderer.lightProbeUsage=LightProbeUsage.BlendProbes;renderer.shadowCastingMode=ShadowCastingMode.On;root.AddComponent<MeshCollider>().sharedMesh=source;
  var prefab=PrefabUtility.SaveAsPrefabAsset(root,folder+"/small-obsidian.prefab");prefabs.Add(a.id,prefab);UnityEngine.Object.DestroyImmediate(root);
  int placed=0;foreach(var line in File.ReadAllLines(Path.Combine(directory,"props.csv"))){var row=line.Split(',');if(row.Length!=11||row[1]!=a.id||row[2]!=a.assetKey)continue;var tint=Array.Find(data.instances??new SmallPropsV1.Tint[0],t=>t.instanceId==row[0]);
   // Absence of the new placement record is the legacy omission fallback.
   if(tint?.rootPosition==null||tint.rootPosition.Length!=3)continue;ArrayOf(tint.rootPosition,3);ArrayOf(tint.tint,3);
   var o=(GameObject)PrefabUtility.InstantiatePrefab(prefab,parent);o.name=row[0];o.transform.localPosition=new Vector3(tint.rootPosition[0],tint.rootPosition[1],tint.rootPosition[2]);o.transform.localRotation=Quaternion.Euler(0,Number(row[6]),0);float x=Number(row[7]),y=Number(row[8]);Require(x>0&&y>0,"positive scale");o.transform.localScale=new Vector3(x,y,x);var block=new MaterialPropertyBlock();block.SetColor("_BaseColor",new Color(tint.tint[0],tint.tint[1],tint.tint[2],1));o.GetComponent<Renderer>().SetPropertyBlock(block);placed++;
  }return placed;
 }
}
}
