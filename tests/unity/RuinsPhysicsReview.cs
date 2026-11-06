using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
public static class RuinsPhysicsReview {
 [Serializable] public class Probe {public float x,y,z; public string id;}
 [Serializable] public class Probes {public Probe[] probes;}
 static void Check(bool b,string s){if(!b)throw new Exception(s);}
 static void Capture(Camera camera,Vector3 position,Vector3 target,string file){camera.transform.position=position;camera.transform.LookAt(target);var rt=new RenderTexture(960,720,24);camera.targetTexture=rt;camera.Render();var old=RenderTexture.active;RenderTexture.active=rt;var tx=new Texture2D(960,720,TextureFormat.RGB24,false);tx.ReadPixels(new Rect(0,0,960,720),0,0);tx.Apply();File.WriteAllBytes("Evidence/"+file,tx.EncodeToPNG());RenderTexture.active=old;camera.targetTexture=null;UnityEngine.Object.DestroyImmediate(tx);UnityEngine.Object.DestroyImmediate(rt);}
 public static void Run(){try{
  EditorSceneManager.OpenScene("Assets/RuinsTarget46Output/Room.unity");Physics.SyncTransforms();
  var terrain=UnityEngine.Object.FindAnyObjectByType<Terrain>();Check(terrain!=null,"Terrain missing");
  var wall=GameObject.Find("ruins_7");Check(wall!=null,"Wall sampling target missing");var wallCollider=wall.GetComponent<MeshCollider>();int wallSamples=0;for(float x=-3.4f;x<3.41f;x+=.068f)for(float y=.08f;y<1.5f;y+=.028f){var origin=wall.transform.TransformPoint(new Vector3(x,y,-1));var direction=wall.transform.TransformDirection(Vector3.forward);Check(Physics.Raycast(origin,direction,out var hit,.9f)&&hit.collider==wallCollider,"Hole or seam in wall face: "+x+","+y);wallSamples++;}File.WriteAllText("Evidence/wall-surface.json","{\"samples\":"+wallSamples+",\"misses\":0,\"pass\":true}");
  var original=AssetDatabase.LoadAssetAtPath<TerrainData>("Assets/RuinsTarget46Output/Source.asset");Check(original.GetAlphamaps(0,0,128,128).Cast<float>().SequenceEqual(terrain.terrainData.GetAlphamaps(0,0,128,128).Cast<float>()),"Scene terrain paint changed");
  Check(!Physics.CheckCapsule(new Vector3(2.8f,3.35f,-2),new Vector3(2.8f,4.35f,-2),.25f),"Wall cast must start outside rubble and other colliders");
  Check(Physics.CapsuleCast(new Vector3(2.8f,3.35f,-2),new Vector3(2.8f,4.35f,-2),.25f,Vector3.right,2),"Wall must block body approaching from clear floor");
  Check(!Physics.CheckCapsule(new Vector3(0,3.35f,4),new Vector3(0,4.35f,4),.25f),"Door opening must be clear");
  var probes=JsonUtility.FromJson<Probes>(File.ReadAllText("Assets/Editor/rubble-probes.json"));Check(probes.probes.Length>=40,"Expected rubble coverage");
  float maxRubbleDelta=0;foreach(var p in probes.probes){Check(Physics.Raycast(new Vector3(p.x,8,p.z),Vector3.down,out var hit,10),"Rubble ray miss");Check(hit.collider.name==p.id,"Unexpected rubble hit "+hit.collider.name);maxRubbleDelta=Math.Max(maxRubbleDelta,Math.Abs(hit.point.y-p.y));}
  Check(maxRubbleDelta<.001f,"Web/native rubble surface mismatch: "+maxRubbleDelta);File.WriteAllText("Evidence/rubble-physics.json",JsonUtility.ToJson(new RubbleResult{samples=probes.probes.Length,maxHeightDelta=maxRubbleDelta,pass=true}));
  var stairs=JsonUtility.FromJson<Probes>(File.ReadAllText("Assets/Editor/stair-probes.json"));float stairDelta=0;foreach(var p in stairs.probes){Check(Physics.Raycast(new Vector3(p.x,10,p.z),Vector3.down,out var hit,12),"Stair roof ray miss");Check(hit.collider.name==p.id,"Unexpected stair roof collider");stairDelta=Math.Max(stairDelta,Math.Abs(hit.point.y-p.y));}Check(stairs.probes.Length>400&&stairDelta<.001f,"Worn stair surface mismatch: "+stairDelta);File.WriteAllText("Evidence/stair-physics.json",JsonUtility.ToJson(new RubbleResult{samples=stairs.probes.Length,maxHeightDelta=stairDelta,pass=true}));
  var platformProbes=JsonUtility.FromJson<Probes>(File.ReadAllText("Assets/Editor/platform-probes.json"));float platformDelta=0;int visiblePlatform=0;
  foreach(var p in platformProbes.probes){var collider=GameObject.Find(p.id).GetComponent<MeshCollider>();Check(collider.Raycast(new Ray(new Vector3(p.x,10,p.z),Vector3.down),out var hit,12),"Platform roof ray miss");visiblePlatform++;platformDelta=Math.Max(platformDelta,Math.Abs(hit.point.y-p.y));}
  Check(visiblePlatform==platformProbes.probes.Length&&visiblePlatform>100&&platformDelta<.001f,"Platform worn edge differs from Web floor: "+platformDelta);File.WriteAllText("Evidence/platform-physics.json",JsonUtility.ToJson(new RubbleResult{samples=visiblePlatform,maxHeightDelta=platformDelta,pass=true}));
  var go=new GameObject("Validation capsule");go.transform.position=new Vector3(0,3.05f,7);var cc=go.AddComponent<CharacterController>();cc.radius=.25f;cc.height=1.6f;cc.center=Vector3.up*.8f;cc.stepOffset=.3f;cc.slopeLimit=45;cc.skinWidth=.01f;cc.minMoveDistance=0;
  for(int i=0;i<180;i++)cc.Move(new Vector3(0,-.025f,-.05f));
  var top=go.transform.position;Check(top.z< -1.9f&&Math.Abs(top.y-5.2f)<.08f,"CharacterController failed stairs: "+top);
  for(int i=0;i<180;i++)cc.Move(new Vector3(0,-.04f,.05f));var bottom=go.transform.position;Check(bottom.z>6.9f&&Math.Abs(bottom.y-3f)<.08f,"CharacterController failed descent: "+bottom);
  UnityEngine.Object.DestroyImmediate(go);
  var renderers=UnityEngine.Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None).Where(r=>r.name!="TerrainCaps").ToArray();
  Check(renderers.Length==48,"Reload renderer count: 46 retained plus two carved openings");
  Check(renderers.All(r=>r.GetComponent<MeshFilter>().sharedMesh==r.GetComponent<MeshCollider>().sharedMesh),"Collider must use visual geometry");
  Check(renderers.Select(r=>r.sharedMaterial.GetTexture("_BaseMap")).Distinct().Count()==1,"Reload shared stone color");
  Check(renderers.All(r=>r.sharedMaterial.GetTexture("_BumpMap")!=null&&r.sharedMaterial.GetTexture("_MetallicGlossMap")==r.sharedMaterial.GetTexture("_OcclusionMap")),"Reload stone maps");
  var camera=UnityEngine.Object.FindAnyObjectByType<Camera>();camera.orthographic=false;camera.backgroundColor=new Color(.075f,.085f,.1f);
  Capture(camera,new Vector3(15,20,19),new Vector3(0,3,0),"room-final.png");
  Capture(camera,new Vector3(3,5.4f,-7.2f),new Vector3(0,3.55f,-4.3f),"stone-broken-close.png");
  Capture(camera,new Vector3(0,6.2f,9),new Vector3(0,4.05f,4),"stone-opening-close.png");
  var light=UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None).First(l=>l.type==LightType.Directional);light.transform.rotation=Quaternion.Euler(50,200,0);
  Capture(camera,new Vector3(-15,20,-19),new Vector3(0,3,0),"stone-opposite.png");
  var facadeObject=GameObject.Find("ruins_17");Check(facadeObject!=null,"Platform facade target missing");var facadeCollider=facadeObject.GetComponent<MeshCollider>();int facadeSamples=0;
  foreach(int axis in new[]{0,2})foreach(int sign in new[]{-1,1}){float bound=axis==0?2:1.5f,span=axis==0?1.5f:2;for(float along=-span+.12f;along<span-.11f;along+=.04f)for(float y=.05f;y<2;y+=.025f){var q=axis==0?new Vector3(sign*(bound+.15f),y,along):new Vector3(along,y,sign*(bound+.15f));var direction=axis==0?new Vector3(-sign,0,0):new Vector3(0,0,-sign);Check(facadeCollider.Raycast(new Ray(facadeObject.transform.TransformPoint(q),facadeObject.transform.TransformDirection(direction)),out var hit,.251f),"Platform facade gap "+q);facadeSamples++;}}
  File.WriteAllText("Evidence/platform-facade.json","{\"pass\":true,\"samples\":"+facadeSamples+",\"misses\":0,\"maxRecessionMetres\":0.101}");
  File.WriteAllText("Evidence/physics.json","{\"pass\":true,\"wallBlocks\":true,\"doorClear\":true,\"characterControllerAscentDescent\":true,\"scenePaintPreserved\":true,\"playerBuild\":false}");EditorApplication.Exit(0);
 }catch(Exception e){File.WriteAllText("Evidence/physics-failure.txt",e.ToString());Debug.LogException(e);EditorApplication.Exit(1);}}
 [Serializable] public class RubbleResult {public int samples;public float maxHeightDelta;public bool pass;}
}
