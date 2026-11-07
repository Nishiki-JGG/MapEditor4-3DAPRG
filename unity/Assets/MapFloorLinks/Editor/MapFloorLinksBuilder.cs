using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEditor;
namespace MapFloorLinks.EditorTools {
// 地形の穴は地形Importerがholes.pngから反映する。階層移動イベントはゲーム側で接続する。
public static class MapFloorLinksBuilder {
 [Serializable] public class Document { public StairData floorStairsV1; public Link[] floorLinks; }
 [Serializable] public class StairData { public int schemaVersion; public string frame; public Asset[] assets; }
 [Serializable] public class Asset { public string id,assetKey; public Part[] parts; public Portal portal; }
 [Serializable] public class Portal { public float[] center,size; }
 [Serializable] public class Part { public string name; public float[] positions,normals,color; public int[] indices; public float roughness; public bool collider; public bool render=true; }
 [Serializable] public class Trigger { public float[] center; public float radius; }
 [Serializable] public class Link { public string id,kind,assetKey,catalogId,tag; public float[] position,arrival; public float yawDeg; public Trigger trigger; }
 [Serializable] class MaterialKey { public float[] color; public float roughness; }
 public class Result { public GameObject root; public string assetFolder; public int placed,skipped; public readonly Dictionary<string,GameObject> prefabs=new Dictionary<string,GameObject>(); }
 static void Require(bool ok,string why) { if(!ok)throw new InvalidDataException("Floor stairs: "+why); }
 static bool Finite(float x)=>!float.IsNaN(x)&&!float.IsInfinity(x);
 static void Values(float[] a,int n,string label) { Require(a!=null&&a.Length==n,label+" length");foreach(float v in a)Require(Finite(v),label+" finite"); }
 static Vector3 V(float[] a,int i=0)=>new Vector3(a[i],a[i+1],a[i+2]);
 static bool Stair(string id)=>id=="floor_stairs_up"||id=="floor_stairs_down";
 public static Document Parse(string json) {
  var doc=JsonUtility.FromJson<Document>(json);Require(doc!=null&&doc.floorStairsV1!=null,"missing floorStairsV1");var d=doc.floorStairsV1;
  Require(d.schemaVersion==1&&d.frame=="unity-local","schema/frame");Require(d.assets!=null&&d.assets.Length>0&&d.assets.Length<=2,"assets");
  var ids=new HashSet<string>();foreach(var a in d.assets) {
   Require(a!=null&&Stair(a.id)&&ids.Add(a.id)&&a.assetKey=="tdj/"+a.id,"asset identity");Require(a.parts!=null&&a.parts.Length>0&&a.parts.Length<=512,"parts");
   if(a.portal!=null&&a.portal.size!=null){Values(a.portal.center,3,"portal center");Values(a.portal.size,2,"portal size");Require(a.portal.size[0]>0&&a.portal.size[1]>0&&a.portal.size[0]<=20&&a.portal.size[1]<=20,"portal size range");}
   foreach(var p in a.parts) {
    Require(p!=null&&p.positions!=null&&p.positions.Length>0&&p.positions.Length%3==0&&p.positions.Length<=180000,"positions");int n=p.positions.Length/3;
    Values(p.positions,n*3,"positions");Values(p.normals,n*3,"normals");Values(p.color,3,"color");foreach(float c in p.color)Require(c>=0&&c<=1,"color range");
    Require(Finite(p.roughness)&&p.roughness>=0&&p.roughness<=1,"roughness");Require(p.indices!=null&&p.indices.Length>0&&p.indices.Length%3==0&&p.indices.Length<=360000,"indices");foreach(int i in p.indices)Require(i>=0&&i<n,"index range");Require(p.render||p.collider,"empty part");
   }
  }
  Require(doc.floorLinks!=null&&doc.floorLinks.Length<=10000,"placements");var placed=new HashSet<string>();foreach(var l in doc.floorLinks) {
   Require(l!=null,"null link");if(!Stair(l.catalogId)||l.assetKey!="tdj/"+l.catalogId)continue;
   Require(ids.Contains(l.catalogId)&&!string.IsNullOrEmpty(l.id)&&placed.Add(l.id),"placement identity");Values(l.position,3,"position");Values(l.arrival,3,"arrival");Require(Finite(l.yawDeg),"yaw");Require(l.trigger!=null&&Finite(l.trigger.radius)&&l.trigger.radius>0,"trigger");Values(l.trigger.center,3,"trigger center");
  }return doc;
 }
 [MenuItem("Tools/Map Editor/Import floor stairs")]
 static void Import() {
  string folder=EditorUtility.OpenFolderPanel("Unity書出しフォルダー","","");if(string.IsNullOrEmpty(folder))return;var r=Build(folder);Undo.RegisterCreatedObjectUndo(r.root,"Import floor stairs");Selection.activeGameObject=r.root;
  Debug.Log("階段 "+r.placed+"個を取り込みました。下り階段は地形側のholes.png反映が必要です。階層移動イベントはゲーム側で接続してください。");
 }
 public static Result Build(string exportDirectory,Transform parent=null) {
  var doc=Parse(File.ReadAllText(Path.Combine(exportDirectory,"meta.json")));bool urp=GraphicsSettings.currentRenderPipeline!=null;var shader=Shader.Find(urp?"Universal Render Pipeline/Lit":"Standard");Require(shader&&shader.isSupported,"Lit shader");
  const string baseFolder="Assets/MapFloorLinksGenerated";if(!AssetDatabase.IsValidFolder(baseFolder))AssetDatabase.CreateFolder("Assets","MapFloorLinksGenerated");string folder=AssetDatabase.GenerateUniqueAssetPath(baseFolder+"/Stairs");AssetDatabase.CreateFolder(baseFolder,Path.GetFileName(folder));
  var result=new Result{assetFolder=folder};var materials=new Dictionary<string,Material>();
  try {
   foreach(var a in doc.floorStairsV1.assets) {
    var temporary=new GameObject(a.id);try {
     for(int i=0;i<a.parts.Length;i++) {
      var p=a.parts[i];int n=p.positions.Length/3;var vertices=new Vector3[n];var normals=new Vector3[n];for(int j=0;j<n;j++){vertices[j]=V(p.positions,j*3);normals[j]=V(p.normals,j*3);}
      var mesh=new Mesh{name=a.id+"_"+i,indexFormat=n>65535?IndexFormat.UInt32:IndexFormat.UInt16};mesh.vertices=vertices;mesh.normals=normals;mesh.triangles=p.indices;mesh.RecalculateBounds();AssetDatabase.CreateAsset(mesh,folder+"/"+a.id+"_"+i+".asset");
      var child=new GameObject(string.IsNullOrEmpty(p.name)?"part-"+i:p.name);child.transform.SetParent(temporary.transform,false);
      if(p.render) {
       string key=JsonUtility.ToJson(new MaterialKey{color=p.color,roughness=p.roughness});if(!materials.TryGetValue(key,out var mat)) {
        mat=new Material(shader){name="Stair stone "+materials.Count,enableInstancing=true};mat.SetColor(urp?"_BaseColor":"_Color",new Color(p.color[0],p.color[1],p.color[2],1));mat.SetFloat("_Metallic",0);mat.SetFloat(urp?"_Smoothness":"_Glossiness",1-p.roughness);AssetDatabase.CreateAsset(mat,folder+"/stone-"+materials.Count+".mat");materials.Add(key,mat);
       }child.AddComponent<MeshFilter>().sharedMesh=mesh;child.AddComponent<MeshRenderer>().sharedMaterial=mat;
      }if(p.collider)child.AddComponent<MeshCollider>().sharedMesh=mesh;
     }if(a.portal!=null&&a.portal.size!=null)PortalObject(temporary.transform,a.portal,folder,a.id);result.prefabs.Add(a.id,PrefabUtility.SaveAsPrefabAsset(temporary,folder+"/"+a.id+".prefab"));
    }finally{UnityEngine.Object.DestroyImmediate(temporary);}
   }
   result.root=new GameObject("Floor stairs");result.root.transform.SetParent(parent,false);
   foreach(var l in doc.floorLinks) {
    if(!Stair(l.catalogId)||l.assetKey!="tdj/"+l.catalogId){result.skipped++;continue;}
    var instance=(GameObject)PrefabUtility.InstantiatePrefab(result.prefabs[l.catalogId],result.root.transform);instance.name=l.id;instance.transform.localPosition=V(l.position);instance.transform.localRotation=Quaternion.Euler(0,l.yawDeg,0);
    Anchor(instance.transform,"Arrival",V(l.arrival),result.root.transform);Anchor(instance.transform,"Trigger (radius "+l.trigger.radius.ToString(System.Globalization.CultureInfo.InvariantCulture)+")",V(l.trigger.center),result.root.transform);result.placed++;
   }AssetDatabase.SaveAssets();return result;
  }catch{if(result.root)UnityEngine.Object.DestroyImmediate(result.root);AssetDatabase.DeleteAsset(folder);throw;}
 }
 static void PortalObject(Transform parent,Portal data,string folder,string id){
  var shader=Shader.Find("MapFloorLinks/Portal");Require(shader&&shader.isSupported,"Portal shader");
  string path=folder+"/portal.mat";var material=AssetDatabase.LoadAssetAtPath<Material>(path);if(!material){material=new Material(shader){name="Floor stair portal"};AssetDatabase.CreateAsset(material,path);}
  var mesh=new Mesh{name="Floor stair portal quad"};mesh.vertices=new[]{new Vector3(-.5f,-.5f,0),new Vector3(.5f,-.5f,0),new Vector3(.5f,.5f,0),new Vector3(-.5f,.5f,0)};mesh.uv=new[]{Vector2.zero,Vector2.right,Vector2.one,Vector2.up};mesh.triangles=new[]{0,2,1,0,3,2};mesh.RecalculateNormals();mesh.RecalculateBounds();AssetDatabase.CreateAsset(mesh,folder+"/"+id+"-portal.asset");
  var portal=new GameObject("Portal (visual only)");portal.transform.SetParent(parent,false);portal.transform.localPosition=V(data.center);portal.transform.localScale=new Vector3(data.size[0],data.size[1],1);portal.AddComponent<MeshFilter>().sharedMesh=mesh;var renderer=portal.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;
 }
 static void Anchor(Transform parent,string name,Vector3 position,Transform frame){var a=new GameObject(name);a.transform.SetParent(parent,false);a.transform.position=frame.TransformPoint(position);}
}
}