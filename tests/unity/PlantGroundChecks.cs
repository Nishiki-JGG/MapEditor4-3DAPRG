using System;
using System.IO;
using System.Collections.Generic;
using System.Security.Cryptography;
using MapSharedProps.EditorTools;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

// Isolated import/render acceptance; never copy into the game project.
public static class PlantGroundChecks {
 [Serializable] class Instance {public string instanceId;public float[] world;}
 [Serializable] class Fixture {public Instance[] instances;}
 [Serializable] class Check {public string name,status,detail;}
 [Serializable] class Report {public string status,unityVersion;public Check[] checks;}
 static readonly List<Check> checks=new List<Check>();
 static void Verify(string n,bool ok,string d=""){checks.Add(new Check{name=n,status=ok?"Passed":"Failed",detail=d});if(!ok)throw new Exception(n+": "+d);}
 static string Arg(string k){var a=Environment.GetCommandLineArgs();int i=Array.IndexOf(a,k);return i>=0?a[i+1]:null;}
 static string Hash(byte[] a){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(a));}
 public static void Run(){string output=Arg("-nature-output"),export=Arg("-nature-export");int code=0;Directory.CreateDirectory(output);
  try{
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   var lib=MapSharedPropsBuilder.ReadLibrary(Path.Combine(export,"shared_props.json"));var built=MapSharedPropsBuilder.Build(export);
   Verify("Nine shared assets imported",built.prefabs.Count==9);
   Verify("All three grass placements imported",built.placed==3&&built.skipped==0,built.placed+" / "+built.skipped);
   foreach(var a in lib.assets){var o=built.prefabs[a.id];var mesh=o.GetComponent<MeshFilter>().sharedMesh;var mat=o.GetComponent<Renderer>().sharedMaterial;var p=mesh.vertices;var n=mesh.normals;var c=mesh.colors;var uv=mesh.uv;var ix=mesh.triangles;float error=0;
    for(int i=0;i<p.Length;i++){int k=i*3;error=Mathf.Max(error,Mathf.Abs(p[i].x-a.positions[k]),Mathf.Abs(p[i].y-a.positions[k+1]),Mathf.Abs(p[i].z-a.positions[k+2]),Mathf.Abs(n[i].x-a.normals[k]),Mathf.Abs(n[i].y-a.normals[k+1]),Mathf.Abs(n[i].z-a.normals[k+2]),Mathf.Abs(c[i].r-a.colors[k]),Mathf.Abs(c[i].g-a.colors[k+1]),Mathf.Abs(c[i].b-a.colors[k+2]),Mathf.Abs(uv[i].x-a.uv[i*2]),Mathf.Abs(uv[i].y-a.uv[i*2+1]));}
    bool same=ix.Length==a.triangles.Length;for(int i=0;i<ix.Length;i++)same&=ix[i]==a.triangles[i];
    Verify(a.id+" exact geometry/normal/colour/UV/winding",same&&error<1e-6f,"max="+error+", triangles="+ix.Length/3);
    Verify(a.id+" ground pivot",Mathf.Abs(mesh.bounds.min.y)<1e-6f,"minY="+mesh.bounds.min.y);
    Verify(a.id+" one diffuse material",o.GetComponent<Renderer>().sharedMaterials.Length==1&&!mat.HasProperty("_Metallic")&&mat.GetFloat("_Cutoff")==a.material.alphaCutoff);
    var t=Array.Find(lib.textures,x=>x.id==a.material.texture);string f=AssetDatabase.GetAssetPath(mat.GetTexture("_BaseMap"));var imp=(TextureImporter)AssetImporter.GetAtPath(f);
    Verify(a.id+" exact PNG/filter/mips",Hash(File.ReadAllBytes(f))==Hash(Convert.FromBase64String(t.png))&&imp.sRGBTexture&&imp.mipmapEnabled==t.mipmaps&&imp.filterMode==(t.filter=="trilinear"?FilterMode.Trilinear:FilterMode.Bilinear),imp.filterMode+", mips="+imp.mipmapEnabled);
   }
   var pine=Array.Find(lib.assets,a=>a.id=="pine");float lowest=float.PositiveInfinity;
   for(int i=0;i<pine.positions.Length/3;i++)if(pine.uv[i*2+1]>.5f)lowest=Mathf.Min(lowest,pine.positions[i*3+1]);
   Verify("Pine branch clearance above 2.1m",lowest>=2.1f,"lowest="+lowest+", 1.8m agent head gap="+(lowest-1.8f));
   Verify("Pine and woody props share one imported texture",built.prefabs["pine"].GetComponent<Renderer>().sharedMaterial.GetTexture("_BaseMap")==built.prefabs["log"].GetComponent<Renderer>().sharedMaterial.GetTexture("_BaseMap"));
   var fixture=JsonUtility.FromJson<Fixture>(File.ReadAllText(Path.Combine(output,"ground-expected.json")));
   foreach(var item in fixture.instances){var tr=built.root.transform.Find(item.instanceId);Verify("Placement exists "+item.instanceId,tr!=null);var v=tr.GetComponent<MeshFilter>().sharedMesh.vertices;float error=0;for(int i=0;i<v.Length;i++){var w=tr.TransformPoint(v[i]);int k=i*3;error=Mathf.Max(error,Mathf.Abs(w.x-item.world[k]),Mathf.Abs(w.y-item.world[k+1]),Mathf.Abs(w.z-item.world[k+2]));}Verify("World placement "+item.instanceId,error<.002f,"max metres="+error);}
   UnityEngine.Object.DestroyImmediate(built.root);
   var rd=ScriptableObject.CreateInstance<UniversalRendererData>();var rp=UniversalRenderPipelineAsset.Create(rd);rp.shadowDistance=30;GraphicsSettings.defaultRenderPipeline=rp;QualitySettings.renderPipeline=rp;
   RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.white;RenderSettings.reflectionIntensity=0;
   var light=new GameObject("Sun").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1;light.shadows=LightShadows.Hard;light.transform.rotation=Quaternion.LookRotation(new Vector3(3,-8,5));
   var camera=new GameObject("Nature comparison camera").AddComponent<Camera>();camera.gameObject.AddComponent<UniversalAdditionalCameraData>();camera.orthographic=true;camera.orthographicSize=4;camera.aspect=1.6f;camera.backgroundColor=new Color(184/255f,196/255f,204/255f);camera.clearFlags=CameraClearFlags.SolidColor;camera.nearClipPlane=.1f;camera.farClipPlane=100;camera.transform.position=new Vector3(0,5,-15);camera.transform.LookAt(new Vector3(0,3,0));
   var ground=GameObject.CreatePrimitive(PrimitiveType.Cube);ground.transform.localScale=new Vector3(30,.1f,20);ground.transform.position=new Vector3(0,-.05f,0);var gm=new Material(Shader.Find("Universal Render Pipeline/Lit"));gm.SetColor("_BaseColor",new Color(.53f,.6f,.45f));ground.GetComponent<Renderer>().sharedMaterial=gm;
   var human=GameObject.CreatePrimitive(PrimitiveType.Capsule);human.transform.position=new Vector3(.9f,.9f,.2f);human.transform.localScale=new Vector3(.3f,.9f,.3f);
   camera.orthographic=false;camera.fieldOfView=38;camera.aspect=1.6f;
   foreach(var id in new[]{"grass","reed","flowers"}){
    var o=(GameObject)PrefabUtility.InstantiatePrefab(built.prefabs[id]);var a=Array.Find(lib.assets,x=>x.id==id);var material=o.GetComponent<Renderer>().sharedMaterial;var mesh=o.GetComponent<MeshFilter>().sharedMesh;
    Verify(id+" wind band supports all mesh UVs",material.GetVector("_PineBand").w==2&&material.GetVector("_PineBand").x==.06f);
    ProbeWind(a,mesh,material);
    foreach(float pitch in new[]{Mathf.PI/2,.9f}){camera.transform.position=new Vector3(0,Mathf.Sin(pitch)*4,-Mathf.Cos(pitch)*4);camera.transform.rotation=Quaternion.LookRotation(-camera.transform.position,Vector3.forward);Shader.SetGlobalVector("_TDPineWind",Vector4.zero);Capture(camera,output,"unity-"+id+(pitch>1.5f?"-top":"-oblique")+".png");}
    camera.transform.position=new Vector3(0,4,-3);camera.transform.LookAt(Vector3.zero);
    var band=material.GetVector("_PineBand");material.SetVector("_PineBand",new Vector4(band.x,band.y,band.z,0));Shader.SetGlobalVector("_TDPineWind",Vector4.zero);Capture(camera,output,"unity-"+id+"-static.png");material.SetVector("_PineBand",band);Capture(camera,output,"unity-"+id+"-off.png");
    foreach(float t in new[]{0f,.5f}){Shader.SetGlobalVector("_TDPineWind",new Vector4(.8f,.6f,1,t));Capture(camera,output,"unity-"+id+"-wind-"+t.ToString("0.0",System.Globalization.CultureInfo.InvariantCulture)+".png");}
    UnityEngine.Object.DestroyImmediate(o);
   }
   var errors=new List<string>();foreach(var msg in ShaderUtil.GetShaderMessages(Shader.Find("MapSharedProps/Lit")))if(msg.severity.ToString()=="Error")errors.Add(msg.message);Verify("URP shared shader compiles",errors.Count==0,string.Join(";",errors));
   GraphicsSettings.defaultRenderPipeline=null;QualitySettings.renderPipeline=null;
  }catch(Exception e){code=1;checks.Add(new Check{name="Unexpected failure",status="Failed",detail=e.ToString()});Debug.LogException(e);}
  File.WriteAllText(Path.Combine(output,"ground-unity.json"),JsonUtility.ToJson(new Report{status=code==0?"Passed":"Failed",unityVersion=Application.unityVersion,checks=checks.ToArray()},true));EditorApplication.Exit(code);
 }
 static void ProbeWind(MapSharedPropsBuilder.AssetDto a,Mesh mesh,Material real){
  int n=mesh.vertexCount;var input=new Texture2D(n,1,TextureFormat.RGBAFloat,false,true);input.filterMode=FilterMode.Point;input.wrapMode=TextureWrapMode.Clamp;var data=new Color[n];for(int i=0;i<n;i++)data[i]=new Color(a.positions[i*3],a.positions[i*3+1],a.positions[i*3+2],a.uv[i*2+1]);input.SetPixels(data);input.Apply();
  var probe=new Material(Shader.Find("Hidden/MapSharedProps/PineWindProbe"));probe.SetVector("_PineBand",real.GetVector("_PineBand"));probe.SetVector("_PineWaves",real.GetVector("_PineWaves"));probe.SetVector("_PinePhase",real.GetVector("_PinePhase"));var matrix=Matrix4x4.TRS(new Vector3(2,0,3),Quaternion.Euler(0,-.7f*Mathf.Rad2Deg,0),new Vector3(1.3f,.8f,1.3f));probe.SetMatrix("_ProbeMatrix",matrix);Shader.SetGlobalVector("_TDPineOrigin",Vector4.zero);Shader.SetGlobalVector("_TDPineWind",new Vector4(.8f,.6f,1,.5f));
  var rt=new RenderTexture(n,1,0,RenderTextureFormat.ARGBFloat,RenderTextureReadWrite.Linear);rt.Create();Graphics.Blit(input,rt,probe);var previous=RenderTexture.active;RenderTexture.active=rt;var read=new Texture2D(n,1,TextureFormat.RGBAFloat,false,true);read.ReadPixels(new Rect(0,0,n,1),0,0);read.Apply();var pixels=read.GetPixels();float error=0,rootError=0;int roots=0;
  for(int i=0;i<n;i++){var source=new Vector3(a.positions[i*3],a.positions[i*3+1],a.positions[i*3+2]);var expected=matrix.MultiplyPoint3x4(source);float w=Mathf.SmoothStep(0,1,Mathf.InverseLerp(a.wind.minY,a.wind.maxY,source.y));float phase=2*.17f+3*.13f,gust=.65f*Mathf.Sin(.5f*1.7f+phase)+.35f*Mathf.Sin(.5f*2.9f+phase);expected+=new Vector3(.8f,0,.6f)*(a.wind.maxDisplacementMetres*w*gust);error=Mathf.Max(error,Vector3.Distance(expected,new Vector3(pixels[i].r,pixels[i].g,pixels[i].b)));if(source.y<=a.wind.minY){roots++;rootError=Mathf.Max(rootError,Vector3.Distance(matrix.MultiplyPoint3x4(source),new Vector3(pixels[i].r,pixels[i].g,pixels[i].b)));}}
  Verify(a.id+" GPU wind and fixed roots",error<.00002f&&rootError<.00002f&&roots>0,"max metres="+error+", root metres="+rootError+", root vertices="+roots);RenderTexture.active=previous;rt.Release();UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(read);UnityEngine.Object.DestroyImmediate(input);UnityEngine.Object.DestroyImmediate(probe);
 }
 static void Capture(Camera camera,string folder,string name){var rt=new RenderTexture(1280,800,24,RenderTextureFormat.ARGB32);rt.Create();camera.targetTexture=rt;camera.allowMSAA=false;RenderPipeline.SubmitRenderRequest(camera,new RenderPipeline.StandardRequest{destination=rt});var old=RenderTexture.active;RenderTexture.active=rt;var im=new Texture2D(1280,800,TextureFormat.RGBA32,false);im.ReadPixels(new Rect(0,0,1280,800),0,0);im.Apply();File.WriteAllBytes(Path.Combine(folder,name),im.EncodeToPNG());RenderTexture.active=old;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(im);}
}
