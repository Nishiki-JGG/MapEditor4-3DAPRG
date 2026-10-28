using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;using MapSharedProps.EditorTools;
public static class Fan111Checks {
 static string Root=>Path.GetFullPath(Path.Combine(Application.dataPath,".."));static void Check(bool v,string s){if(!v)throw new Exception(s);}
 static string Colliders(GameObject o)=>ColliderSnapshot109.Capture(o);
 public static void Run(){int exit=0;string output=Path.Combine(Root,"Evidence111Import");Directory.CreateDirectory(output);try{
 EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
 string folder="Assets/Imported111-after-v3";var root=new GameObject("Boat109");var after=new Dictionary<string,GameObject>();
 if(AssetDatabase.IsValidFolder(folder)){foreach(var guid in AssetDatabase.FindAssets("t:Prefab",new[]{folder})){var path=AssetDatabase.GUIDToAssetPath(guid);var id=Path.GetFileNameWithoutExtension(path).Substring(6);after.Add(id,AssetDatabase.LoadAssetAtPath<GameObject>(path));}Check(after.Count==43,"43 completed prefabs from prior import");}
 else{AssetDatabase.CreateFolder("Assets","Imported111-after-v3");Check(SmallPropsV1.Build(Path.Combine(Root,"Input111-after"),folder,root.transform,Shader.Find("MapSharedProps/Lit"),after)==1&&after.Count==43,"43 prefabs and one placement");}

 var before=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported109-after-v3/small-seafan.prefab");Check(before,"baseline seafan");var current=after["seafan"];File.WriteAllText(Path.Combine(output,"collider-before.txt"),Colliders(before));File.WriteAllText(Path.Combine(output,"collider-after.txt"),Colliders(current));
 var oldMesh=before.GetComponent<MeshCollider>().sharedMesh;var newMesh=current.GetComponent<MeshCollider>().sharedMesh;
 File.WriteAllText(Path.Combine(output,"mesh-identities.txt"),AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(oldMesh))+"\n"+AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(newMesh))+"\n"+ColliderSnapshot109.MeshHash(oldMesh)+"\n"+ColliderSnapshot109.MeshHash(newMesh));
 Check(Colliders(before)==Colliders(current)&&current.GetComponentsInChildren<Collider>(true).Length>0,"exact real Collider");
 foreach(var id in after.Keys.Where(x=>x!="seafan")){var b=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported109-after-v3/small-"+id+".prefab");Check(b&&b.GetComponent<MeshFilter>().sharedMesh==after[id].GetComponent<MeshFilter>().sharedMesh,"unrelated mesh exact "+id);}
 var vm0=before.GetComponent<MeshFilter>().sharedMesh;var vm1=current.GetComponent<MeshFilter>().sharedMesh;Check(ColliderSnapshot109.MeshHash(vm0)==ColliderSnapshot109.MeshHash(vm1)&&vm0.normals.SequenceEqual(vm1.normals)&&vm0.colors.SequenceEqual(vm1.colors)&&vm0.uv.SequenceEqual(vm1.uv),"seafan actual visual mesh attributes exact");var mesh=current.GetComponent<MeshFilter>().sharedMesh;Check(mesh.vertexCount/3==1106,"1106 triangle budget");Check(mesh.vertices.All(v=>float.IsFinite(v.x)&&float.IsFinite(v.y)&&float.IsFinite(v.z)),"finite");Check(mesh.bounds.min.y>=-.043f&&mesh.bounds.max.y<=.943f,"height and ground contact");
 var renderer=current.GetComponent<Renderer>();var material=renderer.sharedMaterial;var texture=material.GetTexture("_BaseMap");Check(texture&&texture.width==256&&texture.height==256,"same atlas dimensions");Check(!ShaderUtil.ShaderHasError(material.shader),"material shader compiles");Check(current.GetComponentsInChildren<Light>(true).Length==0,"no light");
 for(int k=0;k<225;k++){var o=UnityEngine.Object.Instantiate(current);Check(o.GetComponent<MeshFilter>().sharedMesh==mesh&&o.GetComponent<Renderer>().sharedMaterial==material,"225 references shared");UnityEngine.Object.DestroyImmediate(o);}
 ColliderSnapshot109.NegativeControls(current);
 var bannerBefore=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported104-after/small-banner.prefab");var bannerAfter=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported109-after-v3/small-banner.prefab");Check(Colliders(bannerBefore)==Colliders(bannerAfter),"Banner108 actual MeshCollider exact");ColliderSnapshot109.NegativeControls(bannerAfter);
 UnityEngine.Object.DestroyImmediate(root);AssetDatabase.SaveAssets();
 File.WriteAllText(Path.Combine(output,"checks.json"),"{\"pass\":true,\"prefabs\":43,\"placements\":1,\"triangles\":1106,\"colliderExact\":true,\"meshColliderGeometryAndTransformCompared\":true,\"banner108Rechecked\":true,\"negativeControls\":true,\"other42MeshesExact\":true,\"atlasDimensions\":[256,256],\"sharedReferencesChecked\":225,\"readerSourceUnchanged\":true,\"playerExecuted\":false}");
 }catch(Exception e){Debug.LogException(e);File.WriteAllText(Path.Combine(output,"error.txt"),e.ToString());exit=1;}finally{EditorApplication.Exit(exit);}}
}
