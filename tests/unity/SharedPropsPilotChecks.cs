using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using MapSharedProps.EditorTools;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

// Copy only into the isolated validation project. Requires URP 17.5; not a game runtime component.
public static class SharedPropsPilotChecks {
 [Serializable] class ExpectedInstance { public string instanceId; public float[] world; }
 [Serializable] class Fixture { public ExpectedInstance[] instances; }
 [Serializable] class Check { public string name, status, detail; }
 [Serializable] class Report { public string unityVersion, status; public Check[] checks; }
 static readonly List<Check> checks = new List<Check>();
 static void CheckIt(string name, bool ok, string detail = "") { checks.Add(new Check { name=name, status=ok?"Passed":"Failed", detail=detail }); if (!ok) throw new Exception(name+": "+detail); }
 static string Arg(string name) { var args=Environment.GetCommandLineArgs(); int ix=Array.IndexOf(args,name); return ix>=0&&ix+1<args.Length?args[ix+1]:null; }
 static string Hash(byte[] b) { using(var h=SHA256.Create()) return BitConverter.ToString(h.ComputeHash(b)).Replace("-", "").ToLowerInvariant(); }
 public static void Run() {
  string output=Arg("-pilot-output"), export=Arg("-pilot-export"); Directory.CreateDirectory(output);
  int exit=0;
  try {
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   var lib=MapSharedPropsBuilder.ReadLibrary(Path.Combine(export,"shared_props.json"));
   var result=MapSharedPropsBuilder.Build(export);
   CheckIt("Only pilot rows imported",result.placed==4&&result.skipped==1,result.placed+" / "+result.skipped);
   foreach(var a in lib.assets) {
    var go=result.prefabs[a.id];var mesh=go.GetComponent<MeshFilter>().sharedMesh;var mat=go.GetComponent<MeshRenderer>().sharedMaterial;
    CheckIt(a.id+" topology",mesh.vertexCount==a.positions.Length/3&&mesh.triangles.Length==a.triangles.Length,mesh.triangles.Length/3+" triangles");
    float error=0;var p=mesh.vertices;var n=mesh.normals;var c=mesh.colors;var uv=mesh.uv;
    for(int i=0;i<p.Length;i++) {int k=i*3;error=Mathf.Max(error,Mathf.Abs(p[i].x-a.positions[k]),Mathf.Abs(p[i].y-a.positions[k+1]),Mathf.Abs(p[i].z-a.positions[k+2]),Mathf.Abs(n[i].x-a.normals[k]),Mathf.Abs(n[i].y-a.normals[k+1]),Mathf.Abs(n[i].z-a.normals[k+2]),Mathf.Abs(c[i].r-a.colors[k]),Mathf.Abs(c[i].g-a.colors[k+1]),Mathf.Abs(c[i].b-a.colors[k+2]),Mathf.Abs(uv[i].x-a.uv[i*2]),Mathf.Abs(uv[i].y-a.uv[i*2+1]));}
    var tri=mesh.triangles;bool same=true;for(int i=0;i<tri.Length;i++)same&=tri[i]==a.triangles[i];
    CheckIt(a.id+" mesh/normal/colour/UV identity",error<1e-6f&&same,"max error="+error);
    CheckIt(a.id+" ground contact",Mathf.Abs(mesh.bounds.min.y)<1e-6f,"minY="+mesh.bounds.min.y);
    if(a.groundOffsets!=null)foreach(var g in a.groundOffsets){float min=float.PositiveInfinity;for(int i=g.firstVertex;i<g.firstVertex+g.count;i++)min=Mathf.Min(min,p[i].y);CheckIt("Rock lump contact "+g.firstVertex,Mathf.Abs(min)<1e-6f,"minY="+min);}
    var d=a.material;CheckIt(a.id+" diffuse material mapping",d.lighting=="lambert"&&!mat.HasProperty("_Roughness")&&!mat.HasProperty("_Metallic")&&mat.GetFloat("_Cutoff")==d.alphaCutoff&&mat.GetFloat("_Cull")== (d.doubleSided?0:2));
    var tx=Array.Find(lib.textures,t=>t.id==d.texture);string file=AssetDatabase.GetAssetPath(mat.GetTexture("_BaseMap"));
    var imp=(TextureImporter)AssetImporter.GetAtPath(file);
    CheckIt(a.id+" PNG identity and import settings",Hash(File.ReadAllBytes(file))==Hash(Convert.FromBase64String(tx.png))&&imp.sRGBTexture&&imp.mipmapEnabled==tx.mipmaps&&imp.filterMode==(tx.filter=="trilinear"?FilterMode.Trilinear:FilterMode.Bilinear)&&imp.textureCompression==TextureImporterCompression.Uncompressed);
   }
   var fixture=JsonUtility.FromJson<Fixture>(File.ReadAllText(Path.Combine(output,"unity-expected.json")));
   foreach(var item in fixture.instances) {
    var tr=result.root.transform.Find(item.instanceId);CheckIt("Placement exists "+item.instanceId,tr!=null);
    var verts=tr.GetComponent<MeshFilter>().sharedMesh.vertices;float error=0;
    for(int i=0;i<verts.Length;i++){var w=tr.TransformPoint(verts[i]);int k=i*3;error=Mathf.Max(error,Mathf.Abs(w.x-item.world[k]),Mathf.Abs(w.y-item.world[k+1]),Mathf.Abs(w.z-item.world[k+2]));}
    CheckIt("Browser/Unity world positions "+item.instanceId,error<.002f,"max metres="+error);
   }
   UnityEngine.Object.DestroyImmediate(result.root);
   var actors=new List<GameObject>();foreach(var id in new[]{"rock","fern"}) { var o=(GameObject)PrefabUtility.InstantiatePrefab(result.prefabs[id]);o.name=id;o.transform.position=new Vector3(id=="rock"?-1.4f:1.2f,0,0);actors.Add(o); }
   var plane=GameObject.CreatePrimitive(PrimitiveType.Cube);plane.transform.position=new Vector3(0,-.05f,0);plane.transform.localScale=new Vector3(8,.1f,6);
   var camera=new GameObject("Comparison camera").AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(184/255f,196/255f,204/255f);camera.orthographic=true;camera.orthographicSize=2;camera.nearClipPlane=.1f;camera.farClipPlane=100;
   var light=new GameObject("Comparison light").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1;light.shadows=LightShadows.None;light.transform.rotation=Quaternion.LookRotation(new Vector3(3,-5,4));
   RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.white;RenderSettings.reflectionIntensity=0;RenderSettings.sun=light;
   var ground=new Material(Shader.Find("Hidden/MapSharedProps/Reference"));ground.SetColor("_BaseColor",new Color(146/255f,156/255f,156/255f));plane.GetComponent<Renderer>().sharedMaterial=ground;
   Shoot(camera,output,"unity-builtin-front.png",false,false);Shoot(camera,output,"unity-builtin-back.png",true,false);
   var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();var pipeline=UniversalRenderPipelineAsset.Create(renderer);pipeline.shadowDistance=0;
   GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;camera.gameObject.AddComponent<UniversalAdditionalCameraData>();
   var urpGround=new Material(Shader.Find("Universal Render Pipeline/Unlit"));urpGround.SetColor("_BaseColor",new Color(146/255f,156/255f,156/255f));plane.GetComponent<Renderer>().sharedMaterial=urpGround;
   // The comparison browser has no environment map. Discard the first frame after a pipeline switch.
   Shoot(camera,output,"unity-urp-warmup.png",false,true);
   Shoot(camera,output,"unity-urp-front.png",false,true);Shoot(camera,output,"unity-urp-back.png",true,true);
   Diagnostics(camera,actors,plane,output);
   var sh=Shader.Find("MapSharedProps/Lit");var messages=ShaderUtil.GetShaderMessages(sh);var errors=new List<string>();foreach(var m in messages)if(m.severity.ToString()=="Error")errors.Add(m.message);
   CheckIt("Shared shader has no compilation errors",errors.Count==0,string.Join("; ",errors));
   CheckIt("Front/back views captured in Built-in and URP",File.Exists(Path.Combine(output,"unity-urp-back.png")));
   // Negative paths must stop before creating assets/scene objects.
   string bad=Path.Combine(output,"invalid-export");Directory.CreateDirectory(bad);File.WriteAllText(Path.Combine(bad,"shared_props.json"),"{\"schemaVersion\":99}");
   bool rejected=false;try{MapSharedPropsBuilder.Build(bad);}catch(InvalidDataException){rejected=true;}CheckIt("Unsupported version rejected",rejected);
   GraphicsSettings.defaultRenderPipeline=null;QualitySettings.renderPipeline=null;
   Debug.Log("SHARED_PROPS_PILOT_PASS");
  } catch(Exception e) {exit=1;checks.Add(new Check{name="Unexpected failure",status="Failed",detail=e.ToString()});Debug.LogException(e);}
  File.WriteAllText(Path.Combine(output,"unity-results.json"),JsonUtility.ToJson(new Report{unityVersion=Application.unityVersion,status=exit==0?"Passed":"Failed",checks=checks.ToArray()},true));
  EditorApplication.Exit(exit);
 }
 static void Diagnostics(Camera camera,List<GameObject> actors,GameObject plane,string output) {
  var reference=Shader.Find("Hidden/MapSharedProps/Reference");CheckIt("Unlit reference shader available",reference!=null&&reference.isSupported);
  var lit=new Material[actors.Count];
  for(int i=0;i<actors.Count;i++){var r=actors[i].GetComponent<Renderer>();lit[i]=r.sharedMaterial;var m=new Material(reference);m.SetTexture("_BaseMap",lit[i].GetTexture("_BaseMap"));m.SetFloat("_Cutoff",lit[i].GetFloat("_Cutoff"));m.SetFloat("_Cull",lit[i].GetFloat("_Cull"));r.sharedMaterial=m;}
  plane.SetActive(false);Shoot(camera,output,"unity-urp-unlit.png",false,true);
  foreach(var go in actors)go.SetActive(false);
  string imagePath="Assets/orientation.png";File.Copy(Path.Combine(output,"orientation.png"),imagePath,true);AssetDatabase.ImportAsset(imagePath,ImportAssetOptions.ForceSynchronousImport);
  var importer=(TextureImporter)AssetImporter.GetAtPath(imagePath);importer.sRGBTexture=true;importer.mipmapEnabled=false;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.filterMode=FilterMode.Bilinear;importer.wrapMode=TextureWrapMode.Clamp;importer.SaveAndReimport();
  var quad=new GameObject("Asymmetric orientation reference");var mesh=new Mesh{vertices=new[]{new Vector3(-1,0,0),new Vector3(-1,2,0),new Vector3(1,2,0),new Vector3(1,0,0)},uv=new[]{new Vector2(0,0),new Vector2(0,1),new Vector2(1,1),new Vector2(1,0)},triangles=new[]{0,1,2,0,2,3}};
  quad.AddComponent<MeshFilter>().sharedMesh=mesh;var qm=new Material(reference);qm.SetTexture("_BaseMap",AssetDatabase.LoadAssetAtPath<Texture2D>(imagePath));quad.AddComponent<MeshRenderer>().sharedMaterial=qm;
  camera.transform.position=new Vector3(0,1,-6);camera.transform.LookAt(new Vector3(0,1,0));Capture(camera,output,"unity-urp-orientation.png",true);quad.SetActive(false);
  CheckIt("Diagnostic ground top is actual y=0",Mathf.Abs(plane.GetComponent<Renderer>().bounds.max.y)<1e-6f);
  // Explicit front section of the y=0 ground: visible even when viewing exactly edge-on.
  var slice=new GameObject("Ground y=0 front section");var sliceMesh=new Mesh{vertices=new[]{new Vector3(-4,-.1f,-3),new Vector3(-4,0,-3),new Vector3(4,0,-3),new Vector3(4,-.1f,-3)},triangles=new[]{0,1,2,0,2,3}};
  slice.AddComponent<MeshFilter>().sharedMesh=sliceMesh;slice.AddComponent<MeshRenderer>().sharedMaterial=plane.GetComponent<Renderer>().sharedMaterial;
  CheckIt("Ground reference section upper edge y=0",Mathf.Abs(slice.GetComponent<Renderer>().bounds.max.y)<1e-6f);
  for(int i=0;i<actors.Count;i++) {
   var go=actors[i];go.SetActive(true);go.transform.position=Vector3.zero;camera.orthographicSize=1;camera.transform.position=new Vector3(0,.5f,-6);camera.transform.LookAt(new Vector3(0,.5f,0));
   CheckIt(go.name+" actual baseline contact",Mathf.Abs(go.GetComponent<Renderer>().bounds.min.y)<1e-6f);
   Capture(camera,output,"unity-urp-ground-"+go.name+".png",true);go.SetActive(false);
  }
  slice.SetActive(false);plane.SetActive(true);var fern=actors[1];fern.SetActive(true);fern.GetComponent<Renderer>().sharedMaterial=lit[1];camera.orthographic=false;camera.fieldOfView=38;
  foreach(var mode in new[]{"plant-7m","plant-17m","plant-17m-shift"}){float distance=mode=="plant-7m"?7:17,shift=mode.EndsWith("shift")?.01f:0;camera.transform.position=new Vector3(shift,.25f+Mathf.Sin(.9f)*distance,-Mathf.Cos(.9f)*distance);camera.transform.LookAt(new Vector3(shift,.25f,0));Capture(camera,output,"unity-urp-"+mode+".png",true);}
 }
 static void Shoot(Camera camera,string dir,string name,bool back,bool srp) {
  camera.transform.position=new Vector3(-.2f,2.5f,back?6:-6);camera.transform.LookAt(new Vector3(0,.35f,0));camera.aspect=1.6f;
  Capture(camera,dir,name,srp);
 }
 static void Capture(Camera camera,string dir,string name,bool srp) {
  camera.allowMSAA=false;
  var rt=new RenderTexture(1024,640,24,RenderTextureFormat.ARGB32);rt.Create();camera.targetTexture=rt;
  if(srp) {var request=new RenderPipeline.StandardRequest{destination=rt};RenderPipeline.SubmitRenderRequest(camera,request);}else camera.Render();
  var previous=RenderTexture.active;RenderTexture.active=rt;var image=new Texture2D(1024,640,TextureFormat.RGBA32,false);image.ReadPixels(new Rect(0,0,1024,640),0,0);image.Apply();
  File.WriteAllBytes(Path.Combine(dir,name),image.EncodeToPNG());RenderTexture.active=previous;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(image);
 }
}
