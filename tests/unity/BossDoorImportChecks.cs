// 専用隔離プロジェクトでのみ実行。元ゲームのシーン・設定は保存しない。
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
public static class BossDoorImportChecks {
 static void Check(bool ok,string why){if(!ok)throw new Exception(why);}
 static string Arg(string key){var args=Environment.GetCommandLineArgs();int i=Array.IndexOf(args,key);Check(i>=0&&i+1<args.Length,"Missing "+key);return args[i+1];}
 static void Shot(Camera camera,string path){ShaderUtil.allowAsyncCompilation=false;var rt=new RenderTexture(1200,900,24,RenderTextureFormat.ARGB32,RenderTextureReadWrite.sRGB);var previous=RenderTexture.active;try{rt.Create();camera.targetTexture=rt;for(int i=0;i<3;i++)RenderPipeline.SubmitRenderRequest(camera,new RenderPipeline.StandardRequest{destination=rt});RenderTexture.active=rt;var image=new Texture2D(1200,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1200,900),0,0);image.Apply();Check(image.GetPixels32().Select(c=>(int)c.r+c.g+c.b).Max()>50,"Rendered pixels are not black: "+path);Check(image.GetPixels32().Count(c=>c.r>230&&c.b>230&&c.g<30)<100,"No error-shader pink pixels: "+path);File.WriteAllBytes(path,image.EncodeToPNG());UnityEngine.Object.DestroyImmediate(image);}finally{RenderTexture.active=previous;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(rt);}}
 public static void Run(){
  string root=Path.GetFullPath(Path.Combine(Application.dataPath,"..")),outDir=Path.Combine(root,"Evidence"),folder="Assets/BossDoorsImported-"+DateTime.UtcNow.ToString("yyyyMMddHHmmss");
  var originalPipeline=GraphicsSettings.defaultRenderPipeline;var originalQuality=QualitySettings.renderPipeline;
  try{
   Directory.CreateDirectory(outDir);string input=Arg("-bossExportDir");
   var data=SmallPropsV1.Read(Path.Combine(input,"small_props.json"));Check(data.bossDoorsV1!=null&&data.bossDoorsV1.assets.Length==2,"Both doors survived complete shared-library reader");
   var d=data.bossDoorsV1;Check(BossDoorsV1.Optional(null)==null,"Old export without doors");
   var broken=JsonUtility.FromJson<BossDoorsV1.Data>(JsonUtility.ToJson(d));broken.assets[0].positions[0]=float.NaN;Check(BossDoorsV1.Optional(broken)==null,"Invalid optional data rejected");
   var custom=JsonUtility.FromJson<BossDoorsV1.Data>(JsonUtility.ToJson(d));custom.assets=custom.assets.Where(a=>a.id=="boss_stone_door").ToArray();custom.assets[0].radius=0;Check(BossDoorsV1.Optional(custom)!=null,"Non-solid catalog supported");
   Check(!AssetDatabase.IsValidFolder(folder),"Use fresh dedicated output");AssetDatabase.CreateFolder("Assets",Path.GetFileName(folder));EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   string fixture=Path.Combine(root,"BossInputFixture");Directory.CreateDirectory(fixture);var rows=new List<string>{"instanceId,typeId,assetKey,x,y,z,yawDeg,scale,scaleY,variant,seed"};
   for(int k=0;k<2;k++)for(int i=0;i<3;i++){float scale=new[]{.75f,1f,1.4f}[i];rows.Add(string.Join(",",new[]{"door-"+k+"-"+i,d.assets[k].id,d.assets[k].assetKey,(k*30+i*10).ToString(System.Globalization.CultureInfo.InvariantCulture),"0","0",new[]{0,37,90}[i].ToString(),scale.ToString(System.Globalization.CultureInfo.InvariantCulture),(scale*1.1f).ToString(System.Globalization.CultureInfo.InvariantCulture),"0","0"}));}
   var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();var pipeline=UniversalRenderPipelineAsset.Create(renderer);GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
   File.WriteAllLines(Path.Combine(fixture,"props.csv"),rows);var holder=new GameObject("Boss door test instances");var prefabs=new Dictionary<string,GameObject>();int placed=BossDoorsV1.Build(fixture,folder,holder.transform,prefabs,data);Check(placed==6&&prefabs.Count==2,"Two prefabs / six placements");
   var materials=prefabs.Values.Select(v=>v.GetComponent<MeshRenderer>().sharedMaterial).Distinct().ToArray();Check(materials.Length==1,"One shared PBR material");
   foreach(var a in d.assets){var prefab=prefabs[a.id];var mesh=prefab.GetComponent<MeshFilter>().sharedMesh;Check(mesh.vertexCount==a.positions.Length/3&&mesh.triangles.Length==a.triangles.Length,"Export geometry parity "+a.id);Check(prefab.GetComponent<MeshCollider>().sharedMesh==mesh,"Visual/collider mesh identity "+a.id);Check(prefab.GetComponent<MeshRenderer>().shadowCastingMode==ShadowCastingMode.On,"Shadows "+a.id);}
   Physics.SyncTransforms();foreach(Transform instance in holder.transform){var c=instance.GetComponent<MeshCollider>();var ray=new Ray(instance.TransformPoint(new Vector3(.45f,1.5f,-5)),instance.forward);Check(c.Raycast(ray,out var hit,15),"Leaf board blocks at yaw/scale "+instance.name);var centre=new Ray(instance.TransformPoint(new Vector3(0,1.5f,-5)),instance.forward);Check(Physics.SphereCast(centre,.25f,out var bodyHit,15)&&bodyHit.collider==c,"Player-width cast blocked at central seam "+instance.name);}
   GraphicsSettings.defaultRenderPipeline=originalPipeline;QualitySettings.renderPipeline=originalQuality;AssetDatabase.SaveAssets();string scene=folder+"/BossDoors.unity";EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(),scene);EditorSceneManager.OpenScene(scene);holder=GameObject.Find("Boss door test instances");Check(holder&&holder.transform.childCount==6,"Scene reload retains placements");foreach(Transform instance in holder.transform)Check(instance.GetComponent<MeshCollider>().sharedMesh==instance.GetComponent<MeshFilter>().sharedMesh,"Reload keeps shared meshes");
   // Review camera uses a transient pipeline; original ProjectSettings restored before exit.
   renderer=ScriptableObject.CreateInstance<UniversalRendererData>();pipeline=UniversalRenderPipelineAsset.Create(renderer);GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;Check(GraphicsSettings.currentRenderPipeline!=null,"URP active after scene reload");
   holder.SetActive(false);var sun=new GameObject("Review sunlight").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=2;sun.transform.rotation=Quaternion.Euler(45,-35,0);sun.shadows=LightShadows.Soft;RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.28f,.31f,.36f);RenderSettings.reflectionIntensity=1;
   var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);ground.transform.localScale=Vector3.one*4;var groundMat=new Material(Shader.Find("Universal Render Pipeline/Lit"));groundMat.SetColor("_BaseColor",new Color(.18f,.20f,.22f));ground.GetComponent<Renderer>().sharedMaterial=groundMat;
   var camera=new GameObject("Review camera").AddComponent<Camera>();camera.gameObject.AddComponent<UniversalAdditionalCameraData>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.12f,.14f,.18f);camera.fieldOfView=38;camera.nearClipPlane=.1f;camera.farClipPlane=100;
   foreach(var a in d.assets){var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefabs[a.id]);obj.transform.position=Vector3.zero;foreach(var view in new[]{"front","back","overhead"}){camera.transform.position=view=="front"?new Vector3(8,6,-12):view=="back"?new Vector3(-8,6,12):new Vector3(.1f,16,-2);camera.transform.LookAt(new Vector3(0,a.height*.42f,0));Shot(camera,Path.Combine(outDir,a.id+"-"+view+".png"));}UnityEngine.Object.DestroyImmediate(obj);}
   var shader=materials[0].shader;var errors=ShaderUtil.GetShaderMessages(shader).Where(m=>m.severity.ToString()=="Error").ToArray();Check(errors.Length==0,"Shader errors: "+string.Join(";",errors.Select(m=>m.message)));Check(shader.isSupported,"Shader supported");
   File.WriteAllText(Path.Combine(outDir,"boss-import-checks.json"),"{\"pass\":true,\"unity\":\""+Application.unityVersion+"\",\"prefabs\":2,\"placements\":6,\"sharedMaterial\":true,\"meshColliderParity\":true,\"rotatedScaledRaycasts\":6,\"playerWidthSphereCasts\":6,\"sceneReload\":true,\"shaderErrors\":0,\"renderViews\":6,\"playerBuild\":false}");
   GraphicsSettings.defaultRenderPipeline=originalPipeline;QualitySettings.renderPipeline=originalQuality;EditorApplication.Exit(0);
  }catch(Exception e){GraphicsSettings.defaultRenderPipeline=originalPipeline;QualitySettings.renderPipeline=originalQuality;File.WriteAllText(Path.Combine(outDir,"boss-import-error.txt"),e.ToString());Debug.LogException(e);EditorApplication.Exit(1);}
 }
}
