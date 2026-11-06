using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
public static class RuinsBoundaryReview {
 public static void Run(){try{
 EditorSceneManager.OpenScene("Assets/RuinsTarget25Output/Room.unity");Physics.SyncTransforms();var misses=new List<string>();for(float z=-4;z<0;z+=.025f)for(float x=-2.5f;x<2.5f;x+=.025f)if(!Physics.Raycast(new Vector3(x,10,z),Vector3.down,20))misses.Add(x+","+z);
 var camera=UnityEngine.Object.FindAnyObjectByType<Camera>();camera.orthographic=false;camera.transform.position=new Vector3(15,17,19);camera.transform.LookAt(new Vector3(0,3,0));var rt=new RenderTexture(960,720,24);camera.targetTexture=rt;camera.Render();RenderTexture.active=rt;var tx=new Texture2D(960,720,TextureFormat.RGB24,false);tx.ReadPixels(new Rect(0,0,960,720),0,0);tx.Apply();var pixels=tx.GetPixels32();var holes=new List<string>();for(int y=0;y<720;y++)for(int x=0;x<960;x++){var c=pixels[y*960+x];if(c.r>250&&c.g<5&&c.b>250){var ray=camera.ScreenPointToRay(new Vector3(x+.5f,y+.5f,0));float t=(3-ray.origin.y)/ray.direction.y;var p=ray.GetPoint(t);if(Math.Abs(p.x)<11.8&&Math.Abs(p.z)<11.8)holes.Add(p.ToString("F4"));}}
 File.WriteAllText("Evidence/boundary.txt","physicsMisses="+misses.Count+"\n"+string.Join("\n",misses.Take(10))+"\nrenderHoles="+holes.Count+"\n"+string.Join("\n",holes.Take(15)));camera.targetTexture=null;RenderTexture.active=null;UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(tx);EditorApplication.Exit(misses.Count==0&&holes.Count==0?0:1);
 }catch(Exception e){File.WriteAllText("Evidence/boundary-fail.txt",e.ToString());EditorApplication.Exit(1);}}
}
