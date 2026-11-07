using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEditor;
namespace MapSharedProps.EditorTools {
// 任意の静的扉拡張。旧マップの基本素材は変更しない。
public static class BossDoorsV1 {
 [Serializable] public class Maps {public int width,height;public string colour,packed;}
 [Serializable] public class Data {public int version;public string units,axes;public Maps textures;public SmallPropsV1.Asset[] assets;}
 static readonly string[] Ids={"boss_stone_door","dungeon_boss_door"};
 static void Check(bool ok,string why){if(!ok)throw new InvalidDataException("Boss doors: "+why);}
 static bool Finite(float x)=>!float.IsNaN(x)&&!float.IsInfinity(x);
 static void Values(float[] values,int length){Check(values!=null&&values.Length==length&&values.All(Finite),"finite arrays");}
 static void Png(string text){
  Check(!string.IsNullOrEmpty(text)&&text.Length<500000,"texture bound");var bytes=Convert.FromBase64String(text);
  Check(bytes.Length>=33&&bytes[0]==137&&bytes[1]==80&&bytes[2]==78&&bytes[3]==71&&bytes[12]==73&&bytes[13]==72&&bytes[14]==68&&bytes[15]==82&&bytes[16]==0&&bytes[17]==0&&bytes[18]==1&&bytes[19]==0&&bytes[20]==0&&bytes[21]==0&&bytes[22]==1&&bytes[23]==0,"256x256 PNG header");
  var texture=new Texture2D(2,2,TextureFormat.RGBA32,false,true);try{Check(ImageConversion.LoadImage(texture,bytes)&&texture.width==256&&texture.height==256,"texture decode");}finally{UnityEngine.Object.DestroyImmediate(texture);}
 }
 public static Data Optional(Data data){
  if(data==null||(data.version==0&&data.assets==null))return null;
  try{
   Check(data.version==1&&data.units=="metres"&&data.axes=="Unity X/Y/Z","header");
   Check(data.assets!=null&&data.assets.Length<=2&&data.textures!=null&&data.textures.width==256&&data.textures.height==256,"bounded assets");
   var found=new HashSet<string>();foreach(var a in data.assets){
    Check(a!=null&&Ids.Contains(a.id)&&found.Add(a.id)&&a.assetKey=="tdj/"+a.id&&a.material==(a.id==Ids[0]?"bossStone":"bossMetal"),"identity");
    int n=a.positions?.Length/3??0;Check(n>0&&n<=60000&&a.positions.Length==n*3,"vertex bound");
    Values(a.positions,n*3);Values(a.normals,n*3);Values(a.colors,n*3);Values(a.uv,n*2);Values(a.glow,n);
    Check(a.positions.All(v=>Mathf.Abs(v)<=12)&&a.normals.All(v=>Mathf.Abs(v)<=1.001f)&&a.colors.All(v=>v>=0&&v<=1)&&a.uv.All(v=>v>=0&&v<=1)&&a.glow.All(v=>v==0),"mesh values");
    Check(a.triangles!=null&&a.triangles.Length>0&&a.triangles.Length<=180000&&a.triangles.Length%3==0&&a.triangles.All(i=>i>=0&&i<n),"indices");
    Check(Finite(a.radius)&&a.radius>=0&&a.radius<=12&&Finite(a.height)&&a.height>0&&a.height<=12&&a.groundSink==0&&a.shape,"static collider contract");
   }
   Png(data.textures.colour);Png(data.textures.packed);return data;
  }catch(Exception e)when(e is InvalidDataException||e is FormatException||e is ArgumentException||e is NullReferenceException){Debug.LogWarning("Optional boss doors ignored; existing assets retained: "+e.Message);return null;}
 }
 static float Number(string s){float n=float.Parse(s,CultureInfo.InvariantCulture);Check(Finite(n),"placement finite");return n;}
 public static int Build(string directory,string folder,Transform parent,Dictionary<string,GameObject> prefabs,SmallPropsV1.Data data){
  var d=data.bossDoorsV1;if(d==null||d.assets.Length==0)return 0;
  var colour=SharedImportCache.Image(Convert.FromBase64String(d.textures.colour),".png",true,true,TextureWrapMode.Clamp,FilterMode.Trilinear,2,256);
  var packed=SharedImportCache.Image(Convert.FromBase64String(d.textures.packed),".png",false,true,TextureWrapMode.Clamp,FilterMode.Trilinear,2,256);
  var shader=Shader.Find("MapSharedProps/BossDoor");Check(shader&&shader.isSupported,"URP boss door shader");
  string path=folder+"/boss-doors-shared.mat";var material=AssetDatabase.LoadAssetAtPath<Material>(path);
  if(!material){Check(!File.Exists(path)&&!File.Exists(path+".meta"),"occupied material path");material=new Material(shader){name="Boss doors shared PBR",enableInstancing=true};AssetDatabase.CreateAsset(material,path);}
  material.shader=shader;material.SetTexture("_BaseMap",colour);material.SetTexture("_PackedMap",packed);material.SetColor("_BaseColor",Color.white);EditorUtility.SetDirty(material);
  foreach(var a in d.assets){
   var mesh=SmallPropsV1.MeshOf(a.positions,a.normals,a.colors,a.triangles,a.glow);var uv=new Vector2[a.uv.Length/2];for(int i=0;i<uv.Length;i++)uv[i]=new Vector2(a.uv[i*2],1-a.uv[i*2+1]);mesh.uv=uv;
   mesh=SharedImportCache.StoreMesh(mesh,"boss-doors/1\n"+JsonUtility.ToJson(a));
   var root=new GameObject(a.id);root.AddComponent<MeshFilter>().sharedMesh=mesh;var renderer=root.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.shadowCastingMode=ShadowCastingMode.On;renderer.receiveShadows=true;renderer.reflectionProbeUsage=ReflectionProbeUsage.BlendProbes;
   SmallPropsV1.Collider(root,a,mesh);
   var prefab=PrefabUtility.SaveAsPrefabAsset(root,folder+"/small-"+a.id+".prefab");prefabs.Add(a.id,prefab);UnityEngine.Object.DestroyImmediate(root);
  }
  int placed=0;foreach(var line in File.ReadAllLines(Path.Combine(directory,"props.csv"))){var row=line.Split(',');if(row.Length!=11||!d.assets.Any(a=>a.id==row[1]&&a.assetKey==row[2]))continue;float sx=Number(row[7]),sy=Number(row[8]);Check(sx>0&&sy>0,"positive scales");var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefabs[row[1]],parent);obj.name=row[0];obj.transform.localPosition=new Vector3(Number(row[3]),Number(row[4]),Number(row[5]));obj.transform.localRotation=Quaternion.Euler(0,Number(row[6]),0);obj.transform.localScale=new Vector3(sx,sy,sx);placed++;}
  return placed;
 }
}
}
