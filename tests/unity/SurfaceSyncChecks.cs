using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Builder = MapSharedProps.EditorTools.MapSharedPropsBuilder;
namespace MapEditor.Tests {
public static class SurfaceSyncChecks {
 [Serializable] class Check { public string name; public bool pass; }
 [Serializable] class Report { public bool passed; public string unity; public Check[] checks; }
 static readonly List<Check> checks=new List<Check>();
 static void Verify(string name,bool ok) { checks.Add(new Check{name=name,pass=ok}); if(!ok)throw new Exception(name); }
 static string Arg(string key){var a=Environment.GetCommandLineArgs();return a[Array.IndexOf(a,key)+1];}
 static void Reject(string output,Builder.LibraryDto lib,string label,Action change,Action restore){change();string f=Path.Combine(output,"invalid-library.json");File.WriteAllText(f,JsonUtility.ToJson(lib));bool rejected=false;try{Builder.ReadLibrary(f);}catch(InvalidDataException){rejected=true;}finally{restore();File.Delete(f);}Verify(label,rejected);}
 public static void Run(){string output=Arg("-surface-output"),export=Arg("-surface-export");int code=0;Builder.Result built=null;var priorGraphics=GraphicsSettings.defaultRenderPipeline;var priorQuality=QualitySettings.renderPipeline;
 try {
  EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var old=Builder.ReadLibrary(Path.Combine(output,"legacy-library.json"));Verify("Legacy rock v4 accepted",old.assets.Single(a=>a.id=="rock").version==4);
  var rd=ScriptableObject.CreateInstance<UniversalRendererData>();var pipeline=UniversalRenderPipelineAsset.Create(rd);GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
  var lib=Builder.ReadLibrary(Path.Combine(export,"shared_props.json"));Verify("Current 56 assets and 9 textures accepted",lib.assets.Length==56&&lib.textures.Length==9);
  var rock=lib.assets.Single(a=>a.id=="rock");var tx=lib.textures.Single(t=>t.id=="placed-rock-mineral-v3");
  Reject(output,lib,"Unknown rock version rejected",()=>rock.version=6,()=>rock.version=5);
  Reject(output,lib,"Wrong rock texture rejected",()=>rock.material.texture="rock-basecolor-v1",()=>rock.material.texture="placed-rock-mineral-v3");
  Reject(output,lib,"Missing sRGB metadata rejected",()=>tx.colorSpace=null,()=>tx.colorSpace="sRGB");
  built=Builder.Build(export);Verify("All four exported placements imported",built.placed==4&&built.skipped==0);
  foreach(var id in new[]{"rock","drysoil_curl","drysoil_cup","drysoil_flake"}){
   var source=lib.assets.Single(a=>a.id==id);var prefab=built.prefabs[id];var mesh=prefab.GetComponent<MeshFilter>().sharedMesh;var mat=prefab.GetComponent<MeshRenderer>().sharedMaterial;
   bool same=mesh.vertexCount==source.positions.Length/3&&mesh.triangles.SequenceEqual(source.triangles);for(int i=0;i<mesh.vertexCount;i++){same&=Vector3.Distance(mesh.vertices[i],new Vector3(source.positions[i*3],source.positions[i*3+1],source.positions[i*3+2]))<1e-6f;same&=Vector3.Distance(mesh.normals[i],new Vector3(source.normals[i*3],source.normals[i*3+1],source.normals[i*3+2]))<1e-6f;same&=Vector2.Distance(mesh.uv[i],new Vector2(source.uv[i*2],source.uv[i*2+1]))<1e-6f;var c=mesh.colors[i];same&=Mathf.Abs(c.r-source.colors[i*3])<1e-6f&&Mathf.Abs(c.g-source.colors[i*3+1])<1e-6f&&Mathf.Abs(c.b-source.colors[i*3+2])<1e-6f;}
   Verify(id+" positions normals colours UV triangles preserved",same);
   var texture=lib.textures.Single(t=>t.id==source.material.texture);string path=AssetDatabase.GetAssetPath(mat.GetTexture("_BaseMap"));var importer=(TextureImporter)AssetImporter.GetAtPath(path);
   Verify(id+" PNG and colour/filter settings preserved",File.ReadAllBytes(path).SequenceEqual(Convert.FromBase64String(texture.png))&&importer.sRGBTexture&&importer.mipmapEnabled&&importer.anisoLevel==4&&importer.filterMode==FilterMode.Trilinear&&importer.wrapMode==TextureWrapMode.Repeat);
   Verify(id+" material reads shared vertex data",mat.shader.name=="MapSharedProps/Lit"&&mat.GetFloat("_Cutoff")==0&&mat.GetFloat("_Cull")==2);
  }
  // Render the imported prefabs; larger soil scale here only makes their curled edges readable.
  built.root.SetActive(false);var visual=new GameObject("Surface sync preview");int index=0;
  foreach(var id in new[]{"rock","drysoil_curl","drysoil_cup","drysoil_flake"}){var obj=(GameObject)PrefabUtility.InstantiatePrefab(built.prefabs[id],visual.transform);obj.transform.position=new Vector3(-3+index*2,0,0);obj.transform.localScale=Vector3.one*(id=="rock"?1.5f:3f);index++;}
  RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.65f,.65f,.65f);
  var light=new GameObject("Surface sun").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.1f;light.transform.rotation=Quaternion.Euler(40,-35,0);
  var floor=GameObject.CreatePrimitive(PrimitiveType.Plane);floor.transform.position=new Vector3(0,-.005f,0);var fm=new Material(Shader.Find("Universal Render Pipeline/Lit"));fm.SetColor("_BaseColor",new Color(.3f,.32f,.27f));floor.GetComponent<Renderer>().sharedMaterial=fm;
  var camera=new GameObject("Surface camera").AddComponent<Camera>();camera.gameObject.AddComponent<UniversalAdditionalCameraData>();camera.orthographic=true;camera.orthographicSize=2.8f;camera.aspect=1.6f;camera.transform.position=new Vector3(3,7,-9);camera.transform.LookAt(new Vector3(0,.3f,0));camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.18f,.20f,.22f);
  Capture(camera,output);Capture(camera,output);
  Verify("Shared material shader compiles",!ShaderUtil.GetShaderMessages(Shader.Find("MapSharedProps/Lit")).Any(m=>m.severity.ToString()=="Error"));
 }catch(Exception e){code=1;Debug.LogException(e);File.WriteAllText(Path.Combine(output,"failure.txt"),e.ToString());}
 finally {GraphicsSettings.defaultRenderPipeline=priorGraphics;QualitySettings.renderPipeline=priorQuality;if(built!=null){if(built.root)UnityEngine.Object.DestroyImmediate(built.root);AssetDatabase.DeleteAsset(built.assetDirectory);if(built.ground!=null)AssetDatabase.DeleteAsset(built.ground.folder);}File.WriteAllText(Path.Combine(output,"UNITY_RESULT.json"),JsonUtility.ToJson(new Report{passed=code==0,unity=Application.unityVersion,checks=checks.ToArray()},true));EditorApplication.Exit(code);}
 }
 static void Capture(Camera camera,string output){var rt=new RenderTexture(1280,800,24);rt.Create();camera.targetTexture=rt;RenderPipeline.SubmitRenderRequest(camera,new RenderPipeline.StandardRequest{destination=rt});var old=RenderTexture.active;RenderTexture.active=rt;var im=new Texture2D(1280,800,TextureFormat.RGBA32,false);im.ReadPixels(new Rect(0,0,1280,800),0,0);im.Apply();File.WriteAllBytes(Path.Combine(output,"unity-surfaces.png"),im.EncodeToPNG());RenderTexture.active=old;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(im);}
}
}
