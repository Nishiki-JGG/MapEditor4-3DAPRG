using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.Rendering;
using MapSharedProps.EditorTools;

// 隔離プレビュー用。ゲームのシーンや元アセットには触れない。
public static class GroundedPropsChecks {
 [Serializable] class TerrainMeta {public int heightmapResolution;public float[] size;}
 [Serializable] class Meta {public TerrainMeta terrain;}
 [Serializable] class RefPart {public string id;public float[] world;}
 [Serializable] class RefInstance {public string instanceId;public RefPart[] parts;}
 [Serializable] class RefGround {public float[] positions;public int[] triangles;}
 [Serializable] class Reference {public RefInstance[] instances;public RefGround ground;}
 [Serializable] class Row {public string name;public bool passed;}
 [Serializable] class Report {public string status,fullLibraryBlocked;public float maxExportPoseError,maxWorldError,minTerrainGap,maxTerrainGap;public int clusters,parts,triangles,materials;public Row[] checks;}
 static readonly List<Row> rows=new List<Row>();
 static Report report=new Report();static string output;
 static void Check(string name,bool ok){rows.Add(new Row{name=name,passed=ok});if(!ok)throw new Exception(name);}
 static Vector3 V(float[] a,int i){return new Vector3(a[i*3],a[i*3+1],a[i*3+2]);}
 public static void Run(){var args=Environment.GetCommandLineArgs();output=args[Array.IndexOf(args,"-ground-output")+1];int exit=0;
  try{Validate();report.status="Passed";}catch(Exception e){report.status="Failed";exit=1;Debug.LogException(e);}
  report.checks=rows.ToArray();File.WriteAllText(Path.Combine(output,"unity.json"),JsonUtility.ToJson(report,true));EditorApplication.Exit(exit);
 }
 static void Validate(){
  UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.EmptyScene,UnityEditor.SceneManagement.NewSceneMode.Single);
  var data=GroundedPropsV1.Read(Path.Combine(output,"export/grounded_props.json"));
  var reference=JsonUtility.FromJson<Reference>(File.ReadAllText(Path.Combine(output,"browser-world.json")));
  // 上流63d7fd8の材質同期を保全し、標準の全資産取込経路まで確認する。
  var built=MapSharedPropsBuilder.Build(Path.Combine(output,"export"));
  Check("全56資産・既存木1個と接地3組の統合取込",built.prefabs.Count==56&&built.placed==4&&built.skipped==1);
  var importedRoot=built.root;
  var materials=new HashSet<Material>();int totalTriangles=0;float maxError=0;
  float poseError=0;
  foreach(var i in reference.instances){var root=importedRoot.transform.Find(i.instanceId);Check(i.instanceId+" 1 Renderer/組",root&&root.childCount==0&&root.GetComponentsInChildren<MeshRenderer>().Length==1);
   Check(i.instanceId+" 毎フレームのコンポーネントなし",root.GetComponentsInChildren<MonoBehaviour>().Length==0);
   var mesh=root.GetComponent<MeshFilter>().sharedMesh;var renderer=root.GetComponent<MeshRenderer>();materials.Add(renderer.sharedMaterial);var vertices=mesh.vertices;int offset=0;
   var source=Array.Find(data.instances,v=>v.instanceId==i.instanceId);Check(i.instanceId+" CSV原点維持",Vector3.Distance(root.localPosition,V(source.source.position,0))<1e-6f);
   foreach(var part in i.parts){var proto=Array.Find(data.assets[0].parts,v=>v.id==part.id);var pose=Array.Find(source.parts,v=>v.id==part.id);var matrix=Matrix4x4.TRS(V(pose.position,0),new Quaternion(pose.rotation[0],pose.rotation[1],pose.rotation[2],pose.rotation[3]),V(pose.scale,0));
    for(int k=0;k<part.world.Length/3;k++){var world=root.TransformPoint(vertices[offset+k]);maxError=Mathf.Max(maxError,Vector3.Distance(world,V(part.world,k)));poseError=Mathf.Max(poseError,Vector3.Distance(world,matrix.MultiplyPoint3x4(V(proto.positions,k))));}offset+=part.world.Length/3;
   }
   Check(i.instanceId+" 頂点数不変",vertices.Length==offset);Check(i.instanceId+" 不透明・両影",renderer.sharedMaterials.Length==1&&renderer.shadowCastingMode==ShadowCastingMode.On&&renderer.receiveShadows&&renderer.sharedMaterial.GetFloat("_Cutoff")==0);totalTriangles+=mesh.triangles.Length/3;
  }
  report.maxExportPoseError=poseError;Check("結合後も書出し姿勢が0.1mm以内",poseError<.0001f);
  report.maxWorldError=maxError;report.clusters=reference.instances.Length;report.parts=reference.instances.Length*9;report.triangles=totalTriangles;report.materials=materials.Count;
  Check("エディタ地面との差は3cm以内（R16地形への接地再評価）",maxError<.03f);
  Check("220三角形/組・共有1材質・画像追加なし",totalTriangles==220*reference.instances.Length&&materials.Count==1);
  foreach(var mat in materials)Check("シェーダーコンパイル",mat.shader.isSupported&&!ShaderUtil.ShaderHasError(mat.shader));
  var shader=Shader.Find("MapSharedProps/Lit");var parent=new GameObject("旧書出し確認");Check("任意JSONがない旧形式を許容",GroundedPropsV1.Build(output,"Assets",parent.transform,shader)==0);UnityEngine.Object.DestroyImmediate(parent);
  string negative=Path.Combine(output,"invalid-grounding.json"),json=File.ReadAllText(Path.Combine(output,"export/grounded_props.json"));
  File.WriteAllText(negative,json.Replace("\"version\":1","\"version\":99"));bool rejected=false;try{GroundedPropsV1.Read(negative);}catch(InvalidDataException){rejected=true;}Check("不明版を拒否",rejected);
  File.WriteAllText(negative,json.Replace("\"starfish0\"","\"../../unexpected\""));rejected=false;try{GroundedPropsV1.Read(negative);}catch(InvalidDataException){rejected=true;}Check("不明構成要素IDを拒否",rejected);File.Delete(negative);
  var meta=JsonUtility.FromJson<Meta>(File.ReadAllText(Path.Combine(output,"export/meta.json")));int resolution=meta.terrain.heightmapResolution;byte[] raw=File.ReadAllBytes(Path.Combine(output,"export/heightmap_r16.raw"));var heights=new float[resolution,resolution];for(int z=0;z<resolution;z++)for(int x=0;x<resolution;x++)heights[z,x]=BitConverter.ToUInt16(raw,(z*resolution+x)*2)/65535f;
  var td=new TerrainData{heightmapResolution=resolution,size=V(meta.terrain.size,0)};td.SetHeights(0,0,heights);var terrainObject=Terrain.CreateTerrainGameObject(td);var collider=terrainObject.GetComponent<TerrainCollider>();Physics.SyncTransforms();float minGap=float.PositiveInfinity,maxGap=float.NegativeInfinity;
  foreach(var instance in data.instances){var root=importedRoot.transform.Find(instance.instanceId);var vertices=root.GetComponent<MeshFilter>().sharedMesh.vertices;int offset=0;foreach(var part in data.assets[0].parts){for(int k=0;k<part.positions.Length/3;k++){if(part.positions[k*3+1]>1e-5f)continue;Vector3 world=root.TransformPoint(vertices[offset+k]);RaycastHit hit;Check("R16地形への支持点レイ",collider.Raycast(new Ray(world+Vector3.up*20,Vector3.down),out hit,40));float gap=world.y-hit.point.y;minGap=Mathf.Min(minGap,gap);maxGap=Mathf.Max(maxGap,gap);}offset+=part.positions.Length/3;}}
  report.minTerrainGap=minGap;report.maxTerrainGap=maxGap;Check("R16地形で支持点の沈み2mm以内",minGap>-.002f);Check("R16地形で支持点の浮き1cm以内",maxGap<.01f);UnityEngine.Object.DestroyImmediate(terrainObject);
  var rd=ScriptableObject.CreateInstance<UnityEngine.Rendering.Universal.UniversalRendererData>();var rp=UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset.Create(rd);rp.shadowDistance=40;
  var settings=new SerializedObject(rp);settings.FindProperty("m_MainLightShadowsSupported").boolValue=true;settings.ApplyModifiedPropertiesWithoutUndo();GraphicsSettings.defaultRenderPipeline=rp;QualitySettings.renderPipeline=rp;
  RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.55f,.55f,.55f);
  var ground=new GameObject("R16書出し地形の比較用");int n=resolution*resolution;var points=new Vector3[n];var indices=new List<int>();for(int z=0;z<resolution;z++)for(int x=0;x<resolution;x++){int k=z*resolution+x;points[k]=new Vector3(x*td.size.x/(resolution-1),heights[z,x]*td.size.y,z*td.size.z/(resolution-1));if(x<resolution-1&&z<resolution-1)indices.AddRange(new[]{k,k+resolution,k+1,k+resolution,k+resolution+1,k+1});}
  var geo=new Mesh{vertices=points,triangles=indices.ToArray()};geo.RecalculateNormals();ground.AddComponent<MeshFilter>().sharedMesh=geo;
  var groundMat=new Material(Shader.Find("Universal Render Pipeline/Lit"));groundMat.SetColor("_BaseColor",new Color(.58f,.48f,.32f));ground.AddComponent<MeshRenderer>().sharedMaterial=groundMat;
  var sun=new GameObject("検査用太陽").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=1.5f;sun.shadows=LightShadows.Hard;sun.shadowBias=.01f;sun.shadowNormalBias=.01f;sun.transform.rotation=Quaternion.LookRotation(new Vector3(3,-6,2));
  var camera=new GameObject("検査用カメラ").AddComponent<Camera>();camera.gameObject.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.08f,.1f,.12f);camera.nearClipPlane=.01f;camera.farClipPlane=100;camera.aspect=1.6f;
  var target=importedRoot.transform.Find(reference.instances[0].instanceId).position;
  camera.transform.position=target+new Vector3(2,1.2f,3);camera.transform.LookAt(target);Capture(camera,"unity-low.png");
  camera.transform.position=target+new Vector3(0,4,.001f);camera.transform.LookAt(target);Capture(camera,"unity-top.png");
  sun.enabled=false;Capture(camera,"unity-top-no-sun.png");Check("D3D11実描画3視点",SystemInfo.graphicsDeviceType==GraphicsDeviceType.Direct3D11);
 }
 static void Capture(Camera camera,string name){var rt=new RenderTexture(1280,800,24);rt.Create();camera.targetTexture=rt;RenderPipeline.SubmitRenderRequest(camera,new RenderPipeline.StandardRequest{destination=rt});var previous=RenderTexture.active;RenderTexture.active=rt;var image=new Texture2D(1280,800,TextureFormat.RGBA32,false);image.ReadPixels(new Rect(0,0,1280,800),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name),image.EncodeToPNG());RenderTexture.active=previous;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(image);}
}
