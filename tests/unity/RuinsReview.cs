// 専用の検証プロジェクトだけに配置する。元ゲームへ導入しない。
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

public static class RuinsReview {
 [Serializable] class Meta { public TerrainSpec terrain; }
 [Serializable] class TerrainSpec { public float[] size;public float editorYOfZero;public int heightmapResolution; }
 static void Check(bool condition,string message){if(!condition)throw new Exception(message);}
 static string Arg(string key){var a=Environment.GetCommandLineArgs();int i=Array.IndexOf(a,key);Check(i>=0&&i+1<a.Length,"Missing "+key);return a[i+1];}
 static string Snapshot(GameObject root){return string.Join("\n",root.GetComponentsInChildren<MeshFilter>().OrderBy(f=>f.name).Select(f=>f.name+"|"+f.transform.localPosition.ToString("F5")+"|"+f.transform.localRotation.ToString("F5")+"|"+AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(f.sharedMesh))+"|"+AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(f.GetComponent<MeshRenderer>().sharedMaterial))+"|"+(f.GetComponent<MeshCollider>().sharedMesh==f.sharedMesh)));}
 public static void Run(){
  string evidence=Path.GetFullPath(Path.Combine(Application.dataPath,"../Evidence"));Directory.CreateDirectory(evidence);
  try {
   string input=Arg("-ruinsExportDir"),assets="Assets/RuinsReviewOutput";
   Check(!AssetDatabase.IsValidFolder(assets),"Use a fresh review output; existing output is retained");
   var d=RuinsStructureImporter.Preflight(input,new HashSet<string>{"separateAuthoringV1","ruinsStructuresV1"});
   var meta=JsonUtility.FromJson<Meta>(File.ReadAllText(Path.Combine(input,"meta.json")));
   Check(d.items.Length==19,"Expected the 19-part review fixture");
   bool refused=false;try{RuinsStructureImporter.Preflight(input,new HashSet<string>{"separateAuthoringV1"});}catch(InvalidDataException){refused=true;}Check(refused,"Unknown mandatory feature was not rejected");
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   Directory.CreateDirectory(assets);AssetDatabase.Refresh();
   var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,assets+"/Renderer.asset");
   var pipeline=ScriptableObject.CreateInstance<UniversalRenderPipelineAsset>();var so=new SerializedObject(pipeline);var list=so.FindProperty("m_RendererDataList");Check(list!=null,"URP renderer-list schema changed");list.arraySize=1;list.GetArrayElementAtIndex(0).objectReferenceValue=renderer;so.ApplyModifiedPropertiesWithoutUndo();AssetDatabase.CreateAsset(pipeline,assets+"/Pipeline.asset");GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
   var source=new TerrainData{heightmapResolution=d.terrainResolution,size=new Vector3(meta.terrain.size[0],meta.terrain.size[1],meta.terrain.size[2])};
   byte[] raw=File.ReadAllBytes(Path.Combine(input,"heightmap_r16.raw"));int n=d.terrainResolution;Check(raw.Length==n*n*2,"Heightmap byte count");var heights=new float[n,n];for(int z=0;z<n;z++)for(int x=0;x<n;x++){int k=(z*n+x)*2;heights[z,x]=(raw[k]+raw[k+1]*256)/65535f;}source.SetHeights(0,0,heights);AssetDatabase.CreateAsset(source,assets+"/SourceTerrain.asset");
   var terrain=Terrain.CreateTerrainGameObject(source).GetComponent<Terrain>();terrain.transform.position=new Vector3(-d.size/2,meta.terrain.editorYOfZero,-d.size/2);
   // この段階は無装飾の幾何/Collider診断。元地形塗装と補完面の材質一致は合格に含めない。
   var ground=new Material(Shader.Find("Universal Render Pipeline/Lit"));ground.SetColor("_BaseColor",new Color(.28f,.34f,.18f));AssetDatabase.CreateAsset(ground,assets+"/DiagnosticCap.mat");
   var root=RuinsStructureImporter.Build(d,terrain,assets+"/Structures",ground);Physics.SyncTransforms();
   Check(terrain.terrainData!=source,"TerrainData was not cloned");var original=source.GetHoles(0,0,n-1,n-1);foreach(bool v in original)Check(v,"Source terrain holes were modified");
   int cut=0;foreach(bool v in terrain.terrainData.GetHoles(0,0,n-1,n-1))if(!v)cut++;Check(cut==d.holes.Count(v=>v==1),"Hole orientation/count");
   var filters=root.GetComponentsInChildren<MeshFilter>();Check(filters.Length==d.items.Length+(d.cap.positions.Length>0?1:0),"Missing render mesh");foreach(var f in filters)Check(f.sharedMesh==f.GetComponent<MeshCollider>().sharedMesh,"Visual/collider mesh mismatch");
   var wall=d.items.First(p=>p.kind=="wall");Check(root.transform.Find(wall.id)!=null,"Wall missing");
   var platform=d.items.Single(p=>p.kind=="platform");var point=root.transform.position+new Vector3(platform.position[0],platform.position[1],platform.position[2]);
   Check(Physics.Raycast(point+Vector3.up*20,Vector3.down,out var hit,30),"Platform has no collider");Check(Mathf.Abs(hit.point.y-(meta.terrain.editorYOfZero+2.2f))<.002f,"Platform top height");
   string before=Snapshot(root),prefabPath=assets+"/Structures/Ruins.prefab";UnityEngine.Object.DestroyImmediate(root);root=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath));Check(Snapshot(root)==before,"Prefab reload changed geometry/material/collider references");
   var light=new GameObject("Review sun").AddComponent<Light>();light.type=LightType.Directional;light.intensity=2;light.transform.rotation=Quaternion.Euler(50,-30,0);light.shadows=LightShadows.Soft;RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.gray*.5f;
   var camera=new GameObject("Review camera").AddComponent<Camera>();camera.transform.position=new Vector3(18,20,22);camera.transform.LookAt(new Vector3(0,3,0));camera.nearClipPlane=.1f;camera.farClipPlane=100;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.08f,.09f,.1f);camera.gameObject.AddComponent<UniversalAdditionalCameraData>();
   string scenePath=assets+"/Room.unity";Check(EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),scenePath),"Scene save failed");string guid=AssetDatabase.AssetPathToGUID(scenePath);EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);EditorSceneManager.OpenScene(AssetDatabase.GUIDToAssetPath(guid));root=UnityEngine.Object.FindObjectsByType<MeshFilter>(FindObjectsSortMode.None).First(f=>f.name==platform.id).transform.parent.gameObject;Check(Snapshot(root)==before,"Scene reload changed geometry/material/collider references");
   camera=UnityEngine.Object.FindFirstObjectByType<Camera>();var rt=new RenderTexture(960,720,24);camera.targetTexture=rt;camera.Render();var prev=RenderTexture.active;RenderTexture.active=rt;var tex=new Texture2D(960,720,TextureFormat.RGB24,false);tex.ReadPixels(new Rect(0,0,960,720),0,0);tex.Apply();File.WriteAllBytes(Path.Combine(evidence,"room.png"),tex.EncodeToPNG());RenderTexture.active=prev;camera.targetTexture=null;UnityEngine.Object.DestroyImmediate(tex);UnityEngine.Object.DestroyImmediate(rt);
   File.WriteAllText(Path.Combine(evidence,"result.json"),"{\"pass\":true,\"items\":19,\"prefabReload\":true,\"sceneReload\":true,\"originalTerrainPreserved\":true,\"visualMaterialParity\":false,\"gpuMeasured\":false}");EditorApplication.Exit(0);
  }catch(Exception e){File.WriteAllText(Path.Combine(evidence,"failure.txt"),e.ToString());Debug.LogException(e);EditorApplication.Exit(1);}
 }
}
