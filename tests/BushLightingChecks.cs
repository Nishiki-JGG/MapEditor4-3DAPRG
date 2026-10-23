using System;using System.IO;using System.Collections.Generic;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;using UnityEngine.Rendering;using UnityEngine.Rendering.Universal;using MapSharedProps.EditorTools;
// 隔離したD3D11プレビュー専用。ゲームやユーザーのシーンは開かない。
public static class BushLightingChecks {
 [Serializable]class Report{public string status;public int checks,triangles,vertices,leafVertices;public string error;}
 static int checks;static void Check(bool ok,string why){checks++;if(!ok)throw new Exception(why);}
 static string Arg(string s){var a=Environment.GetCommandLineArgs();return a[Array.IndexOf(a,s)+1];}
 public static void Run(){var output=Arg("-bush-output");var report=new Report();int code=0;try{
  EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var export=Path.Combine(output,"fixed/export");var lib=MapSharedPropsBuilder.ReadLibrary(Path.Combine(export,"shared_props.json"));var built=MapSharedPropsBuilder.Build(export);
  var a=Array.Find(lib.assets,x=>x.id=="bush");var prefab=built.prefabs["bush"];var mesh=prefab.GetComponent<MeshFilter>().sharedMesh;var mat=prefab.GetComponent<Renderer>().sharedMaterial;
  var mask=new List<Vector2>();mesh.GetUVs(4,mask);int leaves=0;foreach(var q in mask)if(q.x>.5f)leaves++;
  Check(mesh.vertexCount==552&&mesh.triangles.Length/3==184&&leaves==432,"葉/木質マスク・形状数");Check(mat.IsKeywordEnabled("SHARED_BUSH_LEAF"),"茂み材質の補正");
  foreach(var kv in built.prefabs)if(kv.Key!="bush")Check(!kv.Value.GetComponent<Renderer>().sharedMaterial.IsKeywordEnabled("SHARED_BUSH_LEAF"),"他材質への漏れ "+kv.Key);
  var p=mesh.vertices;var n=mesh.normals;var c=mesh.colors;var uv=mesh.uv;var motion=mesh.uv2;
  for(int i=0;i<p.Length;i++){Check(Vector3.Distance(p[i],new Vector3(a.positions[i*3],a.positions[i*3+1],a.positions[i*3+2]))<1e-6f,"位置保持");Check(Vector3.Distance(n[i],new Vector3(a.normals[i*3],a.normals[i*3+1],a.normals[i*3+2]))<1e-6f,"法線保持");Check(Mathf.Abs(c[i].g-a.colors[i*3+1])<1e-6f&&Vector2.Distance(uv[i],new Vector2(a.uv[i*2],a.uv[i*2+1]))<1e-6f,"色UV保持");Check(Vector2.Distance(motion[i],new Vector2(a.motionWeights[i*2],a.motionWeights[i*2+1]))<1e-6f,"風接触ウェイト保持");}
  UnityEngine.Object.DestroyImmediate(built.root);
  var rd=ScriptableObject.CreateInstance<UniversalRendererData>();var rp=UniversalRenderPipelineAsset.Create(rd);rp.shadowDistance=30;var so=new SerializedObject(rp);so.FindProperty("m_MainLightShadowsSupported").boolValue=true;so.ApplyModifiedPropertiesWithoutUndo();GraphicsSettings.defaultRenderPipeline=rp;QualitySettings.renderPipeline=rp;
  RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.28f,.32f,.38f);
  var sun=new GameObject("Diagnostic sun").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=1.8f;sun.shadows=LightShadows.Hard;sun.gameObject.AddComponent<UniversalAdditionalLightData>();
  var floor=GameObject.CreatePrimitive(PrimitiveType.Plane);floor.transform.localScale=Vector3.one*5;var fm=new Material(Shader.Find("Universal Render Pipeline/Lit"));fm.color=new Color(.35f,.22f,.12f);floor.GetComponent<Renderer>().sharedMaterial=fm;
  var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefab);obj.transform.position=new Vector3(0,-.05f,0);obj.transform.rotation=Quaternion.Euler(0,-22.345f,0);var renderer=obj.GetComponent<Renderer>();
  var camera=new GameObject("Diagnostic camera").AddComponent<Camera>();camera.gameObject.AddComponent<UniversalAdditionalCameraData>();camera.orthographic=true;camera.orthographicSize=1.6f;camera.aspect=1.25f;camera.farClipPlane=60;
  foreach(int az in new[]{0,2})foreach(string view in new[]{"top","oblique","walk"})foreach(bool fix in new[]{false,true}){
   sun.transform.rotation=Quaternion.LookRotation(new Vector3(az==0?5:-5,-9,4));camera.transform.position=view=="top"?new Vector3(0,6,0):view=="walk"?new Vector3(2.1f,1.8f,-3.2f):new Vector3(2.1f,2.9f,-3.2f);camera.transform.up=view=="top"?Vector3.back:Vector3.up;camera.transform.LookAt(new Vector3(0,.42f,0));if(fix)mat.EnableKeyword("SHARED_BUSH_LEAF");else mat.DisableKeyword("SHARED_BUSH_LEAF");Shader.SetGlobalVector("_TDPineWind",Vector4.zero);Capture(camera,Path.Combine(output,"unity-"+view+"-"+az+"-"+(fix?"fixed":"before")+".png"));
  }
  mat.EnableKeyword("SHARED_BUSH_LEAF");foreach(int frame in new[]{0,1}){Shader.SetGlobalVector("_TDPineWind",new Vector4(.8f,.6f,1,frame*2.4f));var block=new MaterialPropertyBlock();block.SetVector("_PlantTouch",new Vector4(frame*.12f,0,0,0));renderer.SetPropertyBlock(block);Capture(camera,Path.Combine(output,"unity-motion-"+frame+".png"));}
  foreach(var msg in ShaderUtil.GetShaderMessages(mat.shader))Check(msg.severity.ToString()!="Error",msg.message);
  Check(renderer.sharedMaterials.Length==1&&Mathf.Abs(mat.GetFloat("_Cutoff")-.42f)<1e-6f,"1材質・alpha維持");report.status="Passed";report.triangles=184;report.vertices=552;report.leafVertices=leaves;
 }catch(Exception e){code=1;report.status="Failed";report.error=e.ToString();Debug.LogException(e);}report.checks=checks;File.WriteAllText(Path.Combine(output,"unity-lighting.json"),JsonUtility.ToJson(report,true));EditorApplication.Exit(code);}
 static void Capture(Camera camera,string path){var rt=new RenderTexture(1000,800,24);rt.Create();camera.targetTexture=rt;RenderPipeline.SubmitRenderRequest(camera,new RenderPipeline.StandardRequest{destination=rt});var old=RenderTexture.active;RenderTexture.active=rt;var im=new Texture2D(1000,800,TextureFormat.RGBA32,false);im.ReadPixels(new Rect(0,0,1000,800),0,0);im.Apply();File.WriteAllBytes(path,im.EncodeToPNG());RenderTexture.active=old;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(im);}
}
