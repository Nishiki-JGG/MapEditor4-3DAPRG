// 確定岩メッシュの補助読込器。ゲーム本体への自動接続は行わない。
#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEditor;
namespace TotsuDan.MapEditor {
public static class CliffFitsMeshV1 {
 [Serializable] sealed class Meta { public string[] requiredFeatures; public FitReference cliffFits; }
 [Serializable] sealed class FitReference { public string file; public string[] instanceIds; }
 [Serializable] sealed class Document { public string format; public int formatVersion; public string requiredFeature; public Entry[] instances; }
 [Serializable] sealed class Entry { public string instanceId, type, sourceSha256, material; public float[] positions,normals,colors,uvs,instanceTint; public int[] triangles; public bool replaceRenderer,replaceCollider; }
 // 呼出側はprops.csvと同じIDで配置したオブジェクトと、元部品の検証済みSHAを渡す。
 public static void Apply(string metaJson,string meshJson,IReadOnlyDictionary<string,GameObject> byId,IReadOnlyDictionary<string,string> sourceHashes,Material rockMaterial,Transform mapRoot) {
  if(!rockMaterial||!mapRoot) throw new ArgumentException("岩の材質とマップ原点が必要です");
  if(mapRoot.position!=Vector3.zero||mapRoot.rotation!=Quaternion.identity||mapRoot.lossyScale!=Vector3.one) throw new ArgumentException("マップ原点のTransformは単位行列が必要です");
  var meta=JsonUtility.FromJson<Meta>(metaJson);var d=JsonUtility.FromJson<Document>(meshJson);
  if(meta==null||meta.requiredFeatures==null||Array.IndexOf(meta.requiredFeatures,"cliffFitsMeshV1")<0||meta.cliffFits==null||meta.cliffFits.file!="cliff_fits_mesh.json")throw new ArgumentException("meta.jsonの加工岩対応指定がありません");
  foreach(var feature in meta.requiredFeatures)if(feature!="cliffFitsMeshV1")throw new NotSupportedException("未対応の必須形式: "+feature);
  if(d==null||d.format!="tdj-cliff-fits-mesh"||d.formatVersion!=1||d.requiredFeature!="cliffFitsMeshV1"||d.instances==null)throw new NotSupportedException("非対応の加工岩メッシュ形式");
  var expected=new HashSet<string>(meta.cliffFits.instanceIds??Array.Empty<string>());var seen=new HashSet<string>();var prepared=new List<(Entry entry,Mesh mesh,GameObject original)>();
  try {
   foreach(var e in d.instances) {
    if(e==null||String.IsNullOrEmpty(e.instanceId)||!seen.Add(e.instanceId)||!expected.Contains(e.instanceId)||!byId.TryGetValue(e.instanceId,out var go)||!go)throw new ArgumentException("加工岩のIDが一致しません");
    if(!sourceHashes.TryGetValue(e.type,out var hash)||hash!=e.sourceSha256)throw new ArgumentException("加工岩の元部品SHAが一致しません: "+e.instanceId);
    if(!e.replaceRenderer||!e.replaceCollider||e.material!="rock"||e.positions==null||e.positions.Length%3!=0||e.positions.Length<9||e.normals==null||e.normals.Length!=e.positions.Length||e.triangles==null||e.triangles.Length%3!=0)throw new ArgumentException("加工岩の属性が不正です");
    int n=e.positions.Length/3;if(e.colors!=null&&e.colors.Length!=0&&e.colors.Length!=n*3||e.uvs!=null&&e.uvs.Length!=0&&e.uvs.Length!=n*2||e.instanceTint!=null&&e.instanceTint.Length!=3)throw new ArgumentException("岩の色/UV/色倍率が不正です");var uv=new Vector2[e.uvs!=null&&e.uvs.Length==n*2?n:0];var vertices=new Vector3[n];var normals=new Vector3[n];var colors=new Color[n];
    for(int i=0;i<n;i++){for(int k=0;k<3;k++)if(float.IsNaN(e.positions[i*3+k])||float.IsInfinity(e.positions[i*3+k])||float.IsNaN(e.normals[i*3+k])||float.IsInfinity(e.normals[i*3+k]))throw new ArgumentException("非有限の頂点");vertices[i]=new Vector3(e.positions[i*3],e.positions[i*3+1],e.positions[i*3+2]);normals[i]=new Vector3(e.normals[i*3],e.normals[i*3+1],e.normals[i*3+2]);colors[i]=e.colors!=null&&e.colors.Length==n*3?new Color(e.colors[i*3],e.colors[i*3+1],e.colors[i*3+2]):Color.white;if(e.instanceTint!=null)colors[i]=new Color(colors[i].r*e.instanceTint[0],colors[i].g*e.instanceTint[1],colors[i].b*e.instanceTint[2]);if(uv.Length>0)uv[i]=new Vector2(e.uvs[i*2],e.uvs[i*2+1]);}
    foreach(var index in e.triangles)if(index<0||index>=n)throw new ArgumentException("範囲外の三角形");
    if(go.GetComponentsInChildren<Renderer>(true).Length==0)throw new ArgumentException("置換元Rendererがありません: "+e.instanceId);
    var mesh=new Mesh{name="CliffFit_"+e.instanceId,indexFormat=n>65535?IndexFormat.UInt32:IndexFormat.UInt16};mesh.vertices=vertices;mesh.normals=normals;mesh.colors=colors;if(uv.Length>0)mesh.uv=uv;mesh.triangles=e.triangles;mesh.RecalculateBounds();prepared.Add((e,mesh,go));
   }
   if(!expected.SetEquals(seen))throw new ArgumentException("加工岩のID一覧が一致しません");
  }catch{foreach(var item in prepared)UnityEngine.Object.DestroyImmediate(item.mesh);throw;}
  Undo.IncrementCurrentGroup();int group=Undo.GetCurrentGroup();Undo.SetCurrentGroupName("加工岩の確定形状を適用");
  foreach(var item in prepared){foreach(var renderer in item.original.GetComponentsInChildren<Renderer>(true)){Undo.RecordObject(renderer,"元の岩描画を置換");renderer.enabled=false;}foreach(var collider in item.original.GetComponentsInChildren<Collider>(true)){Undo.RecordObject(collider,"元の岩衝突を置換");collider.enabled=false;}var go=new GameObject("CliffFit_"+item.entry.instanceId);Undo.RegisterCreatedObjectUndo(go,"確定岩");go.transform.SetParent(mapRoot,false);go.AddComponent<MeshFilter>().sharedMesh=item.mesh;go.AddComponent<MeshRenderer>().sharedMaterial=rockMaterial;go.AddComponent<MeshCollider>().sharedMesh=item.mesh;}
  Undo.CollapseUndoOperations(group);
 }
}
}
#endif
