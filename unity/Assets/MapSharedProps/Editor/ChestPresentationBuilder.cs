using System;using System.IO;using System.Collections.Generic;using UnityEngine;using UnityEditor;using UnityEngine.Rendering;
namespace MapSharedProps.EditorTools {
// Optional top-level presentation data. Root Asset and mesh/collider cache keys remain frozen.
public sealed class ChestPresentationBuilder {
 [Serializable] public class Geometry {public float[] positions,normals,colors,glow,uv;public int[] triangles;}
 [Serializable] public class Ornament {public string id,assetKey;public Geometry mesh;public float[] finish;}
 [Serializable] public class Slot {public int kind;public float[] start,end,width,color;public float phase;}
 [Serializable] public class Effect {public string id,assetKey;public int version;public Slot[] slots;}
 readonly SmallPropsV1.Data data;readonly string folder;readonly ChestSurfaceBuilder surfaces;
 readonly Dictionary<string,Mesh> ornaments=new Dictionary<string,Mesh>(),effects=new Dictionary<string,Mesh>();
 readonly Dictionary<string,Material> materials=new Dictionary<string,Material>();
 public ChestPresentationBuilder(SmallPropsV1.Data data,string folder){this.data=data;this.folder=folder;surfaces=new ChestSurfaceBuilder(data);}
 static void Check(bool v,string why){if(!v)throw new InvalidDataException("Chest presentation: "+why);}
 static bool Finite(float x){return !float.IsNaN(x)&&!float.IsInfinity(x);}
 static void Floats(float[] a,int n,float max){Check(a!=null&&a.Length==n,"length");foreach(var x in a)Check(Finite(x)&&Mathf.Abs(x)<=max,"finite range");}
 public static void Validate(SmallPropsV1.Data d){
  var ids=new HashSet<string>();foreach(var a in d.chestOrnamentsV1??new Ornament[0]){Check(a!=null&&(a.id=="treasurechest_silver"||a.id=="treasurechest_gold"||a.id=="treasurechest_rainbow")&&ids.Add(a.id)&&a.assetKey=="tdj/"+a.id&&Array.Exists(d.assets,x=>x.id==a.id),"ornament ID");var g=a.mesh;Check(g!=null&&g.positions!=null&&g.positions.Length>0&&g.positions.Length%3==0&&g.positions.Length<45000,"mesh size");int n=g.positions.Length/3;Floats(g.positions,n*3,2);Floats(g.normals,n*3,1.001f);Floats(g.colors,n*3,2);Floats(g.glow,n,2);Floats(g.uv,n*2,1);Floats(a.finish,n,1);foreach(var f in a.finish)Check(f==0||f==1,"finish");Check(g.triangles!=null&&g.triangles.Length%3==0&&g.triangles.Length<45000,"triangles");foreach(var i in g.triangles)Check(i>=0&&i<n,"index");}
  ids.Clear();foreach(var a in d.chestEffectsV1??new Effect[0]){bool gold=a!=null&&a.id=="treasurechest_gold";Check(a!=null&&(gold||a.id=="treasurechest_rainbow")&&ids.Add(a.id)&&a.assetKey=="tdj/"+a.id&&a.version==1&&Array.Exists(d.assets,x=>x.id==a.id),"effect ID/version");Check(a.slots!=null&&a.slots.Length==(gold?6:16),"bounded slots");foreach(var s in a.slots){Check(s!=null&&(gold?s.kind==0:s.kind>=1&&s.kind<=3),"slot kind");Floats(s.start,3,1.4f);Floats(s.end,3,1.4f);Floats(s.width,2,.4f);Floats(s.color,4,2);Check(s.width[0]>0&&s.width[1]>0&&s.color[3]>=0&&s.color[3]<=.7f&&Finite(s.phase)&&s.phase>=0&&s.phase<=4,"slot range");}}
  ValidateOptionalEffects(d);

 }
 // Validate optional presentation independently: malformed V2 must not prevent valid V1 imports.
 static void ValidateOptionalEffects(SmallPropsV1.Data d){
  if(d.chestEffectsV2==null)return;
  try{
   var ids=new HashSet<string>();foreach(var a in d.chestEffectsV2??new Effect[0]){Check(a!=null&&a.id=="treasurechest_gold"&&ids.Add(a.id)&&a.assetKey=="tdj/"+a.id&&a.version==2&&Array.Exists(d.assets,x=>x.id==a.id)&&Array.Exists(d.chestEffectsV1??new Effect[0],x=>x.id==a.id),"extended effect ID/version");Check(a.slots!=null&&a.slots.Length>6&&a.slots.Length<=32,"extended bounded slots");foreach(var v in a.slots){Check(v!=null&&v.kind==0,"extended slot kind");Floats(v.start,3,1.4f);Floats(v.end,3,1.4f);Floats(v.width,2,.4f);Floats(v.color,4,2);Check(v.width[0]>0&&v.width[1]>0&&v.color[3]>=0&&v.color[3]<=.7f&&Finite(v.phase)&&v.phase>=0&&v.phase<=4,"extended slot range");}}
  }catch(InvalidDataException e){
   d.chestEffectsV2=null;
   Debug.LogWarning("Ignoring optional chestEffectsV2; using chestEffectsV1: "+e.Message);
  }
 }

