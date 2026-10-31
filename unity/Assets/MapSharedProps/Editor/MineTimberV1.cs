using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEditor;
namespace MapSharedProps.EditorTools {
// 独立支保枠。既存レールの材質を共有し、不正な拡張は既存資産から切り離す。
public static class MineTimberV1 {
 [Serializable] public class Asset:SmallPropsV1.Asset{}
 [Serializable] public class Data{public int version;public string units,axes,atlas;public Asset[] assets;}
 static void Check(bool ok,string message){if(!ok)throw new InvalidDataException("mine timber: "+message);}
 static bool Finite(float v)=>!float.IsNaN(v)&&!float.IsInfinity(v);
 static void Floats(float[] a,int n){Check(a!=null&&a.Length==n&&a.All(Finite),"array size/finite");}
 public static Data Optional(Data d){
  if(d==null||(d.version==0&&d.assets==null))return null;
  try{
   Check(d.version==1&&d.units=="metres"&&d.axes=="Unity X/Y/Z"&&d.atlas=="mineRailsV1","header/atlas");
   Check(d.assets!=null&&d.assets.Length<=1,"bounded set");
   foreach(var a in d.assets){
    Check(a!=null&&a.id=="mine_timber_frame"&&a.assetKey=="tdj/mine_timber_frame"&&a.material=="mineTimber","identity");
    int n=a.positions?.Length/3??0;Check(n>0&&n<=6000&&a.positions.Length==n*3,"mesh bound");
    Floats(a.positions,n*3);Floats(a.normals,n*3);Floats(a.colors,n*3);Floats(a.uv,n*2);Floats(a.glow,n);
    Check(a.positions.All(x=>Mathf.Abs(x)<=6)&&a.normals.All(x=>Mathf.Abs(x)<=1.001f)&&a.colors.All(x=>x==1)&&a.glow.All(x=>x==0)&&a.uv.All(x=>x>=0&&x<=1),"mesh values");
    Check(a.triangles!=null&&a.triangles.Length>0&&a.triangles.Length<=6000&&a.triangles.Length%3==0&&a.triangles.All(x=>x>=0&&x<n),"indices");
    Check(Finite(a.radius)&&a.radius>=0&&a.radius<=4&&Finite(a.height)&&a.height>0&&a.height<=6&&a.groundSink==0&&!a.shape,"catalog");
    if(a.radius>0){Check(a.circleColliders!=null&&a.circleColliders.Length>0&&a.circleColliders.Length<=16,"column proxies");foreach(var c in a.circleColliders){Floats(c.center,3);Check(c.center.All(x=>Mathf.Abs(x)<=6)&&Finite(c.radius)&&Mathf.Abs(c.radius-a.radius)<1e-6&&Finite(c.height)&&Mathf.Abs(c.height-a.height)<1e-6,"proxy metadata");}}
   }
   return d;
  }catch(Exception e)when(e is InvalidDataException||e is ArgumentException||e is NullReferenceException){Debug.LogWarning("Optional mine timber ignored; existing assets retained: "+e.Message);return null;}
 }
 static float Number(string s){float n=float.Parse(s,CultureInfo.InvariantCulture);Check(Finite(n),"placement finite");return n;}
 public static int Build(string directory,string folder,Transform parent,Dictionary<string,GameObject> prefabs,SmallPropsV1.Data data){
  var d=data.mineTimberV1;if(d==null||d.assets.Length==0)return 0;
  if(!prefabs.TryGetValue("mine_rail_straight",out var rail)||!rail.GetComponent<Renderer>()||!rail.GetComponent<Renderer>().sharedMaterial){Debug.LogWarning("Optional mine timber ignored: validated mine rail material missing");return 0;}
  var material=rail.GetComponent<Renderer>().sharedMaterial;
  foreach(var a in d.assets){
   var mesh=SmallPropsV1.MeshOf(a.positions,a.normals,a.colors,a.triangles,a.glow);var uv=new Vector2[a.uv.Length/2];for(int i=0;i<uv.Length;i++)uv[i]=new Vector2(a.uv[i*2],1-a.uv[i*2+1]);mesh.uv=uv;mesh.RecalculateTangents();mesh=SharedImportCache.StoreMesh(mesh,"mine-timber/1\n"+JsonUtility.ToJson(a));
   var root=new GameObject(a.id);root.AddComponent<MeshFilter>().sharedMesh=mesh;var renderer=root.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.reflectionProbeUsage=ReflectionProbeUsage.BlendProbes;renderer.shadowCastingMode=ShadowCastingMode.On;renderer.receiveShadows=true;
   if(a.radius>0)SmallPropsV1.Collider(root,a,mesh);
   var prefab=PrefabUtility.SaveAsPrefabAsset(root,folder+"/small-"+a.id+".prefab");prefabs.Add(a.id,prefab);UnityEngine.Object.DestroyImmediate(root);
  }
  int placed=0;foreach(var line in File.ReadAllLines(Path.Combine(directory,"props.csv"))){var row=line.Split(',');if(row.Length!=11||!d.assets.Any(a=>a.id==row[1]&&a.assetKey==row[2]))continue;float sx=Number(row[7]),sy=Number(row[8]);Check(sx>0&&sy>0,"positive scale");var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefabs[row[1]],parent);obj.name=row[0];obj.transform.localPosition=new Vector3(Number(row[3]),Number(row[4]),Number(row[5]));obj.transform.localRotation=Quaternion.Euler(0,Number(row[6]),0);obj.transform.localScale=new Vector3(sx,sy,sx);placed++;}return placed;
 }
}
}
