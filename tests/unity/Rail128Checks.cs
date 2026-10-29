using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;using UnityEngine.Rendering;using MapSharedProps.EditorTools;
public static class Rail128Checks {
 static string Root=>Path.GetFullPath(Path.Combine(Application.dataPath,".."));static string Out=>Path.Combine(Root,"Evidence128Native");
 static void Check(bool b,string s){if(!b)throw new Exception(s);}
 [Serializable]class Report{public bool pass,old48Preserved,savedReinstantiated,sceneReloaded,sharedMaterial;public int prefabs,placements,joints;public string error;public string[] limitations;}
 static Report report=new Report();
 public static void Run(){Directory.CreateDirectory(Out);try{
  EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  const string folder="Assets/Imported128";if(!AssetDatabase.IsValidFolder(folder))AssetDatabase.CreateFolder("Assets","Imported128");
  var root=new GameObject("Drag rail export");var prefabs=new Dictionary<string,GameObject>();
  int count=SmallPropsV1.Build(Path.Combine(Root,"Input128"),folder,root.transform,Shader.Find("MapSharedProps/Lit"),prefabs);
  Check(prefabs.Count==48&&count==6,"formal 48 prefabs / six exported placements");report.prefabs=prefabs.Count;report.placements=count;
  foreach(var kv in prefabs){var before=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported125-valid/small-"+kv.Key+".prefab");Check(before,"public baseline48 "+kv.Key);
   Check(ColliderSnapshot109.MeshHash(before.GetComponent<MeshFilter>().sharedMesh)==ColliderSnapshot109.MeshHash(kv.Value.GetComponent<MeshFilter>().sharedMesh),"unchanged mesh "+kv.Key);
   var bc=before.GetComponentsInChildren<Collider>(true);var ac=kv.Value.GetComponentsInChildren<Collider>(true);Check(bc.Length==ac.Length,"actual collider count "+kv.Key);if(bc.Length>0)Check(ColliderSnapshot109.Capture(before)==ColliderSnapshot109.Capture(kv.Value),"actual collider geometry "+kv.Key);
  }report.old48Preserved=true;
  var transforms=root.transform.Cast<Transform>().ToArray();for(int i=1;i<transforms.Length;i++){
   var a=transforms[i-1];var b=transforms[i];bool curve=a.GetComponent<MeshFilter>().sharedMesh==prefabs["mine_rail_curve"].GetComponent<MeshFilter>().sharedMesh;Vector3 end=a.TransformPoint(curve?new Vector3(2,0,-2):new Vector3(0,0,-2));
   Check(Vector3.Distance(end,b.position)<.002f,"export endpoint continuity "+i);
   Vector3 tangent=a.TransformDirection(curve?Vector3.right:Vector3.back),incoming=b.TransformDirection(Vector3.back);Check(Vector3.Dot(tangent,incoming)>.9999f,"export tangent continuity "+i);report.joints++;
  }
  var mats=root.GetComponentsInChildren<MeshRenderer>().Select(r=>r.sharedMaterial).ToArray();Check(mats.Distinct().Count()==1,"one shared rail material");report.sharedMaterial=true;
  var poses=transforms.Select(t=>t.localToWorldMatrix).ToArray();var meshes=root.GetComponentsInChildren<MeshFilter>().Select(x=>x.sharedMesh).ToArray();
  var asset=PrefabUtility.SaveAsPrefabAsset(root,folder+"/drag-route.prefab");UnityEngine.Object.DestroyImmediate(root);root=(GameObject)PrefabUtility.InstantiatePrefab(asset);
  Check(root.transform.Cast<Transform>().Select(t=>t.localToWorldMatrix).SequenceEqual(poses),"save-destroy-instantiate poses");Check(root.GetComponentsInChildren<MeshFilter>().Select(x=>x.sharedMesh).SequenceEqual(meshes),"persistent meshes");Check(root.GetComponentsInChildren<MeshRenderer>().Select(x=>x.sharedMaterial).SequenceEqual(mats),"persistent shared material");report.savedReinstantiated=true;
  EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(),folder+"/drag-route.unity");EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);EditorSceneManager.OpenScene(folder+"/drag-route.unity");root=EditorSceneManager.GetActiveScene().GetRootGameObjects().Single();Check(root&&root.transform.childCount==6&&root.transform.Cast<Transform>().Select(t=>t.localToWorldMatrix).SequenceEqual(poses),"scene reload poses");report.sceneReloaded=true;
  Render(root);AssetDatabase.SaveAssets();report.pass=true;report.limitations=new[]{"Dedicated background Editor/offscreen only. No Player or user GUI.","Placement-only change; native source and mesh/material payload unchanged from public baseline.","Old binary not run; existing optional reader contract unchanged."};Save();EditorApplication.Exit(0);
 }catch(Exception e){report.error=e.ToString();Save();Debug.LogException(e);EditorApplication.Exit(1);}}
 static void Save(){File.WriteAllText(Path.Combine(Out,"checks.json"),JsonUtility.ToJson(report,true));}
 static void Render(GameObject root){RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.16f,.18f,.2f);var plane=GameObject.CreatePrimitive(PrimitiveType.Plane);plane.transform.position=new Vector3(16,-.005f,12);plane.transform.localScale=new Vector3(3,1,3);var mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));mat.color=new Color(.24f,.21f,.17f);plane.GetComponent<Renderer>().sharedMaterial=mat;
 var light=new GameObject("offscreen key").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.3f;light.shadows=LightShadows.Soft;light.transform.rotation=Quaternion.Euler(45,-30,0);var camera=new GameObject("offscreen camera").AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.08f,.09f,.1f);camera.fieldOfView=45;camera.nearClipPlane=.02f;
 foreach(string view in new[]{"normal","joint"}){var target=view=="normal"?new Vector3(18,0,12):new Vector3(17,0,9);camera.transform.position=target+(view=="normal"?new Vector3(8,13,-10):new Vector3(3,3,-4));camera.transform.LookAt(target);var image=Shared117Review.Image(camera,1600,900);File.WriteAllBytes(Path.Combine(Out,view+".png"),image.EncodeToPNG());UnityEngine.Object.DestroyImmediate(image);}
 }
}