 Material Material(string key,bool fx,bool rainbow,string id=""){if(materials.TryGetValue(key,out var m))return m;var shader=Shader.Find(fx?"MapSharedProps/ChestFx":"MapSharedProps/ChestMetal");Check(shader!=null&&shader.isSupported,"shader "+key);m=new Material(shader){name="chest-"+key,enableInstancing=true};if(!fx){m.EnableKeyword("CHEST_ORNAMENT");m.SetColor("_BaseColor",Color.white);m.SetFloat("_Rainbow",rainbow?1:0);m.SetFloat("_ChestTime",-1);if(surfaces.HasOrnament(id))surfaces.Configure(m,id);}AssetDatabase.CreateAsset(m,folder+"/chest-"+key+".mat");materials.Add(key,m);return m;}
 Mesh OrnamentMesh(Ornament a){if(ornaments.TryGetValue(a.id,out var m))return m;var g=a.mesh;m=SmallPropsV1.MeshOf(g.positions,g.normals,g.colors,g.triangles,g.glow);var finish=new List<Vector2>();foreach(var f in a.finish)finish.Add(new Vector2(f,0));m.SetUVs(3,finish);surfaces.ApplyOrnament(m,a.id);surfaces.ApplyRoyalOrnament(m,a.id,g.uv);m.name=a.id+"-side-relief";m=SharedImportCache.StoreMesh(m,"chest-ornament/1\n"+JsonUtility.ToJson(a)+surfaces.OrnamentKey(a.id));ornaments.Add(a.id,m);return m;}
 Mesh EffectMesh(Effect a){if(effects.TryGetValue(a.id,out var m))return m;var p=new List<Vector3>();var uv=new List<Vector2>();var start=new List<Vector4>();var end=new List<Vector4>();var shape=new List<Vector4>();var colors=new List<Color>();var ix=new List<int>();foreach(var s in a.slots){int n=p.Count;for(int j=0;j<4;j++){float x=j%2,y=j/2;p.Add(new Vector3(x-.5f,y-.5f,0));uv.Add(new Vector2(x,y));start.Add(new Vector4(s.start[0],s.start[1],s.start[2],s.kind));end.Add(new Vector4(s.end[0],s.end[1],s.end[2],s.phase));shape.Add(new Vector4(s.width[0],s.width[1],0,0));colors.Add(new Color(s.color[0],s.color[1],s.color[2],s.color[3]));}ix.AddRange(new[]{n,n+2,n+1,n+1,n+2,n+3});}m=new Mesh{name=a.id+"-bounded-fx"};m.SetVertices(p);m.SetUVs(0,uv);m.SetUVs(1,start);m.SetUVs(2,end);m.SetUVs(3,shape);m.SetColors(colors);m.SetTriangles(ix,0);m.bounds=new Bounds(new Vector3(0,.55f,0),new Vector3(1.85f,1.5f,1.7f));m=SharedImportCache.StoreMesh(m,"chest-fx/1\n"+JsonUtility.ToJson(a));effects.Add(a.id,m);return m;}
 public void Attach(GameObject root,string id){var o=Array.Find(data.chestOrnamentsV1??new Ornament[0],x=>x.id==id);if(o!=null){var child=new GameObject("Side relief");child.transform.SetParent(root.transform,false);child.AddComponent<MeshFilter>().sharedMesh=OrnamentMesh(o);var r=child.AddComponent<MeshRenderer>();r.sharedMaterial=Material((id=="treasurechest_rainbow"?"relief-rainbow":"relief-metal")+(surfaces.HasOrnament(id)?"-cast-"+id:""),false,id=="treasurechest_rainbow",id);r.shadowCastingMode=ShadowCastingMode.On;r.receiveShadows=true;}var e=Array.Find(data.chestEffectsV2??new Effect[0],x=>x.id==id)??Array.Find(data.chestEffectsV1??new Effect[0],x=>x.id==id);if(e!=null){var child=new GameObject("Bounded seam light and motes");child.transform.SetParent(root.transform,false);child.AddComponent<MeshFilter>().sharedMesh=EffectMesh(e);var r=child.AddComponent<MeshRenderer>();r.sharedMaterial=Material("fx",true,false);r.shadowCastingMode=ShadowCastingMode.Off;r.receiveShadows=false;root.AddComponent<ChestPresentation>().Configure(r);}}
}
}
