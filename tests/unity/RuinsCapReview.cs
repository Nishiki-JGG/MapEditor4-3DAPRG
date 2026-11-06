using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using MapRuins.EditorTools;
public static class RuinsCapReview {
 static void Check(bool b,string s){if(!b)throw new Exception(s);}
 static string Arg(string k){var a=Environment.GetCommandLineArgs();return a[Array.IndexOf(a,k)+1];}
 static Color32[] Render(Camera c,string file){var rt=new RenderTexture(720,720,24);c.targetTexture=rt;c.Render();var old=RenderTexture.active;RenderTexture.active=rt;var t=new Texture2D(720,720,TextureFormat.RGB24,false);t.ReadPixels(new Rect(0,0,720,720),0,0);t.Apply();var pixels=t.GetPixels32();File.WriteAllBytes(file,t.EncodeToPNG());RenderTexture.active=old;c.targetTexture=null;UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(t);return pixels;}
 public static void Run(){string evidence=Path.GetFullPath("Evidence/Cap");Directory.CreateDirectory(evidence);try{
  const string dest="Assets/RuinsTarget46Output";Check(!AssetDatabase.IsValidFolder(dest),"Existing output retained");Directory.CreateDirectory(dest);AssetDatabase.Refresh();
  EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/RuinsReviewOutput/Pipeline.asset");GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
  var original=AssetDatabase.LoadAssetAtPath<TerrainData>("Assets/RuinsReviewOutput/SourceTerrain.asset");var source=UnityEngine.Object.Instantiate(original);AssetDatabase.CreateAsset(source,dest+"/Source.asset");
  var layers=new TerrainLayer[5];for(int k=0;k<5;k++){var t=new Texture2D(16,16,TextureFormat.RGBA32,true,false){name="Layer"+k,wrapMode=TextureWrapMode.Repeat};var pixels=new Color[256];for(int j=0;j<16;j++)for(int i=0;i<16;i++)pixels[j*16+i]=Color.HSVToRGB(.13f*k+.04f,.35f,(i<8 ^ j<8)?.4f:.52f);t.SetPixels(pixels);t.Apply();AssetDatabase.CreateAsset(t,dest+"/Color"+k+".asset");var l=new TerrainLayer{diffuseTexture=t,tileSize=new Vector2(3+k*.3f,4),tileOffset=new Vector2(.2f*k,.17f),smoothness=.1f,smoothnessSource=TerrainLayerSmoothnessSource.ConstantOnly};AssetDatabase.CreateAsset(l,dest+"/Layer"+k+".terrainlayer");layers[k]=l;}
  source.terrainLayers=layers;source.alphamapResolution=128;var a=new float[128,128,5];for(int z=0;z<128;z++)for(int x=0;x<128;x++){float v=(x+z)/254f;a[z,x,0]=1-v;a[z,x,4]=v;}source.SetAlphamaps(0,0,a);
  var terrain=Terrain.CreateTerrainGameObject(source).GetComponent<Terrain>();terrain.transform.position=new Vector3(-12,3,-12);terrain.drawInstanced=false;terrain.heightmapPixelError=1;terrain.basemapDistance=10000;
  var template=new Material(Shader.Find("Universal Render Pipeline/Terrain/Lit"));AssetDatabase.CreateAsset(template,dest+"/Terrain.mat");terrain.materialTemplate=template;
  var sun=new GameObject("Sun").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=1;sun.transform.rotation=Quaternion.Euler(65,20,0);RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.gray*.3f;
  var camera=new GameObject("Camera").AddComponent<Camera>();camera.orthographic=true;camera.orthographicSize=12;camera.transform.position=new Vector3(0,35,0);camera.transform.rotation=Quaternion.Euler(90,0,0);camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=Color.magenta;camera.gameObject.AddComponent<UniversalAdditionalCameraData>();
  var before=Render(camera,Path.Combine(evidence,"terrain.png"));
  var data=RuinsStructureImporter.Preflight(Arg("-ruinsExportDir"),new HashSet<string>{"separateAuthoringV1","ruinsStructuresV1"});var root=RuinsStructureImporter.Build(data,terrain,dest+"/Structures");
  var structureRenderers=root.GetComponentsInChildren<MeshRenderer>().Where(v=>v.name!="TerrainCaps").ToArray();
  if(data.surface!=null&&!string.IsNullOrEmpty(data.surface.id)){
   Check(structureRenderers.Select(v=>v.sharedMaterial.GetTexture("_BaseMap")).Distinct().Count()==1,"Stone color not shared");
   foreach(var r in structureRenderers){var m=r.sharedMaterial;Check(m.GetTexture("_BaseMap")!=null&&m.GetTexture("_BumpMap")!=null&&m.GetTexture("_MetallicGlossMap")==m.GetTexture("_OcclusionMap"),"Stone maps missing");Check(m.IsKeywordEnabled("_NORMALMAP")&&m.IsKeywordEnabled("_METALLICSPECGLOSSMAP"),"Stone keywords");var mesh=r.GetComponent<MeshFilter>().sharedMesh;Check(mesh.tangents.Length==mesh.vertexCount&&mesh.tangents.All(t=>!float.IsNaN(t.x)&&Math.Abs(t.w)==1),"Stone tangents");var ni=(TextureImporter)AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(m.GetTexture("_BumpMap")));Check(ni.textureType==TextureImporterType.NormalMap&&!ni.sRGBTexture,"Normal texture contract");}
  }
  Check(source.GetAlphamaps(0,0,128,128).Cast<float>().SequenceEqual(terrain.terrainData.GetAlphamaps(0,0,128,128).Cast<float>()),"Terrain layer weights changed on clone/save");
  var cap=root.transform.Find("TerrainCaps").GetComponent<MeshRenderer>();Check(cap.sharedMaterials.Length==2,"Five layers require two passes");Check(cap.sharedMaterials[0].GetTexture("_Control")==terrain.terrainData.GetAlphamapTexture(0),"Control texture sharing");
  var plane=new Mesh{name="ParityPlane"};plane.vertices=new[]{new Vector3(-12,0,-12),new Vector3(-12,0,12),new Vector3(12,0,12),new Vector3(12,0,-12)};plane.triangles=new[]{0,1,2,0,2,3};plane.normals=Enumerable.Repeat(Vector3.up,4).ToArray();plane.uv=new[]{Vector2.zero,Vector2.up,Vector2.one,Vector2.right};plane.RecalculateBounds();
  var meshObject=new GameObject("ParityOnly");meshObject.AddComponent<MeshFilter>().sharedMesh=plane;meshObject.AddComponent<MeshRenderer>().sharedMaterials=cap.sharedMaterials;meshObject.transform.position=Vector3.up*(source.GetHeight(0,0)+terrain.transform.position.y);root.SetActive(false);terrain.drawHeightmap=false;
  var after=Render(camera,Path.Combine(evidence,"mesh.png"));long sum=0;int max=0,count=0;for(int z=8;z<712;z++)for(int x=8;x<712;x++){int i=z*720+x;int[] ds={Math.Abs(before[i].r-after[i].r),Math.Abs(before[i].g-after[i].g),Math.Abs(before[i].b-after[i].b)};foreach(int delta in ds){sum+=delta;max=Math.Max(max,delta);count++;}}double mean=(double)sum/count;
  File.WriteAllText(Path.Combine(evidence,"pixel-result.json"),"{\"meanRgbError\":"+mean.ToString(System.Globalization.CultureInfo.InvariantCulture)+",\"maxRgbError\":"+max+",\"layers\":5,\"passes\":2}");Check(mean<2,"Terrain and cap material differ: "+mean);
  UnityEngine.Object.DestroyImmediate(meshObject);UnityEngine.Object.DestroyImmediate(plane);root.SetActive(true);terrain.drawHeightmap=true;
  string prefab=dest+"/Structures/Ruins.prefab",control=AssetDatabase.GetAssetPath(cap.sharedMaterials[1].GetTexture("_Control"));UnityEngine.Object.DestroyImmediate(root);root=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(prefab));cap=root.transform.Find("TerrainCaps").GetComponent<MeshRenderer>();Check(cap.sharedMaterials.Length==2&&AssetDatabase.GetAssetPath(cap.sharedMaterials[1].GetTexture("_Control"))==control,"Cap material persistence");
  EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),dest+"/Room.unity");EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);EditorSceneManager.OpenScene(dest+"/Room.unity");Check(UnityEngine.Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None).Single(v=>v.name=="TerrainCaps").sharedMaterials.Length==2,"Scene cap passes");
  File.WriteAllText(Path.Combine(evidence,"pass.json"),"{\"pass\":true,\"formalImport\":true,\"prefabReload\":true,\"sceneReload\":true,\"syntheticTerrainLayers\":5}");EditorApplication.Exit(0);
 }catch(Exception e){File.WriteAllText(Path.Combine(evidence,"failure.txt"),e.ToString());Debug.LogException(e);EditorApplication.Exit(1);}}
}
