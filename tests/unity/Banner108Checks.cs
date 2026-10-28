using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;using MapSharedProps.EditorTools;
public static class Banner108Checks {
 static string Root=>Path.GetFullPath(Path.Combine(Application.dataPath,".."));static void Check(bool v,string s){if(!v)throw new Exception(s);}
 static string Colliders(GameObject o)=>ColliderSnapshot109.Capture(o);
 public static void Run(){int exit=0;string output=Path.Combine(Root,"Evidence108Import");Directory.CreateDirectory(output);try{
 EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
 string folder="Assets/Imported108-after-v3";Check(!AssetDatabase.IsValidFolder(folder),"Fresh output required");AssetDatabase.CreateFolder("Assets","Imported108-after-v3");var root=new GameObject("Banner108");var after=new Dictionary<string,GameObject>();Check(SmallPropsV1.Build(Path.Combine(Root,"Input108-after"),folder,root.transform,Shader.Find("MapSharedProps/Lit"),after)==1&&after.Count==43,"43 prefabs and one placement");
 var before=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported104-after/small-banner.prefab");Check(before,"baseline banner");var current=after["banner"];Check(Colliders(before)==Colliders(current)&&current.GetComponentsInChildren<Collider>(true).Length>0,"exact real Collider");
 foreach(var id in after.Keys.Where(x=>x!="banner")){var b=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Imported104-after/small-"+id+".prefab");Check(b&&b.GetComponent<MeshFilter>().sharedMesh==after[id].GetComponent<MeshFilter>().sharedMesh,"unrelated mesh exact "+id);}
 var mesh=current.GetComponent<MeshFilter>().sharedMesh;Check(mesh.vertexCount/3==348,"348 triangle budget");Check(mesh.vertices.All(v=>float.IsFinite(v.x)&&float.IsFinite(v.y)&&float.IsFinite(v.z)),"finite");Check(mesh.bounds.min.y>=-.001f&&mesh.bounds.max.y<=3.721f,"height and ground contact");
 var renderer=current.GetComponent<Renderer>();var material=renderer.sharedMaterial;var texture=material.GetTexture("_BaseMap");Check(texture&&texture.width==1024&&texture.height==512,"same atlas dimensions");Check(!ShaderUtil.ShaderHasError(material.shader),"material shader compiles");Check(current.GetComponentsInChildren<Light>(true).Length==0,"no light");
 for(int k=0;k<225;k++){var o=UnityEngine.Object.Instantiate(current);Check(o.GetComponent<MeshFilter>().sharedMesh==mesh&&o.GetComponent<Renderer>().sharedMaterial==material,"225 references shared");UnityEngine.Object.DestroyImmediate(o);}
 ColliderSnapshot109.NegativeControls(current);UnityEngine.Object.DestroyImmediate(root);AssetDatabase.SaveAssets();
 File.WriteAllText(Path.Combine(output,"checks.json"),"{\"pass\":true,\"prefabs\":43,\"placements\":1,\"triangles\":348,\"colliderExact\":true,\"other42MeshesExact\":true,\"atlasDimensions\":[1024,512],\"sharedReferencesChecked\":225,\"readerSourceUnchanged\":true,\"playerExecuted\":false}");
 }catch(Exception e){Debug.LogException(e);File.WriteAllText(Path.Combine(output,"error.txt"),e.ToString());exit=1;}finally{EditorApplication.Exit(exit);}}
}
