using System;using System.IO;using System.Collections.Generic;using UnityEngine;using UnityEditor;using MapSharedProps.EditorTools;
public static class FibreCompatibilityBaseline {
 [Serializable]class Probe {public string id,exportVersion,readError,buildError;public bool readSucceeded,buildSucceeded;public int placed,skipped;}
 [Serializable]class Report {public bool pass;public string error;public List<Probe> probes=new List<Probe>();}
 static string Arg(string flag){var a=Environment.GetCommandLineArgs();return a[Array.IndexOf(a,flag)+1];}
 public static void Run(){var report=new Report();int code=0;string output=Arg("-props-output"),baseDir=Arg("-props-root");Directory.CreateDirectory(output);try{
  UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.EmptyScene,UnityEditor.SceneManagement.NewSceneMode.Single);
  foreach(string id in new[]{"tiedsack","coiledrope"})foreach(string version in new[]{"17f405e","541d18e"}){
   var p=new Probe{id=id,exportVersion=version};report.probes.Add(p);string source=Path.Combine(baseDir,version=="17f405e"?"batch24-before-custom-"+(id=="tiedsack"?"sack":"rope"):"batch23-release-custom-"+(id=="tiedsack"?"sack":"rope"));
   try{PreFibreSmallPropsV1.Read(Path.Combine(source,"small_props.json"));p.readSucceeded=true;}catch(Exception e){p.readError=e.Message;}
   var folder=AssetDatabase.GenerateUniqueAssetPath("Assets/FibreFailureProof");AssetDatabase.CreateFolder("Assets",Path.GetFileName(folder));var root=new GameObject("Expected failure "+id+" "+version);
   try{p.placed=PreFibreSmallPropsV1.Build(source,folder,root.transform,Shader.Find("MapSharedProps/Lit"),new Dictionary<string,GameObject>());p.buildSucceeded=true;}catch(Exception e){p.buildError=e.Message;}UnityEngine.Object.DestroyImmediate(root);
   if(version=="17f405e"&&(!p.readError?.Contains("identity")??true))throw new Exception("Old export must reproduce identity failure");
   if(version=="541d18e"&&(!p.readSucceeded||(!p.buildError?.Contains("CSV asset key")??true)))throw new Exception("Current export must reproduce old build key failure");
  }
  report.pass=true;
 }catch(Exception e){report.error=e.ToString();code=1;}finally{File.WriteAllText(Path.Combine(output,"baseline.json"),JsonUtility.ToJson(report,true));EditorApplication.Exit(code);}}
}
