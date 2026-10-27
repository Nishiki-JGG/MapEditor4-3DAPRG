using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;

namespace MapSharedProps.EditorTools {
// Explicit bridge for the two required core assets. It can also wrap the frozen old Reader.
// Source exports are never rewritten; custom keys always resolve to the caller's prefab assets.
public static class FibrePrefabImport {
 public delegate int NativeBuilder(string source,string assets,Transform parent,Shader shader,Dictionary<string,GameObject> prefabs);
 [Serializable]class Key {public string id,assetKey;}
 [Serializable]class Header {public string library;public Key[] assets;}
 sealed class Placement {public string id,type,key;public Vector3 position,scale;public float yaw;public GameObject prefab;}
 static bool Fibre(string id){return id=="tiedsack"||id=="coiledrope";}
 static float Number(string value){float n=float.Parse(value,CultureInfo.InvariantCulture);if(float.IsNaN(n)||float.IsInfinity(n))throw new InvalidDataException("External fibre prefab: nonfinite placement");return n;}
 static List<Placement> Placements(string source,IReadOnlyDictionary<string,GameObject> external){
  var result=new List<Placement>();if(!File.Exists(Path.Combine(source,"small_props.json")))return result;
  var lines=File.ReadAllLines(Path.Combine(source,"props.csv"));var counts=new Dictionary<string,int>();foreach(string line in lines){var row=line.Split(',');if(row.Length==11)counts[row[0]]=counts.TryGetValue(row[0],out int n)?n+1:1;}
  var seen=new HashSet<string>();foreach(string line in lines){var row=line.Split(',');if(row.Length!=11||!Fibre(row[1])||row[2]=="tdj/"+row[1])continue;
   GameObject prefab=null;if(external==null||!external.TryGetValue(row[2],out prefab)||!prefab||!EditorUtility.IsPersistent(prefab)||!PrefabUtility.IsPartOfPrefabAsset(prefab))throw new InvalidDataException("External fibre prefab unresolved: "+row[1]+" -> "+row[2]+" (instance "+row[0]+"). Supply an explicit assetKey-to-prefab mapping; no standard replacement or silent skip is allowed.");
   if(!seen.Add(row[0])||counts[row[0]]!=1)throw new InvalidDataException("External fibre prefab: duplicate instance "+row[0]);
   var p=new Placement{id=row[0],type=row[1],key=row[2],prefab=prefab,position=new Vector3(Number(row[3]),Number(row[4]),Number(row[5])),yaw=Number(row[6]),scale=new Vector3(Number(row[7]),Number(row[8]),Number(row[7]))};if(p.scale.x<=0||p.scale.y<=0)throw new InvalidDataException("External fibre prefab: nonpositive scale");result.Add(p);
  }return result;
 }
 public static void Validate(string source,IReadOnlyDictionary<string,GameObject> external=null){Placements(source,external);}
 static string LibraryView(string json,List<Placement> custom){
  var header=JsonUtility.FromJson<Header>(json);if(header.assets==null)return json;
  foreach(var asset in header.assets){if(!Fibre(asset.id)||asset.assetKey=="tdj/"+asset.id)continue;
   if(header.assets.Length!=19||!custom.Exists(p=>p.type==asset.id&&p.key==asset.assetKey))throw new InvalidDataException("External fibre prefab: unsupported old core library key");
   var pattern=new Regex("(\"id\"\\s*:\\s*\""+asset.id+"\"\\s*,\\s*\"assetKey\"\\s*:\\s*)(\"(?:[^\"\\\\]|\\\\.)*\")");var matches=pattern.Matches(json);
   if(matches.Count!=1||JsonUtility.FromJson<Key>("{\"assetKey\":"+matches[0].Groups[2].Value+"}").assetKey!=asset.assetKey)throw new InvalidDataException("External fibre prefab: unsupported old core property order");
   json=pattern.Replace(json,m=>m.Groups[1].Value+"\"tdj/"+asset.id+"\"");
  }return json;
 }
 public static int Build(string source,string assets,Transform parent,Shader shader,Dictionary<string,GameObject> prefabs,IReadOnlyDictionary<string,GameObject> external,NativeBuilder native){
  var custom=Placements(source,external);if(custom.Count==0)return native(source,assets,parent,shader,prefabs);
  var instanceIds=new HashSet<string>();foreach(var p in custom)instanceIds.Add(p.id);
  var nativeRows=new List<string>();var canonical=new HashSet<string>();foreach(string line in File.ReadAllLines(Path.Combine(source,"props.csv"))){var row=line.Split(',');if(row.Length==11&&instanceIds.Contains(row[0]))continue;nativeRows.Add(line);if(row.Length==11)canonical.Add(row[1]);}
  string view=Path.Combine(Path.GetTempPath(),"MapFibreNativeView-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(view);
  try{
   string json=File.ReadAllText(Path.Combine(source,"small_props.json"));File.WriteAllText(Path.Combine(view,"small_props.json"),LibraryView(json,custom));var header=JsonUtility.FromJson<Header>(json);if(!string.IsNullOrEmpty(header.library)){if(header.library!="small_props_library.json")throw new InvalidDataException("External fibre prefab: unknown native library");File.WriteAllText(Path.Combine(view,header.library),LibraryView(SharedAssetFiles.ReadText(SharedAssetFiles.Resolve(source,header.library)),custom));}
   File.WriteAllLines(Path.Combine(view,"props.csv"),nativeRows);
   int placed=native(view,assets,parent,shader,prefabs);
   foreach(var p in custom){var o=(GameObject)PrefabUtility.InstantiatePrefab(p.prefab,parent);o.name=p.id;o.transform.localPosition=p.position;o.transform.localRotation=Quaternion.Euler(0,p.yaw,0);o.transform.localScale=p.scale;placed++;if(!canonical.Contains(p.type))prefabs.Remove(p.type);}
   return placed;
  }finally{Directory.Delete(view,true);}
 }
}
}
