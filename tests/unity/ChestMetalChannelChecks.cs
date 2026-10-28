using System;using System.IO;using System.Linq;using UnityEngine;
// Actual gold prefab, constant camera and lights; isolate packed normal / roughness response.
public static class ChestMetalChannelChecks {
 [Serializable]class Difference{public string mode;public int changedPixels;public float meanChannelDifference;}
 [Serializable]class Report{public bool pass;public Difference[] differences;}
 public static void Verify(GameObject gold,string packedPng,string output,Camera camera,Action<string,bool,string> check){
  var renderers=gold.GetComponentsInChildren<Renderer>().Where(r=>r.sharedMaterial.IsKeywordEnabled("CHEST_SURFACE")).ToArray();
  var original=renderers.Select(r=>r.sharedMaterial).ToArray();var copies=original.Select(m=>new Material(m)).ToArray();
  for(int i=0;i<renderers.Length;i++)renderers[i].sharedMaterial=copies[i];
  var raw=new Texture2D(2,2,TextureFormat.RGBA32,false,true);raw.LoadImage(Convert.FromBase64String(packedPng));var source=raw.GetPixels32();var modes=new[]{"full","flat-normal","uniform-rough","rough-low","rough-high"};var frames=new System.Collections.Generic.List<Color32[]>();
  try{foreach(var mode in modes){var pixels=(Color32[])source.Clone();for(int y=0;y<(copies.Any(m=>m.IsKeywordEnabled("CHEST_GOLD_ATLAS"))?raw.height:raw.height/2);y++)for(int x=0;x<raw.width;x++){int k=y*raw.width+x;var c=pixels[k];if(mode=="flat-normal")c.r=c.g=128;if(mode=="uniform-rough")c.b=120;if(mode=="rough-low")c.b=26;if(mode=="rough-high")c.b=217;pixels[k]=c;}
    var map=new Texture2D(raw.width,raw.height,TextureFormat.RGBA32,true,true){wrapMode=TextureWrapMode.Clamp,filterMode=FilterMode.Trilinear,anisoLevel=2};map.SetPixels32(pixels);map.Apply();foreach(var m in copies)m.SetTexture("_ChestPacked",map);for(int k=0;k<3;k++)camera.Render();var previous=RenderTexture.active;RenderTexture.active=camera.targetTexture;var image=new Texture2D(camera.targetTexture.width,camera.targetTexture.height,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,image.width,image.height),0,0);image.Apply();frames.Add(image.GetPixels32());File.WriteAllBytes(Path.Combine(output,"metal-channel-"+mode+".png"),image.EncodeToPNG());RenderTexture.active=previous;UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(map);
   }
   var rows=new System.Collections.Generic.List<Difference>();for(int n=1;n<frames.Count;n++){int count=0;double sum=0;for(int k=0;k<frames[0].Length;k++){var a=frames[0][k];var b=frames[n][k];int delta=Math.Abs(a.r-b.r)+Math.Abs(a.g-b.g)+Math.Abs(a.b-b.b);if(delta>3)count++;sum+=delta;}rows.Add(new Difference{mode=modes[n],changedPixels=count,meanChannelDifference=(float)(sum/(frames[0].Length*3.0))});check("gold real shader responds to "+modes[n],count>50,"changed pixels="+count);}
   File.WriteAllText(Path.Combine(output,"metal-channel-report.json"),JsonUtility.ToJson(new Report{pass=true,differences=rows.ToArray()},true));
  }finally{for(int i=0;i<renderers.Length;i++)renderers[i].sharedMaterial=original[i];foreach(var m in copies)UnityEngine.Object.DestroyImmediate(m);UnityEngine.Object.DestroyImmediate(raw);}
 }
}
