using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace MapWater.EditorTools {
// MapWaterBuilder の「作らない場合」の確認（GUI の撮影の前、同じ Unity の起動で）。人工の入力を作り、前後で GameObject・資産の数が変わらず、
// 例外が出ず、理由が1行ログに出ることを確かめる。結果は -mwOutput/builder_checks.json。
//   -executeMethod MapWater.EditorTools.MapWaterBuilderChecks.Run  -mwOutput <フォルダ>  -mwSample <正しい書き出しのフォルダ>
public static class MapWaterBuilderChecks {
 static string Arg(string name) { var a = Environment.GetCommandLineArgs(); for (int i = 0; i < a.Length - 1; i++) if (a[i] == name) return a[i + 1]; return null; }
 [Serializable] class Row { public string name; public bool ok; public bool built; public string message; public int goBefore, goAfter, assetsBefore, assetsAfter; }
 [Serializable] class Out { public List<Row> rows = new List<Row>(); public int failed; }

 static int Assets() { return Directory.Exists(MapWaterBuilder.GeneratedDir) ? Directory.GetFiles(MapWaterBuilder.GeneratedDir, "*", SearchOption.AllDirectories).Length : 0; }
 static int GOs() { return UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsInactive.Include).Length; }

 public static void Run() {
  var o = new Out(); string tmp = Path.Combine(Path.GetTempPath(), "mapwater_checks_" + Guid.NewGuid().ToString("N"));
  try {
   string output = Path.GetFullPath(Arg("-mwOutput") ?? throw new Exception("-mwOutput が必要です")), sample = Arg("-mwSample");
   Directory.CreateDirectory(output); Directory.CreateDirectory(tmp);
   var cases = new List<(string name, string dir, bool expectBuilt)>();
   string Make(string n, Action<string> setup) { string d = Path.Combine(tmp, n); Directory.CreateDirectory(d); setup(d); return d; }
   void Copy(string d, params string[] files) { foreach (var f in files) File.Copy(Path.Combine(sample, f), Path.Combine(d, f), true); }
   string text(string f) => File.ReadAllText(Path.Combine(sample, f));
   cases.Add(("書き出しのフォルダが無い", Path.Combine(tmp, "none"), false));
   cases.Add(("meta.json が無い", Make("nometa", d => { }), false));
   cases.Add(("meta.json が壊れている", Make("badmeta", d => File.WriteAllText(Path.Combine(d, "meta.json"), "{ not json")), false));
   cases.Add(("古い書き出し（waterSim 無し）", Make("old", d => { var m = text("meta.json"); int i = m.IndexOf("\"waterSim\""); File.WriteAllText(Path.Combine(d, "meta.json"), RemoveKey(m, "waterSim")); Copy(d, "heightmap_r16.raw"); }), false));
   cases.Add(("海（available=false）", Make("sea", d => { File.WriteAllText(Path.Combine(d, "meta.json"), Replace(text("meta.json"), "\"available\": true", "\"available\": false, \"reason\": \"sea (surf) is not supported yet\"")); Copy(d, "heightmap_r16.raw", "water_flow.png", "water_mask.png"); }), false));
   cases.Add(("溶岩（available=false）", Make("lava", d => { File.WriteAllText(Path.Combine(d, "meta.json"), Replace(text("meta.json"), "\"available\": true", "\"available\": false, \"reason\": \"liquid=lava is not supported yet\"")); Copy(d, "heightmap_r16.raw"); }), false));
   cases.Add(("画像が欠けている（water_mask.png 無し）", Make("nomask", d => { Copy(d, "meta.json", "heightmap_r16.raw", "water_flow.png"); }), false));
   cases.Add(("heightmap が欠けている", Make("noraw", d => { Copy(d, "meta.json", "water_flow.png", "water_mask.png"); }), false));
   cases.Add(("heightmap の大きさが違う", Make("badraw", d => { Copy(d, "meta.json", "water_flow.png", "water_mask.png"); File.WriteAllBytes(Path.Combine(d, "heightmap_r16.raw"), new byte[100]); }), false));
   foreach (var (name, dir, expectBuilt) in cases) {
    int g0 = GOs(), a0 = Assets(); Row row = new Row { name = name, goBefore = g0, assetsBefore = a0 };
    try {
     var r = MapWaterBuilder.Build(dir, null, Vector3.zero, "check"); row.built = r.built; row.message = r.message;
     if (r.root != null) UnityEngine.Object.DestroyImmediate(r.root);
    } catch (Exception e) { row.message = "例外 " + e.Message; row.built = true; }
    row.goAfter = GOs(); row.assetsAfter = Assets();
    row.ok = !row.built && row.goAfter == row.goBefore && row.assetsAfter == row.assetsBefore && !string.IsNullOrEmpty(row.message) && row.message.StartsWith("MapWater: 水は作りません");
    if (!row.ok) o.failed++; o.rows.Add(row);
   }
   File.WriteAllText(Path.Combine(output, "builder_checks.json"), JsonUtility.ToJson(o, true));
   foreach (var r in o.rows) Debug.Log((r.ok ? "CHECK PASS " : "CHECK FAIL ") + r.name + " | " + r.message);
   try { Directory.Delete(tmp, true); } catch { }
   EditorApplication.Exit(o.failed == 0 ? 0 : 3);
  } catch (Exception e) { Debug.LogException(e); EditorApplication.Exit(2); }
 }
 static string Replace(string s, string a, string b) { if (!s.Contains(a)) throw new Exception("置換元が見つかりません: " + a); return s.Replace(a, b); }
 // "key": {...} の1つを、波括弧の対応で取り除く
 static string RemoveKey(string s, string key) {
  int i = s.IndexOf("\"" + key + "\""); if (i < 0) throw new Exception("キーが見つかりません: " + key);
  int b = s.IndexOf('{', i), depth = 0, j = b; for (; j < s.Length; j++) { if (s[j] == '{') depth++; else if (s[j] == '}') { depth--; if (depth == 0) break; } }
  int start = i; int end = j + 1; if (end < s.Length && s[end] == ',') end++; else { int k = start - 1; while (k > 0 && char.IsWhiteSpace(s[k])) k--; if (s[k] == ',') start = k; }
  return s.Remove(start, end - start);
 }
}
}
