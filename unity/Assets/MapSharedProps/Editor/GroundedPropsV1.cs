using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace MapSharedProps.EditorTools {
// 地表小物の任意サイドカー。配置済みの剛体姿勢を取り込むだけでUpdateは持たない。
public static class GroundedPropsV1 {
 [Serializable] public class Part {public string id;public float[] positions,normals,colors,uv;public int[] triangles;}
 [Serializable] public class Surface {public string id,png,colorSpace,filter,wrap;public int width,height;public bool mipmaps;}
 [Serializable] public class Asset {public Surface surface;public string id,assetKey;public Part[] parts;}
 [Serializable] public class Pose {public string id;public float[] position,rotation,scale;}
 [Serializable] public class Source {public float[] position,scale;public float yaw;}
 [Serializable] public class Instance {public string instanceId,type,assetKey;public Source source;public float[] tint;public Pose[] parts;}
 [Serializable] public class Data {public int version;public string units,axes;public Asset[] assets;public Instance[] instances;}
 static void Check(bool ok,string why){if(!ok)throw new InvalidDataException("Grounded props: "+why);}
 static bool Finite(float x){return !float.IsNaN(x)&&!float.IsInfinity(x);}
 static void Floats(float[] a,int n){Check(a!=null&&a.Length==n,"array length");foreach(float x in a)Check(Finite(x),"non-finite value");}
 static Vector3 V(float[] a){Floats(a,3);return new Vector3(a[0],a[1],a[2]);}
 public static Data Read(string file){
  var d=JsonUtility.FromJson<Data>(File.ReadAllText(file));Check(d!=null&&d.version==1&&d.units=="metres"&&d.axes=="Unity X/Y/Z"&&d.assets!=null&&d.instances!=null,"format");
  // New small-prop sidecar owns tools/rope. Keep the original nine-part shell contract strict.
  foreach(var a in d.assets)Check(a.id=="shells"||a.id=="miningtools"||a.id=="coiledrope","unknown grounded asset");
  d.assets=Array.FindAll(d.assets,a=>a.id=="shells");d.instances=Array.FindAll(d.instances,a=>a.type=="shells");
  Check(d.assets.Length<=1&&d.instances.Length<=8000,"count");var ids=new HashSet<string>();var allowed=new HashSet<string>(new[]{"starfish0","starfish1","starfish2","starfish3","starfish4","shell0","shell1","shell2","shell3"});
  foreach(var a in d.assets){Check(a.id=="shells"&&a.assetKey=="tdj/shells"&&a.parts!=null&&a.parts.Length==9,"asset");
   foreach(var p in a.parts){Check(p!=null&&((p.id=="starfish0"||p.id=="starfish1"||p.id=="starfish2"||p.id=="starfish3"||p.id=="starfish4")||(p.id=="shell0"||p.id=="shell1"||p.id=="shell2"||p.id=="shell3")),"part ID");Check(ids.Add(a.id+"/"+p.id)&&p.positions!=null&&p.positions.Length>0&&p.positions.Length<=20000,"part ID/count");int n=p.positions.Length/3;Floats(p.positions,n*3);Floats(p.normals,n*3);Floats(p.colors,n*3);Check(p.triangles!=null&&p.triangles.Length>0&&p.triangles.Length%3==0,"triangles");foreach(int ix in p.triangles)Check(ix>=0&&ix<n,"index");}
  }
  ids.Clear();foreach(var i in d.instances){Check(i!=null&&!string.IsNullOrWhiteSpace(i.instanceId)&&i.instanceId.Length<=128&&ids.Add(i.instanceId)&&i.type=="shells"&&i.assetKey=="tdj/shells"&&i.source!=null&&i.parts!=null&&i.parts.Length==9,"instance");V(i.source.position);var scale=V(i.source.scale);Check(scale.x>0&&scale.y>0&&scale.z>0&&Finite(i.source.yaw),"source pose");Floats(i.tint,3);var parts=new HashSet<string>();
   foreach(var p in i.parts){Check(p!=null&&allowed.Contains(p.id)&&parts.Add(p.id),"unknown/duplicate part");V(p.position);var sc=V(p.scale);Floats(p.rotation,4);float length=0;foreach(float x in p.rotation)length+=x*x;Check(Mathf.Abs(length-1)<.0001f&&sc.x>0&&sc.y>0&&sc.z>0,"part pose");}
  }foreach(var a in d.assets)ValidateSurface(a);return d;
 }
 static void ValidateSurface(Asset a){if(a.surface==null||string.IsNullOrEmpty(a.surface.id)){a.surface=null;return;}try{var s=a.surface;Check(s.id=="shore-shell-grain-v1"&&s.width==128&&s.height==128&&s.colorSpace=="sRGB"&&s.filter=="trilinear"&&s.wrap=="clamp"&&s.mipmaps,"optional shell surface");Check(!string.IsNullOrEmpty(s.png)&&s.png.Length<140000,"optional shell PNG budget");foreach(var p in a.parts){Floats(p.uv,p.positions.Length/3*2);foreach(var v in p.uv)Check(v>=-.02f&&v<=1.02f,"optional UV range");}}catch(InvalidDataException e){a.surface=null;Debug.LogWarning("Ignoring optional shell surface: "+e.Message);}}
 public static int Build(string exportDirectory,string assetDirectory,Transform parent,Shader shader){
  string file=Path.Combine(exportDirectory,"grounded_props.json");if(!File.Exists(file))return 0;var d=Read(file);
  var rows=new Dictionary<string,string[]>();foreach(var line in File.ReadAllLines(Path.Combine(exportDirectory,"props.csv"))){var row=line.Split(',');if(row.Length==11&&row[1]=="shells")Check(rows.TryAdd(row[0],row),"duplicate CSV ID");}
  foreach(var i in d.instances){Check(rows.TryGetValue(i.instanceId,out var row)&&row[1]==i.type&&row[2]==i.assetKey,"CSV identity");
   for(int k=0;k<3;k++)Check(Mathf.Abs(float.Parse(row[k+3],CultureInfo.InvariantCulture)-i.source.position[k])<.0011f,"CSV position");
   Check(Mathf.Abs(float.Parse(row[6],CultureInfo.InvariantCulture)-i.source.yaw)<.011f&&Mathf.Abs(float.Parse(row[7],CultureInfo.InvariantCulture)-i.source.scale[0])<.0011f&&Mathf.Abs(float.Parse(row[8],CultureInfo.InvariantCulture)-i.source.scale[1])<.0011f,"CSV rotation/scale");
  }
  var meshes=new Dictionary<string,Mesh>();var mat=new Material(shader){name="grounded-shells"};if(shader.name=="MapSharedProps/Lit")mat.EnableKeyword("SMALL_PROP_LOCAL_LIGHTS");mat.SetTexture("_BaseMap",Texture2D.whiteTexture);mat.SetColor("_BaseColor",Color.white);mat.SetFloat("_Cutoff",0);mat.SetFloat("_Cull",2);AssetDatabase.CreateAsset(mat,assetDirectory+"/grounded-shells.mat");
  bool textured=false;
  if(d.assets.Length==1&&d.assets[0].surface!=null){try{var s=d.assets[0].surface;var bytes=Convert.FromBase64String(s.png);Check(bytes.Length>32&&bytes[0]==137&&bytes[1]==80&&bytes[2]==78&&bytes[3]==71,"shell PNG signature");Check(bytes[12]==73&&bytes[13]==72&&bytes[14]==68&&bytes[15]==82&&bytes[16]==0&&bytes[17]==0&&bytes[18]==0&&bytes[19]==128&&bytes[20]==0&&bytes[21]==0&&bytes[22]==0&&bytes[23]==128,"shell PNG bounded header");var decoded=new Texture2D(2,2,TextureFormat.RGBA32,false);try{Check(ImageConversion.LoadImage(decoded,bytes)&&decoded.width==128&&decoded.height==128,"shell PNG decode");}finally{UnityEngine.Object.DestroyImmediate(decoded);}var texture=SharedImportCache.Image(bytes,".png",true,true,TextureWrapMode.Clamp,FilterMode.Trilinear,2,128);Check(texture.width==128&&texture.height==128,"shell PNG dimensions");mat.SetTexture("_BaseMap",texture);textured=true;}catch(Exception e) when(e is InvalidDataException||e is FormatException||e is UnityException||e is ArgumentException||e is IOException){Debug.LogWarning("Ignoring undecodable shell surface: "+e.Message);}}
  foreach(var a in d.assets)foreach(var p in a.parts){int n=p.positions.Length/3;var vertices=new Vector3[n];var normals=new Vector3[n];var colors=new Color[n];for(int k=0;k<n;k++){vertices[k]=new Vector3(p.positions[k*3],p.positions[k*3+1],p.positions[k*3+2]);normals[k]=new Vector3(p.normals[k*3],p.normals[k*3+1],p.normals[k*3+2]);colors[k]=new Color(p.colors[k*3],p.colors[k*3+1],p.colors[k*3+2],1);}var mesh=new Mesh{name=p.id,vertices=vertices,normals=normals,colors=colors,uv=new Vector2[n],triangles=p.triangles};if(textured){var uv=new Vector2[n];for(int k=0;k<n;k++)uv[k]=new Vector2(p.uv[k*2],1-p.uv[k*2+1]);mesh.uv=uv;}mesh.RecalculateBounds();meshes.Add(p.id,mesh);}
  // 接地済み姿勢を配置ごとに焼き込み、9 Renderer/組を避ける。原点と親の回転・倍率はCSVと同じ。
  int ordinal=0;
  try{foreach(var i in d.instances){
   var root=new GameObject(i.instanceId);root.transform.SetParent(parent,false);root.transform.localPosition=V(i.source.position);root.transform.localRotation=Quaternion.Euler(0,i.source.yaw,0);root.transform.localScale=V(i.source.scale);
   var inverse=Matrix4x4.TRS(root.transform.localPosition,root.transform.localRotation,root.transform.localScale).inverse;
   var pieces=new CombineInstance[i.parts.Length];for(int k=0;k<i.parts.Length;k++){var p=i.parts[k];Check(meshes.ContainsKey(p.id),"unknown component");pieces[k]=new CombineInstance{mesh=meshes[p.id],transform=inverse*Matrix4x4.TRS(V(p.position),new Quaternion(p.rotation[0],p.rotation[1],p.rotation[2],p.rotation[3]),V(p.scale))};}
   var combined=new Mesh{name="grounded-shells"};combined.CombineMeshes(pieces,true,true);combined.RecalculateBounds();
   // 個体別Meshに一度だけ保存。SetColorと同じsRGB→Linear変換を保ち、非永続PropertyBlockを使わない。
   var tint=new Color(i.tint[0],i.tint[1],i.tint[2],1);if(QualitySettings.activeColorSpace==ColorSpace.Linear)tint=tint.linear;var colours=combined.colors;for(int k=0;k<colours.Length;k++)colours[k]*=tint;combined.colors=colours;
   AssetDatabase.CreateAsset(combined,assetDirectory+"/grounded-placed-"+(ordinal++).ToString("D4")+".asset");root.AddComponent<MeshFilter>().sharedMesh=combined;
   var renderer=root.AddComponent<MeshRenderer>();renderer.sharedMaterial=mat;renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.On;renderer.receiveShadows=true;
  }}finally{foreach(var mesh in meshes.Values)UnityEngine.Object.DestroyImmediate(mesh);}
  return d.instances.Length;
 }
}
}
