using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using MapFloorLinks.EditorTools;

namespace MapFloorLinks.Tests {
[InitializeOnLoad]
public static class FloorStairImportChecks {
 static string Input=>Arg("-stair-input"); static string Out=>Arg("-stair-out");
 static string Arg(string key){var a=Environment.GetCommandLineArgs();int i=Array.IndexOf(a,key);if(i<0||i+1>=a.Length)throw new Exception("Missing "+key);return a[i+1];}
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 static int route,tick,phase;static CharacterController player;static Transform stair;static float target,front;static float peak;static string[] ids={"floor_stairs_up","floor_stairs_down"};
 static FloorStairImportChecks(){EditorApplication.update+=Update;}
 public static void Run(){try {
  Directory.CreateDirectory(Out);EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var r=MapFloorLinksBuilder.Build(Input);Check(r.prefabs.Count==2,"Two prefabs");Check(r.placed>=2,"Two imported placements");
  foreach(var prefab in r.prefabs.Values){var portal=prefab.transform.Find("Portal (visual only)");Check(portal&&portal.GetComponentsInChildren<Collider>().Length==0,"Portal without collision");}
  foreach(var p in r.prefabs.Values){foreach(var f in p.GetComponentsInChildren<MeshFilter>()){Check(f.sharedMesh&&f.GetComponent<MeshRenderer>().sharedMaterial,"Mesh/material");var c=f.GetComponent<MeshCollider>();if(c)Check(c.sharedMesh==f.sharedMesh,"Collider parity");}}
  r.root.SetActive(false);
  for(int i=0;i<6;i++){string id=ids[i%2];var obj=(GameObject)PrefabUtility.InstantiatePrefab(r.prefabs[id]);obj.name="Route-"+i;obj.transform.position=new Vector3(i*14,0,0);obj.transform.rotation=Quaternion.Euler(0,new[]{0f,37f,90f}[i/2],0);
   float f=i%2==0?1.25f:.9f;var approach=GameObject.CreatePrimitive(PrimitiveType.Cube);approach.name="Approach";approach.transform.SetParent(obj.transform,false);approach.transform.localPosition=new Vector3(0,-.1f,(-6-f)/2);approach.transform.localScale=new Vector3(4,.2f,6-f);}
  Physics.SyncTransforms();AssetDatabase.SaveAssets();string scene=r.assetFolder+"/FloorStairReview.unity";Check(EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(),scene),"Scene saved");EditorSceneManager.OpenScene(scene);Check(GameObject.Find("Route-5"),"Reload routes");
  var light=new GameObject("Review sun").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.3f;light.transform.rotation=Quaternion.Euler(42,-30,0);RenderSettings.ambientLight=new Color(.35f,.38f,.42f);
  var camera=new GameObject("Review camera").AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.15f,.18f,.22f);camera.fieldOfView=42;camera.nearClipPlane=.05f;camera.farClipPlane=150;
  for(int i=0;i<2;i++){var t=GameObject.Find("Route-"+i).transform;foreach(var view in new[]{"front","back","overhead"}){Vector3 eye=view=="front"?new Vector3(7,5,-9):view=="back"?new Vector3(-7,4,10):new Vector3(.1f,14,1);camera.transform.position=t.TransformPoint(eye);camera.transform.LookAt(t.TransformPoint(new Vector3(0,i==0?1.2f:-.7f,1)));Shot(camera,Path.Combine(Out,ids[i]+"-"+view+".png"));}}
  ReviewUrp(camera);
  Check(ShaderUtil.GetShaderMessages(Shader.Find("MapFloorLinks/Portal")).All(m=>m.severity.ToString()!="Error"),"Portal shader compiled");
  UnityEngine.Object.DestroyImmediate(camera.gameObject);UnityEngine.Object.DestroyImmediate(light.gameObject);EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(),scene);
  SessionState.SetBool("FloorStairPending",true);EditorApplication.EnterPlaymode();
 }catch(Exception e){Fail(e);}}
 static void Shot(Camera c,string path){var rt=new RenderTexture(960,960,24);var old=RenderTexture.active;var tex=new Texture2D(960,960,TextureFormat.RGB24,false);try{c.targetTexture=rt;ShaderUtil.allowAsyncCompilation=false;if(GraphicsSettings.currentRenderPipeline!=null){for(int n=0;n<3;n++)RenderPipeline.SubmitRenderRequest(c,new RenderPipeline.StandardRequest{destination=rt});}else c.Render();RenderTexture.active=rt;tex.ReadPixels(new Rect(0,0,960,960),0,0);tex.Apply();Check(tex.GetPixels32().Count(x=>x.r>230&&x.b>230&&x.g<30)<100,"No pink shader pixels "+path);File.WriteAllBytes(path,tex.EncodeToPNG());}finally{c.targetTexture=null;RenderTexture.active=old;UnityEngine.Object.DestroyImmediate(tex);UnityEngine.Object.DestroyImmediate(rt);}}
 static void ReviewUrp(Camera camera){
  var old=GraphicsSettings.defaultRenderPipeline;var quality=QualitySettings.renderPipeline;
  var rendererType=Type.GetType("UnityEngine.Rendering.Universal.UniversalRendererData, Unity.RenderPipelines.Universal.Runtime",true);
  var pipelineType=Type.GetType("UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset, Unity.RenderPipelines.Universal.Runtime",true);
  var renderer=ScriptableObject.CreateInstance(rendererType);var create=pipelineType.GetMethods(System.Reflection.BindingFlags.Public|System.Reflection.BindingFlags.Static).First(m=>m.Name=="Create"&&m.GetParameters().Length==1);
  var pipeline=(RenderPipelineAsset)create.Invoke(null,new object[]{renderer});
  try{
   GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
   var r=MapFloorLinksBuilder.Build(Input);r.root.SetActive(false);
   for(int i=0;i<2;i++){var obj=(GameObject)PrefabUtility.InstantiatePrefab(r.prefabs[ids[i]]);obj.transform.position=new Vector3(150,0,0);foreach(var view in new[]{"front","back","overhead"}){var eye=view=="front"?new Vector3(7,5,-9):view=="back"?new Vector3(-7,4,10):new Vector3(.1f,14,1);camera.transform.position=obj.transform.TransformPoint(eye);camera.transform.LookAt(obj.transform.TransformPoint(new Vector3(0,i==0?1.2f:-.7f,1)));Shot(camera,Path.Combine(Out,ids[i]+"-urp-"+view+".png"));}UnityEngine.Object.DestroyImmediate(obj);}
  }finally{GraphicsSettings.defaultRenderPipeline=old;QualitySettings.renderPipeline=quality;UnityEngine.Object.DestroyImmediate(pipeline);UnityEngine.Object.DestroyImmediate(renderer);}
 }
 static void StartRoute(){stair=GameObject.Find("Route-"+route).transform;front=route%2==0?1.25f:.9f;target=route%2==0?3.25f:3.6f;var go=new GameObject("CharacterController route "+route);go.transform.position=stair.TransformPoint(new Vector3(0,.08f,-2));player=go.AddComponent<CharacterController>();player.radius=.22f;player.height=1.7f;player.center=new Vector3(0,.85f,0);player.stepOffset=.3f;player.skinWidth=.025f;player.slopeLimit=55;player.minMoveDistance=0;tick=phase=0;peak=0;}
 static void Update(){if(!SessionState.GetBool("FloorStairPending",false)||!EditorApplication.isPlaying||EditorApplication.isCompiling)return;try{
  if(!player)StartRoute();var local=stair.InverseTransformPoint(player.transform.position);peak=local.y;float dz=phase==0?.025f:-.025f;player.Move(stair.TransformDirection(new Vector3(0,-.04f,dz)));tick++;local=stair.InverseTransformPoint(player.transform.position);
  Check(tick<1500,"Route "+route+" stuck "+local+" phase "+phase);Check(Mathf.Abs(local.x)<.12f,"Center path drift");Check(local.y>-3,"Fell through floor");
  if(phase==0&&local.z>=target){Check(Mathf.Abs(local.y-(route%2==0?2.4f:-2.4f))<.15f,"Interior landing height "+local.y);phase=1;tick=0;}
  if(phase==1&&local.z<=-1.9f){Check(Mathf.Abs(local.y)<.15f,"Returned to approach "+local.y);File.AppendAllText(Path.Combine(Out,"walk-routes.txt"),"PASS route "+route+" yaw "+stair.eulerAngles.y+" forward and return\n");UnityEngine.Object.DestroyImmediate(player.gameObject);player=null;route++;if(route==6){SessionState.SetBool("FloorStairPending",false);File.WriteAllText(Path.Combine(Out,"floor-stair-checks.json"),"{\"pass\":true,\"prefabs\":2,\"routes\":6,\"directions\":12,\"rotations\":[0,37,90],\"characterController\":true,\"sceneReload\":true,\"views\":12,\"portalNoCollision\":true,\"builtInAndUrp\":true,\"playerBuild\":false}");EditorApplication.Exit(0);}}
 }catch(Exception e){Fail(e);}}
 static void Fail(Exception e){SessionState.SetBool("FloorStairPending",false);Directory.CreateDirectory(Out);File.WriteAllText(Path.Combine(Out,"floor-stair-error.txt"),e.ToString());Debug.LogException(e);EditorApplication.Exit(1);}
}
}