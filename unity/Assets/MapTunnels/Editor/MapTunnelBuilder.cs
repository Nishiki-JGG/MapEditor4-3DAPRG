using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace MapTunnels.EditorTools {
// マップエディターの書き出しのフォルダから、トンネル（床・壁・天井・坑口の枠・灯り・口のまわりの地面）を作る。
//   MapTunnelBuilder.Build(exportDir) → Result。meta.json に tunnels が無ければ何も作らない（落ちずに理由を返す）。
// 作る物：網 1 つ（部分網 = floor / wall / ceiling / portal / frame / lamp / shaft / cap、MapTunnels/Tunnel の材質 3 つ）、当たり判定
// （floor・wall・ceiling・cap の MeshCollider）、灯りの Point Light、屋根の透かし（MapTunnelCutaway。主人公とカメラは
// ゲーム側で入れる）。地形の穴は holes.png（-2 のセル）をゲーム側で TerrainData.SetHoles に入れる。
public static class MapTunnelBuilder {
 public const string RuntimeDir = "Assets/MapTunnels/Runtime", GeneratedDir = "Assets/MapTunnelsGenerated";
 [Serializable] class SubDto { public string name; public int[] triangles; }
 [Serializable] class MeshDto { public string format; public float[] vertices, normals, colors; public SubDto[] submeshes; }
 public sealed class Result { public bool built; public string message; public GameObject root; public int triangles, lights; }

 public static Result Build(string exportDir, Transform parent = null, Vector3? origin = null, string assetName = null) {
  var res = new Result();
  Result Fail(string why) { res.message = "MapTunnels: トンネルは作りません — " + why; Debug.Log(res.message); return res; }
  try {
   string metaPath = Path.Combine(exportDir ?? "", "meta.json"), meshPath = Path.Combine(exportDir ?? "", "tunnels_mesh.json");
   if (!File.Exists(metaPath)) return Fail("meta.json がありません");
   if (!File.Exists(meshPath)) return Fail("tunnels_mesh.json がありません（トンネルの無い書き出し）");
   var meshDto = JsonUtility.FromJson<MeshDto>(File.ReadAllText(meshPath));
   if (meshDto == null || meshDto.vertices == null || meshDto.submeshes == null) return Fail("tunnels_mesh.json を読めません");
   // meta.json の tunnels（線・灯り）は、JsonUtility が入れ子の配列を読めないので、必要な所だけ切り出して読む
   var lamps = ReadLamps(File.ReadAllText(metaPath)); var lines = ReadLines(File.ReadAllText(metaPath));
   var shader = Shader.Find("MapTunnels/Tunnel");
   if (shader == null) return Fail("shader MapTunnels/Tunnel が見つかりません（Assets/MapTunnels/Runtime/Shaders）");

   int nv = meshDto.vertices.Length / 3; var pos = new Vector3[nv]; var col = new Color[nv];
   for (int k = 0; k < nv; k++) { pos[k] = new Vector3(meshDto.vertices[k * 3], meshDto.vertices[k * 3 + 1], meshDto.vertices[k * 3 + 2]); col[k] = meshDto.colors != null && meshDto.colors.Length >= nv * 3 ? new Color(meshDto.colors[k * 3], meshDto.colors[k * 3 + 1], meshDto.colors[k * 3 + 2], 1) : Color.gray; }
   var mesh = new Mesh { name = "Tunnels", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 }; mesh.vertices = pos; mesh.colors = col; mesh.subMeshCount = meshDto.submeshes.Length;
   var solid = new List<int>();
   for (int s = 0; s < meshDto.submeshes.Length; s++) {
    var tri = meshDto.submeshes[s].triangles ?? new int[0]; mesh.SetTriangles(tri, s); res.triangles += tri.Length / 3;
    string n = meshDto.submeshes[s].name; if (n == "floor" || n == "wall" || n == "ceiling" || n == "cap") solid.AddRange(tri);
   }
   // 法線は書き出しのもの（version 2：岩肌はなめらか、石・木は平ら）。無ければ計算する
   if (meshDto.normals != null && meshDto.normals.Length == nv * 3) { var nor = new Vector3[nv]; for (int k = 0; k < nv; k++) nor[k] = new Vector3(meshDto.normals[k * 3], meshDto.normals[k * 3 + 1], meshDto.normals[k * 3 + 2]); mesh.normals = nor; }
   else mesh.RecalculateNormals();
   mesh.RecalculateBounds();
   var colMesh = new Mesh { name = "TunnelsCollider", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 }; colMesh.vertices = pos; colMesh.SetTriangles(solid, 0); colMesh.RecalculateBounds();

   string name = assetName ?? new DirectoryInfo(exportDir).Name, dir = GeneratedDir + "/" + name;
   Directory.CreateDirectory(dir); AssetDatabase.Refresh();
   T Save<T>(T obj, string file) where T : UnityEngine.Object { string p = dir + "/" + file; AssetDatabase.DeleteAsset(p); AssetDatabase.CreateAsset(obj, p); return AssetDatabase.LoadAssetAtPath<T>(p); }
   mesh = Save(mesh, "Tunnels.mesh.asset"); colMesh = Save(colMesh, "TunnelsCollider.mesh.asset");
   var rock = Save(new Material(shader) { name = "Tunnel" }, "Tunnel.mat"); var lampMat = Save(new Material(shader) { name = "TunnelLamp" }, "TunnelLamp.mat"); lampMat.SetFloat("_Emission", 1); EditorUtility.SetDirty(lampMat);
   var shaftMat = Save(new Material(shader) { name = "TunnelShaft" }, "TunnelShaft.mat"); shaftMat.SetFloat("_Shaft", 1); EditorUtility.SetDirty(shaftMat);
   var mats = new Material[meshDto.submeshes.Length]; for (int s = 0; s < mats.Length; s++) { string n = meshDto.submeshes[s].name; mats[s] = n == "lamp" ? lampMat : n == "shaft" ? shaftMat : rock; }

   var root = new GameObject("MapTunnels_" + name); if (parent != null) root.transform.SetParent(parent, false);
   root.transform.position = origin ?? (parent != null ? parent.position : Vector3.zero);
   var go = new GameObject("Tunnels"); go.transform.SetParent(root.transform, false);
   go.AddComponent<MeshFilter>().sharedMesh = mesh; var r = go.AddComponent<MeshRenderer>(); r.sharedMaterials = mats;
   go.AddComponent<MeshCollider>().sharedMesh = colMesh;
   foreach (var l in lamps) {
    var lg = new GameObject("TunnelLamp"); lg.transform.SetParent(root.transform, false); lg.transform.localPosition = l.Key;
    var light = lg.AddComponent<Light>(); light.type = LightType.Point; light.range = 7f; light.intensity = 2.2f; light.color = l.Value; light.shadows = LightShadows.None; res.lights++;
   }
   var cut = root.AddComponent<MapTunnelCutaway>(); cut.segments.AddRange(lines); cut.terrain = Terrain.activeTerrain;
   AssetDatabase.SaveAssets();
   res.built = true; res.root = root;
   res.message = $"MapTunnels: 作りました — {root.name}（三角形 {res.triangles}、灯り {res.lights}、線 {lines.Count}。主人公は MapTunnelCutaway.hero に入れてください）";
   Debug.Log(res.message); return res;
  } catch (Exception e) { res.message = "MapTunnels: 例外 — " + e; Debug.LogError(res.message); return res; }
 }

 // meta.json の "tunnels": [...] の中から、灯り（lamps[].position・color）と線（points・width・height）を拾う。
 // 書き出しは JSON.stringify(…, null, 2) の決まった形なので、括弧の対応だけで切り出す（入れ子の配列は JsonUtility が読めない）
 static string Section(string json, string key) {
  int i = json.IndexOf("\"" + key + "\": [", StringComparison.Ordinal); if (i < 0) return null; i = json.IndexOf('[', i);
  int depth = 0; for (int k = i; k < json.Length; k++) { if (json[k] == '[') depth++; else if (json[k] == ']' && --depth == 0) return json.Substring(i, k - i + 1); }
  return null;
 }
 static List<float> Numbers(string s) { var o = new List<float>(); foreach (var t in s.Split(new[] { ',', '[', ']', ' ', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)) if (float.TryParse(t, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var v)) o.Add(v); return o; }
 static List<string> Objects(string arr) {
  var o = new List<string>(); int depth = 0, start = -1;
  for (int k = 0; k < arr.Length; k++) { char c = arr[k]; if (c == '{') { if (depth++ == 0) start = k; } else if (c == '}' && --depth == 0) o.Add(arr.Substring(start, k - start + 1)); }
  return o;
 }
 static List<KeyValuePair<Vector3, Color>> ReadLamps(string json) {
  var o = new List<KeyValuePair<Vector3, Color>>(); var tun = Section(json, "tunnels"); if (tun == null) return o;
  foreach (var t in Objects(tun.Substring(1, tun.Length - 2))) { var la = Section(t, "lamps"); if (la == null) continue;
   foreach (var l in Objects(la)) { var p = Section(l, "position"); if (p == null) continue; var v = Numbers(p); if (v.Count < 3) continue;
    int ci = l.IndexOf("\"color\": \"#", StringComparison.Ordinal); var c = Color.white; if (ci >= 0) ColorUtility.TryParseHtmlString(l.Substring(ci + 10, 7), out c);
    o.Add(new KeyValuePair<Vector3, Color>(new Vector3(v[0], v[1], v[2]), c)); } }
  return o;
 }
 static List<MapTunnelCutaway.Segment> ReadLines(string json) {
  var o = new List<MapTunnelCutaway.Segment>(); var tun = Section(json, "tunnels"); if (tun == null) return o;
  foreach (var t in Objects(tun.Substring(1, tun.Length - 2))) {
   float W(string key) { int i = t.IndexOf("\"" + key + "\": ", StringComparison.Ordinal); if (i < 0) return 0; var s = t.Substring(i + key.Length + 4); int e = s.IndexOfAny(new[] { ',', '\n' }); float.TryParse(e > 0 ? s.Substring(0, e) : s, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var v); return v; }
   var pts = Section(t, "points"); if (pts == null) continue; var v = Numbers(pts); float w = W("width"), h = W("height");
   for (int k = 0; k + 5 < v.Count; k += 3) o.Add(new MapTunnelCutaway.Segment { a = new Vector3(v[k], v[k + 1], v[k + 2]), b = new Vector3(v[k + 3], v[k + 4], v[k + 5]), halfWidth = w / 2, height = h });
  }
  return o;
 }
}
}
