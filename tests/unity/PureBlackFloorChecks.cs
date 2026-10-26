using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using MapSharedProps.EditorTools;
public static class PureBlackFloorChecks {
 [Serializable] class Check {public string name;public bool pass;public string detail;}
 [Serializable] class Report {public bool pass;public string unity;public Check[] checks;}
 static readonly List<Check> checks=new List<Check>();
 static void Verify(string name,bool ok,string detail=""){checks.Add(new Check{name=name,pass=ok,detail=detail});if(!ok)throw new Exception(name+": "+detail);}
 static string Arg(string key){var a=Environment.GetCommandLineArgs();return a[Array.IndexOf(a,key)+1];}
 public static void Setup(){var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,"Assets/BlackRenderer.asset");var pipeline=UniversalRenderPipelineAsset.Create(renderer);AssetDatabase.CreateAsset(pipeline,"Assets/BlackPipeline.asset");GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;AssetDatabase.SaveAssets();EditorApplication.Exit(0);}
 public static void Run(){string output=Arg("-black-output"),input=Arg("-black-export");int code=0;
 try{
  EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/BlackPipeline.asset");Verify("Persisted URP pipeline loaded",pipeline!=null);GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
  var ground=MapSharedGroundBuilder.Build(Path.Combine(input,"shared_ground.json"),new Vector2(12,12),input);var mat=ground.material;
  Verify("Exported pureblack contract enables unlit floor",mat.GetFloat("_PureBlackEnabled")==1);
  var mask=(Texture2D)mat.GetTexture("_PureBlackMask");var importer=(TextureImporter)AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(mask));
  Verify("Linear uncompressed clamp mask without mipmaps",!importer.sRGBTexture&&!importer.mipmapEnabled&&importer.textureCompression==TextureImporterCompression.Uncompressed&&importer.wrapMode==TextureWrapMode.Clamp);
  var mesh=new Mesh{vertices=new[]{new Vector3(0,0,0),new Vector3(0,0,24),new Vector3(24,0,24),new Vector3(24,0,0)},normals=new[]{Vector3.up,Vector3.up,Vector3.up,Vector3.up},triangles=new[]{0,1,2,0,2,3}};
  var floor=new GameObject("Exported floor");floor.AddComponent<MeshFilter>().sharedMesh=mesh;floor.AddComponent<MeshRenderer>().sharedMaterial=mat;
  var sun=new GameObject("Sun").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=7;sun.transform.rotation=Quaternion.Euler(50,30,0);sun.shadows=LightShadows.Soft;
  var torch=new GameObject("Torch point light").AddComponent<Light>();torch.type=LightType.Point;torch.transform.position=new Vector3(8,2,12);torch.range=20;torch.intensity=80;torch.color=new Color(1,.4f,.1f);
  RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.white;RenderSettings.reflectionIntensity=3;
  var camera=new GameObject("Camera").AddComponent<Camera>();camera.gameObject.AddComponent<UniversalAdditionalCameraData>();camera.orthographic=true;camera.orthographicSize=14;camera.transform.position=new Vector3(12,25,12);camera.transform.rotation=Quaternion.Euler(90,0,0);camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=Color.magenta;camera.allowMSAA=true;camera.nearClipPlane=.1f;camera.farClipPlane=80;
  Capture(camera,output,"unity-warmup.png",false);
  Capture(camera,output,"unity-bright.png",true);
  sun.intensity=0;torch.intensity=0;RenderSettings.ambientLight=Color.black;Capture(camera,output,"unity-dark.png",true);
  torch.intensity=80;Capture(camera,output,"unity-torch.png",true);
  sun.intensity=7;RenderSettings.fog=true;RenderSettings.fogColor=Color.white;RenderSettings.fogMode=FogMode.ExponentialSquared;RenderSettings.fogDensity=.3f;mat.SetFloat("_Unlit",1);Capture(camera,output,"unity-fog-unlit.png",true);
  // Asymmetric exported mask: left black, right existing grass, never flipped in X/Z.
  var last=Capture(camera,output,"unity-mask-boundary.png",true);Verify("Unpainted side stays visible",last.GetPixel(390,256).maxColorComponent>.01f);
  mat.SetFloat("_PureBlackEnabled",0);var old=Capture(camera,output,"unity-existing-ground.png",false);Verify("Disable restores previous floor at black-side sample",old.GetPixel(140,256).maxColorComponent>.01f);
  string legacy=Path.Combine(output,"legacy");Directory.CreateDirectory(legacy);File.Copy(Path.Combine(input,"shared_ground.json"),Path.Combine(legacy,"shared_ground.json"),true);var legacyGround=MapSharedGroundBuilder.Build(Path.Combine(legacy,"shared_ground.json"),new Vector2(12,12));Verify("Old exports default to no black floor",legacyGround.material.GetFloat("_PureBlackEnabled")==0);
  var errors=ShaderUtil.GetShaderMessages(Shader.Find("MapSharedGround/Grass")).Where(m=>m.severity.ToString()=="Error").Select(m=>m.message).ToArray();Verify("URP shader compiles",errors.Length==0,string.Join(";",errors));
 }catch(Exception e){code=1;checks.Add(new Check{name="Unexpected failure",pass=false,detail=e.ToString()});Debug.LogException(e);}
 File.WriteAllText(Path.Combine(output,"unity-verification.json"),JsonUtility.ToJson(new Report{pass=code==0,unity=Application.unityVersion,checks=checks.ToArray()},true));EditorApplication.Exit(code);
 }
 static Texture2D Capture(Camera camera,string output,string name,bool black){var rt=new RenderTexture(512,512,24,RenderTextureFormat.ARGB32);rt.Create();camera.targetTexture=rt;RenderPipeline.SubmitRenderRequest(camera,new RenderPipeline.StandardRequest{destination=rt});var previous=RenderTexture.active;RenderTexture.active=rt;var image=new Texture2D(512,512,TextureFormat.RGBA32,false);image.ReadPixels(new Rect(0,0,512,512),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name),image.EncodeToPNG());if(black){int bad=0,alpha=255,max=0;for(int y=224;y<288;y++)for(int x=112;x<176;x++){Color32 c=image.GetPixel(x,y);if(c.r!=0||c.g!=0||c.b!=0)bad++;max=Math.Max(max,Math.Max(c.r,Math.Max(c.g,c.b)));alpha=Math.Min(alpha,c.a);}Verify(name+" opaque RGB zero in 4096 pixels",bad==0&&alpha==255,"nonBlack="+bad+", max="+max+", minAlpha="+alpha);}RenderTexture.active=previous;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(rt);return image;}
}
