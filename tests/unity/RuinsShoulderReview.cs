using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;using MapRuins.EditorTools;
public static class RuinsShoulderReview {
 static void Check(bool b,string s){if(!b)throw new Exception(s);}
 static void Shot(Camera c,Vector3 pos,Vector3 target,string name){c.transform.position=pos;c.transform.LookAt(target);var rt=new RenderTexture(960,720,24);c.targetTexture=rt;c.Render();var prev=RenderTexture.active;RenderTexture.active=rt;var tx=new Texture2D(960,720,TextureFormat.RGB24,false);tx.ReadPixels(new Rect(0,0,960,720),0,0);tx.Apply();File.WriteAllBytes("Evidence/Support/"+name,tx.EncodeToPNG());RenderTexture.active=prev;c.targetTexture=null;UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(tx);}
 static void Views(GameObject root,Camera c,string prefix){
  Shot(c,new Vector3(3,5.4f,-7.2f),new Vector3(0,3.55f,-4.3f),prefix+"-normal.png");
  var target=root.transform.Find("ruins_6").gameObject;var state=root.transform.Cast<Transform>().Select(t=>(t.gameObject,t.gameObject.activeSelf)).ToArray();foreach(var p in state)if(p.gameObject!=target)p.gameObject.SetActive(false);
  Shot(c,new Vector3(-7,6.6f,-5.6f),new Vector3(-4,4.4f,-2.9f),prefix+"-side.png");
  var mr=target.GetComponent<MeshRenderer>();var original=mr.sharedMaterial;var gray=new Material(Shader.Find("Universal Render Pipeline/Lit"));gray.SetColor("_BaseColor",new Color(.6f,.6f,.6f));gray.SetFloat("_Smoothness",.15f);mr.sharedMaterial=gray;
  Shot(c,new Vector3(-1,6.8f,-5.4f),new Vector3(-4,4.4f,-2.9f),prefix+"-support-mono.png");mr.sharedMaterial=original;UnityEngine.Object.DestroyImmediate(gray);foreach(var p in state)p.gameObject.SetActive(p.activeSelf);
 }
 public static void Run(){try{
  Directory.CreateDirectory("Evidence/Support");EditorSceneManager.OpenScene("Assets/RuinsCapReviewOutput/Room.unity");var terrain=UnityEngine.Object.FindAnyObjectByType<Terrain>();var camera=UnityEngine.Object.FindAnyObjectByType<Camera>();camera.orthographic=false;camera.backgroundColor=new Color(.075f,.085f,.1f);
  var old=GameObject.Find("ruins_6").transform.parent.gameObject;Views(old,camera,"before");old.SetActive(false);
  var args=Environment.GetCommandLineArgs();var source=args[Array.IndexOf(args,"-ruinsExportDir")+1];var data=RuinsStructureImporter.Preflight(source,new HashSet<string>{"separateAuthoringV1","ruinsStructuresV1"});var root=RuinsStructureImporter.Build(data,terrain,"Assets/RuinsSupportReview");Check(root.GetComponentsInChildren<MeshRenderer>().Where(r=>r.name!="TerrainCaps").Count()==19,"renderer count");
  var target=root.transform.Find("ruins_6");Check(target.GetComponent<MeshFilter>().sharedMesh==target.GetComponent<MeshCollider>().sharedMesh,"exact collider mesh");
  Views(root,camera,"after");UnityEngine.Object.DestroyImmediate(root);root=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RuinsSupportReview/Ruins.prefab"));Check(root.transform.Find("ruins_6")!=null,"prefab reload");
  EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),"Assets/RuinsSupportReview/Room.unity");EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);EditorSceneManager.OpenScene("Assets/RuinsSupportReview/Room.unity");Check(GameObject.Find("ruins_6")!=null,"scene reload");
  File.WriteAllText("Evidence/Support/pass.json","{\"pass\":true,\"beforeAfterSameCamera\":true,\"normalSideMonochrome\":true,\"formalImport\":true,\"prefabReload\":true,\"sceneReload\":true,\"sameColliderMesh\":true,\"isolatedSideViews\":true}");RuinsShoulderPhysicsReview.Run();
 }catch(Exception e){Directory.CreateDirectory("Evidence/Support");File.WriteAllText("Evidence/Support/failure.txt",e.ToString());Debug.LogException(e);EditorApplication.Exit(1);}}
}
