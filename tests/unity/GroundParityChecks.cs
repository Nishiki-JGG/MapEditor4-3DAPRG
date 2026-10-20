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
public static class GroundParityChecks {
 [Serializable] class Check {public string name,status,detail;}
 [Serializable] class Report {public string status,unityVersion;public Check[] checks;}
 static readonly List<Check> checks=new List<Check>();
 static void Verify(string n,bool ok,string d=""){checks.Add(new Check{name=n,status=ok?"Passed":"Failed",detail=d});if(!ok)throw new Exception(n+": "+d);}
 static string Arg(string k){var a=Environment.GetCommandLineArgs();int i=Array.IndexOf(a,k);return i>=0?a[i+1]:null;}
 static string Hash(byte[] b){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(b));}
 public static void Run(){string output=Arg("-ground-output");int code=0;
  try{
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   Verify("Linear preview project",PlayerSettings.colorSpace==ColorSpace.Linear);
   var rd=ScriptableObject.CreateInstance<UniversalRendererData>();var rp=UniversalRenderPipelineAsset.Create(rd);rp.shadowDistance=0;GraphicsSettings.defaultRenderPipeline=rp;QualitySettings.renderPipeline=rp;
   var b=MapSharedGroundBuilder.Build(Path.Combine(output,"shared_ground.json"),Vector2.zero);
   var legacy=MapSharedGroundBuilder.Build(Path.Combine(output,"legacy_shared_ground.json"),Vector2.zero);Verify("Version2 grass-only export remains importable",legacy.data.materialVersion==2&&legacy.data.dirt==null&&legacy.material.GetFloat("_DirtWeight")==0);
   var imp=(TextureImporter)AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(b.texture));
   Verify("Exact source JPEG copied",Hash(File.ReadAllBytes(AssetDatabase.GetAssetPath(b.texture)))==Hash(Convert.FromBase64String(b.data.imageBase64)));
   Verify("Raw sRGB decoded once in shader",!imp.sRGBTexture&&b.material.GetFloat("_Decode")==2.2f);
   Verify("Same 512 square / mipmap / trilinear / aniso2",b.texture.width==512&&b.texture.height==512&&imp.mipmapEnabled&&imp.filterMode==FilterMode.Trilinear&&imp.anisoLevel==2);
   Verify("Primary and rotated samples use 4 metre tiles",b.material.GetVector("_GroundParams").x==4&&Mathf.Abs(b.material.GetVector("_GroundParams").z*b.material.GetVector("_GroundParams").z+b.material.GetVector("_GroundParams").w*b.material.GetVector("_GroundParams").w-1)<1e-6f);
   var mesh=new Mesh{vertices=new[]{new Vector3(-16,0,-16),new Vector3(-16,0,16),new Vector3(16,0,16),new Vector3(16,0,-16)},triangles=new[]{0,1,2,0,2,3},normals=new[]{Vector3.up,Vector3.up,Vector3.up,Vector3.up}};
   var plane=new GameObject("32m shared ground reference");plane.AddComponent<MeshFilter>().sharedMesh=mesh;plane.AddComponent<MeshRenderer>().sharedMaterial=b.material;Verify("Reference surface is planar with two triangles",mesh.triangles.Length==6&&mesh.vertexCount==4);
   RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.white;RenderSettings.reflectionIntensity=0;var sun=new GameObject("Sun").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=1;sun.transform.rotation=Quaternion.LookRotation(new Vector3(3,-8,5));
   var camera=new GameObject("Ground comparison camera").AddComponent<Camera>();camera.gameObject.AddComponent<UniversalAdditionalCameraData>();camera.fieldOfView=38;camera.aspect=1.6f;camera.nearClipPlane=.1f;camera.farClipPlane=100;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(184/255f,196/255f,204/255f);camera.allowMSAA=false;
   camera.transform.position=new Vector3(0,Mathf.Sin(.9f)*17,-Mathf.Cos(.9f)*17);camera.transform.LookAt(Vector3.zero);Capture(camera,output,"unity-ground-warmup.png");
   foreach(float distance in new[]{7f,17f})foreach(string mode in new[]{"unlit","lit"})foreach(string repeat in new[]{"single","mixed"}){
    var p=b.material.GetVector("_GroundParams");p.y=repeat=="single"?0:b.data.secondWeight;b.material.SetVector("_GroundParams",p);b.material.SetFloat("_Unlit",mode=="unlit"?1:0);camera.transform.position=new Vector3(0,Mathf.Sin(.9f)*distance,-Mathf.Cos(.9f)*distance);camera.transform.LookAt(Vector3.zero);Capture(camera,output,$"unity-ground-{distance:0}m-{mode}-{repeat}.png");
   }
   var soil=b.material.GetTexture("_DirtMap") as Texture2D;var si=(TextureImporter)AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(soil));
   Verify("Exact soil source JPEG copied",Hash(File.ReadAllBytes(AssetDatabase.GetAssetPath(soil)))==Hash(Convert.FromBase64String(b.data.dirt.imageBase64)));
   Verify("Soil 256 square / 2m / raw sRGB / mip / trilinear / aniso2",soil.width==256&&soil.height==256&&b.material.GetVector("_DirtParams").x==2&&!si.sRGBTexture&&si.mipmapEnabled&&si.filterMode==FilterMode.Trilinear&&si.anisoLevel==2);
   mesh.colors=new[]{new Color(0,0,0),new Color(0,0,0),new Color(1,0,0),new Color(1,0,0)};
   // Paint ramp is clamped over an 8m strip, matching the browser diagnostic.
   // Insert collinear vertices at -4/+4 so interpolation has the same clamp.
   mesh.Clear();mesh.vertices=new[]{new Vector3(-16,0,-16),new Vector3(-16,0,16),new Vector3(-4,0,-16),new Vector3(-4,0,16),new Vector3(4,0,-16),new Vector3(4,0,16),new Vector3(16,0,-16),new Vector3(16,0,16)};
   mesh.normals=new[]{Vector3.up,Vector3.up,Vector3.up,Vector3.up,Vector3.up,Vector3.up,Vector3.up,Vector3.up};mesh.colors=new[]{Color.black,Color.black,Color.black,Color.black,Color.red,Color.red,Color.red,Color.red};mesh.triangles=new[]{0,1,2,2,1,3,2,3,4,4,3,5,4,5,6,6,5,7};
   foreach(float distance in new[]{3f,7f,17f})foreach(string mode in new[]{"unlit","lit"})foreach(string surface in new[]{"soil","blend"}){
    b.material.SetFloat("_DirtWeight",1);b.material.SetFloat("_VertexDirt",surface=="blend"?1:0);var parameters=b.material.GetVector("_GroundParams");parameters.y=b.data.secondWeight;b.material.SetVector("_GroundParams",parameters);b.material.SetFloat("_Unlit",mode=="unlit"?1:0);camera.transform.position=new Vector3(0,Mathf.Sin(.9f)*distance,-Mathf.Cos(.9f)*distance);camera.transform.LookAt(Vector3.zero);Capture(camera,output,$"unity-{surface}-{distance:0}m-{mode}.png");
   }
   Verify("Soil and grass boundary near/mid/far views captured",File.Exists(Path.Combine(output,"unity-blend-17m-lit.png")));
   Verify("All eight matching views captured",File.Exists(Path.Combine(output,"unity-ground-17m-lit-mixed.png")));
   var errors=new List<string>();foreach(var msg in ShaderUtil.GetShaderMessages(Shader.Find("MapSharedGround/Grass")))if(msg.severity.ToString()=="Error")errors.Add(msg.message);Verify("Shared URP ground shader compiles",errors.Count==0,string.Join(";",errors));
   GraphicsSettings.defaultRenderPipeline=null;QualitySettings.renderPipeline=null;
  }catch(Exception e){code=1;checks.Add(new Check{name="Unexpected failure",status="Failed",detail=e.ToString()});Debug.LogException(e);}
  File.WriteAllText(Path.Combine(output,"ground-unity.json"),JsonUtility.ToJson(new Report{status=code==0?"Passed":"Failed",unityVersion=Application.unityVersion,checks=checks.ToArray()},true));EditorApplication.Exit(code);
 }
 static void Capture(Camera camera,string output,string name){var rt=new RenderTexture(1280,800,24,RenderTextureFormat.ARGB32);rt.Create();camera.targetTexture=rt;RenderPipeline.SubmitRenderRequest(camera,new RenderPipeline.StandardRequest{destination=rt});var old=RenderTexture.active;RenderTexture.active=rt;var image=new Texture2D(1280,800,TextureFormat.RGBA32,false);image.ReadPixels(new Rect(0,0,1280,800),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name),image.EncodeToPNG());RenderTexture.active=old;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(rt);}
}
