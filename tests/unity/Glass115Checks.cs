using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;using MapSharedProps.EditorTools;
public static class Glass115Checks {
 static void Check(bool b,string s){if(!b)throw new Exception(s);}
 static string Root=>Path.GetFullPath(Path.Combine(Application.dataPath,".."));
 static string ReplaceOptional(string raw,string value){int key=raw.IndexOf("\"obsidianV1\"",StringComparison.Ordinal),start=raw.IndexOf('{',key),depth=0,end=start;bool quoted=false,escaped=false;Check(key>=0&&start>key,"optional fixture field");for(;end<raw.Length;end++){char c=raw[end];if(quoted){if(escaped)escaped=false;else if(c=='\\')escaped=true;else if(c=='\"')quoted=false;continue;}if(c=='\"'){quoted=true;continue;}if(c=='{')depth++;if(c=='}'&&--depth==0){end++;break;}}Check(depth==0,"bounded JSON object");return raw.Substring(0,start)+value+raw.Substring(end);}
 public static void Run(){int exit=0;string evidence=Path.Combine(Root,"Evidence115Import");Directory.CreateDirectory(evidence);try{
  EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  string raw=File.ReadAllText(Path.Combine(Root,"Input114-after/small_props.json")),input=Path.Combine(Root,"Input115-active");Directory.CreateDirectory(input);File.Copy(Path.Combine(Root,"Input114-after/props.csv"),Path.Combine(input,"props.csv"),true);
  var web=JsonUtility.FromJson<Cases>(File.ReadAllText(Path.Combine(Root,"Evidence115Web/cases.json")));Check(web.cases.Length==4,"four actual catalog exports");
  int reproduced=0;var results=new List<Row>();
  foreach(string tag in new[]{"default","custom","zero","nonsolid","missing","version","nonfinite","oversized","negativeRadius","zeroHeight"}){
   var d=JsonUtility.FromJson<SmallPropsV1.Data>(raw);bool valid=Array.Exists(new[]{"default","custom","zero","nonsolid"},x=>x==tag);
   if(valid){var c=web.cases.First(x=>x.tag==tag);d.obsidianV1=c.descriptor;var old=ObsidianBefore115.Optional(JsonUtility.FromJson<ObsidianBefore115.Descriptor>(JsonUtility.ToJson(d.obsidianV1)));Check((old!=null)==(tag=="default"),"old fixed validator reproduction "+tag);if(old==null)reproduced++;}
   if(tag=="missing")d.obsidianV1=null;
   if(tag=="version")d.obsidianV1.version=999;
   if(tag=="nonfinite")d.obsidianV1.asset.height=float.PositiveInfinity;
   if(tag=="oversized")d.obsidianV1.asset.positions=d.obsidianV1.asset.positions.Concat(d.obsidianV1.asset.positions).ToArray();
   if(tag=="negativeRadius")d.obsidianV1.asset.radius=-.1f;
   if(tag=="zeroHeight")d.obsidianV1.asset.height=0;
   File.WriteAllText(Path.Combine(input,"small_props.json"),ReplaceOptional(raw,d.obsidianV1==null?"null":JsonUtility.ToJson(d.obsidianV1)));
   var read=SmallPropsV1.Read(Path.Combine(input,"small_props.json"));Check((read.obsidianV1!=null)==valid,tag+" optional status");
   string folder="Assets/Imported115-"+tag;Check(!AssetDatabase.IsValidFolder(folder),"No overwriting prior evidence "+tag);AssetDatabase.CreateFolder("Assets","Imported115-"+tag);var parent=new GameObject(tag);var prefabs=new Dictionary<string,GameObject>();int placed=SmallPropsV1.Build(input,folder,parent.transform,Shader.Find("MapSharedProps/Lit"),prefabs);
   Check(prefabs.Count==(valid?44:43)&&placed==(valid?1:0),tag+" actual prefab and placement count");
   foreach(var id in prefabs.Keys.Where(x=>x!="obsidian")){var before=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported114-valid/small-"+id+".prefab");Check(before,"baseline "+id);var after=prefabs[id];Check(before.GetComponent<MeshFilter>().sharedMesh==after.GetComponent<MeshFilter>().sharedMesh,"old43 visual "+id);int count=before.GetComponentsInChildren<Collider>(true).Length;Check(count==after.GetComponentsInChildren<Collider>(true).Length,"old43 collider count "+id);if(count>0)Check(ColliderSnapshot109.Capture(before)==ColliderSnapshot109.Capture(after),"old43 actual collider "+id);}
   int colliders=0;if(valid){var o=prefabs["obsidian"];var a=read.obsidianV1.asset;colliders=o.GetComponentsInChildren<Collider>(true).Length;Check(colliders==(a.radius>0?1:0),tag+" collider policy");var baseline=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported114-valid/small-obsidian.prefab");var mesh=o.GetComponent<MeshFilter>().sharedMesh;Check(mesh.triangles.Length==120&&ColliderSnapshot109.MeshHash(mesh)==ColliderSnapshot109.MeshHash(baseline.GetComponent<MeshFilter>().sharedMesh),"unchanged 40tri visual "+tag);Check(mesh.normals.SequenceEqual(baseline.GetComponent<MeshFilter>().sharedMesh.normals)&&mesh.colors.SequenceEqual(baseline.GetComponent<MeshFilter>().sharedMesh.colors),"normal/colour "+tag);var mat=o.GetComponent<Renderer>().sharedMaterial;Check(mat.shader.name=="Universal Render Pipeline/Lit"&&mat.GetTexture("_BaseMap")==baseline.GetComponent<Renderer>().sharedMaterial.GetTexture("_BaseMap"),"same shared atlas/reflection material "+tag);Check(mat.GetFloat("_Smoothness")==.9f&&mat.GetFloat("_Metallic")==.1f,"gloss unchanged");if(colliders>0)Check(ColliderSnapshot109.Capture(o)==ColliderSnapshot109.Capture(baseline),"shape collider unchanged "+tag);Check(parent.GetComponentsInChildren<Renderer>(true).Length==1,"visible placed instance "+tag);}
   results.Add(new Row{tag=tag,prefabs=prefabs.Count,placed=placed,obsidianColliders=colliders});UnityEngine.Object.DestroyImmediate(parent);d=null;read=null;GC.Collect();
  }
  Check(reproduced==3,"three legitimate changes previously rejected");AssetDatabase.SaveAssets();File.WriteAllText(Path.Combine(evidence,"checks.json"),JsonUtility.ToJson(new Report{pass=true,reproduced=reproduced,cases=results.ToArray(),old43Exact=true,playerExecuted=false},true));
 }catch(Exception e){Debug.LogException(e);File.WriteAllText(Path.Combine(evidence,"error.txt"),e.ToString());exit=1;}finally{EditorApplication.Exit(exit);}}
 [Serializable]public class Cases{public Case[] cases;}[Serializable]public class Case{public string tag;public ObsidianV1.Descriptor descriptor;}
 [Serializable]public class Row{public string tag;public int prefabs,placed,obsidianColliders;}
 [Serializable]public class Report{public bool pass,old43Exact,playerExecuted;public int reproduced;public Row[] cases;}
}
