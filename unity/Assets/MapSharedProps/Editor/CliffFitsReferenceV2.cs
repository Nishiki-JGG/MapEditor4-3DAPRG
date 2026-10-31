#if UNITY_EDITOR
using System;
using MapSharedProps.EditorTools;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
namespace TotsuDan.MapEditor {
 public static class CliffFitsReferenceV2 {
  [Serializable] sealed class Meta{public string[] requiredFeatures;public FitRef cliffFits;}
  [Serializable] sealed class FitRef{public string file;public string[] instanceIds;}
  [Serializable] sealed class Doc{public string format,requiredFeature,library;public int formatVersion;public Entry[] instances;}
  [Serializable] sealed class Entry{public string instanceId,type,sourceSha256,material;public float[] matrix,instanceTint;public bool replaceRenderer,replaceCollider;}
  [Serializable] sealed class Library{public string format;public int version;public Model[] assets;}
  [Serializable] sealed class Model{public string id,type;public float[] positions,normals,colors,uvs;public int[] triangles;}
  static void Check(bool v,string m){if(!v)throw new ArgumentException(m);}
  static bool Finite(float f)=>!float.IsNaN(f)&&!float.IsInfinity(f);
  public static void Apply(string metaJson,string json,string sourceJson,IReadOnlyDictionary<string,GameObject> byId,IReadOnlyDictionary<string,string> sourceHashes,Material material,Transform root){
   Check(root&&material,"岩の材質と原点が必要です");
   var meta=JsonUtility.FromJson<Meta>(metaJson);var doc=JsonUtility.FromJson<Doc>(json);var lib=JsonUtility.FromJson<Library>(sourceJson);
   Check(meta?.cliffFits?.file=="cliff_fits_mesh.json"&&Array.IndexOf(meta.requiredFeatures??Array.Empty<string>(),"cliffFitsReferenceV2")>=0,"岩の参照形式指定がありません");
   Check(doc?.format=="tdj-cliff-fits-reference"&&doc.formatVersion==2&&doc.requiredFeature=="cliffFitsReferenceV2"&&doc.library=="cliff_sources.json"&&doc.instances!=null,"非対応の岩参照形式");
   Check(lib?.format=="map-cliff-sources"&&lib.version==1&&lib.assets!=null,"共通岩の形式が違います");
   var models=new Dictionary<string,Model>();
   foreach(var m in lib.assets){Check(m!=null&&!String.IsNullOrEmpty(m.id)&&!models.ContainsKey(m.id),"共通岩IDの重複");Check(m.positions!=null&&m.positions.Length>=9&&m.positions.Length<=90000&&m.positions.Length%3==0&&m.normals!=null&&m.normals.Length==m.positions.Length&&m.triangles!=null&&m.triangles.Length%3==0,"共通岩の形状が不正です");int n=m.positions.Length/3;Check(m.colors!=null&&(m.colors.Length==0||m.colors.Length==n*3)&&m.uvs!=null&&(m.uvs.Length==0||m.uvs.Length==n*2),"共通岩の色/UVが不正です");foreach(var values in new[]{m.positions,m.normals,m.colors,m.uvs})foreach(var v in values)Check(Finite(v),"共通岩に非有限値");foreach(int i in m.triangles)Check(i>=0&&i<n,"共通岩の面範囲が不正です");models.Add(m.id,m);}
   var expected=new HashSet<string>(meta.cliffFits.instanceIds??Array.Empty<string>());var seen=new HashSet<string>();
   foreach(var e in doc.instances){Check(e!=null&&!String.IsNullOrEmpty(e.instanceId)&&seen.Add(e.instanceId)&&expected.Contains(e.instanceId)&&byId.TryGetValue(e.instanceId,out var go)&&go,"岩の配置IDが不正です");Check(sourceHashes.TryGetValue(e.type,out var hash)&&hash==e.sourceSha256&&models.TryGetValue(hash,out var m)&&m.type==e.type,"岩の共通部品の版が違います");Check(e.replaceRenderer&&e.replaceCollider&&e.material=="rock"&&e.matrix!=null&&e.matrix.Length==16&&Array.TrueForAll(e.matrix,Finite),"岩の配置行列が不正です");Check(e.instanceTint==null||(e.instanceTint.Length==3&&Array.TrueForAll(e.instanceTint,v=>Finite(v)&&v>=0&&v<=4)),"岩の色が不正です");var matrix=Matrix(e.matrix);Check(Mathf.Abs(matrix.determinant)>1e-9f&&matrix.m30==0&&matrix.m31==0&&matrix.m32==0&&matrix.m33==1,"岩の配置行列が退化しています");}
   Check(expected.SetEquals(seen),"岩ID一覧が一致しません");
   var meshes=new Dictionary<string,Mesh>();
   foreach(var e in doc.instances){
    if(!meshes.TryGetValue(e.sourceSha256,out var mesh)){var m=models[e.sourceSha256];mesh=SharedImportCache.GetOrCreateMesh("affine-rock-source/1\n"+JsonUtility.ToJson(m),()=>Create(m));meshes.Add(e.sourceSha256,mesh);}
    var original=byId[e.instanceId];foreach(var r in original.GetComponentsInChildren<Renderer>(true))r.enabled=false;foreach(var c in original.GetComponentsInChildren<Collider>(true))c.enabled=false;
    var o=new GameObject("CliffFit_"+e.instanceId);o.transform.SetParent(root,false);var rock=o.AddComponent<MapAffineRock>();o.GetComponent<MeshRenderer>().sharedMaterial=material;rock.Configure(mesh,Matrix(e.matrix),e.instanceTint==null?Color.white:new Color(e.instanceTint[0],e.instanceTint[1],e.instanceTint[2]));
   }
  }
  static Matrix4x4 Matrix(float[] a){var m=new Matrix4x4();for(int i=0;i<16;i++)m[i]=a[i];return m;}
  static Mesh Create(Model m){int n=m.positions.Length/3;var v=new Vector3[n];var normal=new Vector3[n];var color=new Color[n];var uv=new Vector2[m.uvs.Length/2];for(int i=0;i<n;i++){v[i]=new Vector3(m.positions[i*3],m.positions[i*3+1],m.positions[i*3+2]);normal[i]=new Vector3(m.normals[i*3],m.normals[i*3+1],m.normals[i*3+2]);color[i]=m.colors.Length==0?Color.white:new Color(m.colors[i*3],m.colors[i*3+1],m.colors[i*3+2]);}for(int i=0;i<uv.Length;i++)uv[i]=new Vector2(m.uvs[i*2],m.uvs[i*2+1]);var mesh=new Mesh{name="SharedRock_"+m.type,indexFormat=n>65535?IndexFormat.UInt32:IndexFormat.UInt16};mesh.vertices=v;mesh.normals=normal;mesh.colors=color;mesh.uv=uv;mesh.triangles=m.triangles;mesh.RecalculateBounds();return mesh;}
 }
}
#endif
