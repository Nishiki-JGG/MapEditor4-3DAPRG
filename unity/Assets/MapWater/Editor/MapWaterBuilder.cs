using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace MapWater.EditorTools {
// マップエディターの書き出しのフォルダから、水（水面・滝・飛沫・制御）を自動で作る。
//   MapWaterBuilder.Build(exportDir) → Result。撮影や Scene の作成とは別の関数（EditMode から単独で呼べる）。
// 作らない場合（落ちずに理由を返す）：meta.json が無い／読めない、waterSim が無い（古い書き出し）、available=false（溶岩・水なし）、
//   画像・heightmap が無い。どの場合も Scene と資産は増えない。
// 海（meta.sea がある書き出し）：エディターと同じ波・泡・光の網目を描く MapWater/Sea の海を作る（BuildSea）。
//   海につながる川・池があれば（waterSim が available）、ふつうの水面も海の下に "Rivers" として作る。その水面は sea_field.png の
//   海の重みで消えるので、海と重ならず、河口では海へ受け渡す。
public static class MapWaterBuilder {
 public const string RuntimeDir = "Assets/MapWater/Runtime", GeneratedDir = "Assets/MapWaterGenerated";

 [Serializable] class TerrainDto { public float[] size; public int heightmapResolution; public float heightRange; public string heightmap; }
 [Serializable] class WaterDto { public string id, liquid; public float level; public bool sea; }
 [Serializable] class SimFallDto { public string id; public float[] plunge; public float radius; public int wetCells; public bool dry; }
 [Serializable] class WaterSimDto { public int version; public bool available; public string reason, flowMap, maskMap; public int resolution; public float maxSpeed, bankRange, trailMaxCover; public SimFallDto[] falls; }
 [Serializable] class FallDto { public string id; public float[] position, upstream, source; public float yawDeg, width, top, bottom; }
 [Serializable] class SeaWavesDto { public float wavelength, period, height, steepenFromDepth, runupHeight, runupReach; public float[] breakDepth; }
 [Serializable] class SeaColorsDto { public float[] shallow, deep; }
 [Serializable] class SeaDto { public int version, resolution; public string field; public float cellSize; public SeaWavesDto waves; public SeaColorsDto colors; public float[] sunDirection; }
 [Serializable] class MetaDto { public TerrainDto terrain; public WaterDto[] water; public WaterSimDto waterSim; public FallDto[] waterfalls; public SeaDto sea; }

 public sealed class Result {
  public bool built; public string message; public GameObject root; public MapWaterController controller;
  public int gameObjects, materials, textures, meshes;
 }

 public static Result Build(string exportDir, Transform parent = null, Vector3? origin = null, string assetName = null) {
  var res = new Result();
  Result Fail(string why) { res.message = "MapWater: 水は作りません — " + why; Debug.Log(res.message); return res; }
  try {
   if (string.IsNullOrEmpty(exportDir) || !Directory.Exists(exportDir)) return Fail("書き出しのフォルダがありません: " + exportDir);
   string metaPath = Path.Combine(exportDir, "meta.json");
   if (!File.Exists(metaPath)) return Fail("meta.json がありません");
   MetaDto meta;
   try { meta = JsonUtility.FromJson<MetaDto>(File.ReadAllText(metaPath)); } catch (Exception e) { return Fail("meta.json を読めません: " + e.Message); }
   if (meta == null || meta.terrain == null || meta.terrain.size == null || meta.terrain.size.Length < 3 || meta.terrain.heightmapResolution < 3) return Fail("meta.json に terrain がありません");
   // JsonUtility は "sea": null でも空の物を作るので、version で見分ける
   if (meta.sea != null && meta.sea.version >= 1 && !string.IsNullOrEmpty(meta.sea.field)) {
    var seaRes = BuildSea(exportDir, meta, res, parent, origin, assetName);
    if (!seaRes.built || meta.waterSim == null || meta.waterSim.version < 1 || !meta.waterSim.available) return seaRes;
    var rivers = BuildWater(exportDir, meta, new Result(), seaRes.root.transform, null, assetName, "Rivers", Path.Combine(exportDir, meta.sea.field));
    if (!rivers.built) { seaRes.message += "（川・池：" + rivers.message + "）"; return seaRes; }
    seaRes.controller = rivers.controller; seaRes.gameObjects += rivers.gameObjects; seaRes.materials += rivers.materials; seaRes.textures += rivers.textures; seaRes.meshes += rivers.meshes;
    seaRes.message += " ／ " + rivers.message; return seaRes;
   }
   return BuildWater(exportDir, meta, res, parent, origin, assetName, null, null);
  } catch (Exception e) {
   res.message = "MapWater: 例外 — " + e; Debug.LogError(res.message); return res;
  }
 }

 // 池・川の水面（流れの画像 waterSim から）。rootName を渡すと、その名前の物を parent の下に作る（海の下の川）。
 // seaFieldPath を渡すと、その画像の A（海の重み）で水面を消す。
 static Result BuildWater(string exportDir, MetaDto meta, Result res, Transform parent, Vector3? origin, string assetName, string rootName, string seaFieldPath) {
  Result Fail(string why) { res.message = "MapWater: 水は作りません — " + why; Debug.Log(res.message); return res; }
  try {
   if (meta.waterSim == null || meta.waterSim.version < 1) return Fail("この書き出しには水の流れのデータ（waterSim）がありません（古い書き出し。エディターで書き出し直してください）");
   if (!meta.waterSim.available) return Fail("waterSim.available=false（" + (string.IsNullOrEmpty(meta.waterSim.reason) ? "理由なし" : meta.waterSim.reason) + "）");
   if (meta.water == null || meta.water.Length == 0) return Fail("meta.water がありません");
   int TN = meta.terrain.heightmapResolution;
   string rawName = string.IsNullOrEmpty(meta.terrain.heightmap) ? "heightmap_r16.raw" : meta.terrain.heightmap;
   string rawPath = Path.Combine(exportDir, rawName), flowPath = Path.Combine(exportDir, meta.waterSim.flowMap ?? ""), maskPath = Path.Combine(exportDir, meta.waterSim.maskMap ?? "");
   foreach (var p in new[] { rawPath, flowPath, maskPath }) if (!File.Exists(p)) return Fail("ファイルがありません: " + Path.GetFileName(p));
   var raw = File.ReadAllBytes(rawPath);
   if (raw.Length != TN * TN * 2) return Fail($"{rawName} の大きさが合いません（{raw.Length} バイト、期待 {TN * TN * 2}）");
   var detail = AssetDatabase.LoadAssetAtPath<Texture2D>(RuntimeDir + "/Textures/MapWaterDetail256.png");
   var compute = AssetDatabase.LoadAssetAtPath<ComputeShader>(RuntimeDir + "/Compute/MapRipple.compute");
   var shW = Shader.Find("MapWater/Water"); var shF = Shader.Find("MapWater/Fall"); var shS = Shader.Find("MapWater/Splash"); var shT = Shader.Find("MapWater/Stream");
   if (detail == null || shW == null || shF == null || shS == null || shT == null) return Fail("MapWater の shader または共有画像が見つかりません（Assets/MapWater/Runtime）");

   float level = meta.water[0].level, size = meta.terrain.size[0], rangeY = meta.terrain.heightRange;
   string name = assetName ?? new DirectoryInfo(exportDir).Name; string dir = GeneratedDir + "/" + name;
   Directory.CreateDirectory(dir); AssetDatabase.Refresh();

   // ---- 画像：流れ・泡の帯は書き出しの PNG をそのまま取り込む（sRGB オフ・非圧縮・ミップなし・クランプ）
   Texture2D Import(string src, string fileName) {
    string dst = dir + "/" + fileName; File.Copy(src, dst, true); AssetDatabase.ImportAsset(dst, ImportAssetOptions.ForceSynchronousImport);
    var imp = (TextureImporter)AssetImporter.GetAtPath(dst);
    imp.sRGBTexture = false; imp.mipmapEnabled = false; imp.wrapMode = TextureWrapMode.Clamp; imp.filterMode = FilterMode.Bilinear;
    imp.textureCompression = TextureImporterCompression.Uncompressed; imp.isReadable = false; imp.alphaSource = TextureImporterAlphaSource.FromInput; imp.alphaIsTransparency = false;
    imp.npotScale = TextureImporterNPOTScale.None; imp.SaveAndReimport();
    return AssetDatabase.LoadAssetAtPath<Texture2D>(dst);
   }
   var flowTex = Import(flowPath, "water_flow.png"); var maskTex = Import(maskPath, "water_mask.png");
   if (flowTex == null || maskTex == null) return Fail("流れの画像を取り込めませんでした");
   Texture2D seaTex = null;
   if (seaFieldPath != null) { seaTex = Import(seaFieldPath, "sea_field.png"); if (seaTex == null) return Fail("sea_field.png を取り込めませんでした"); }

   // ---- 符号つき水深（水位 − 地形。陸は負）。heightmap_r16.raw は行 r = z、列 = x、行0 が z=0（テクスチャの v=0）
   var half = new ushort[TN * TN]; float maxD = 0; int i0 = TN, i1 = -1, j0 = TN, j1 = -1;
   for (int k = 0; k < TN * TN; k++) {
    float h = (raw[k * 2] | (raw[k * 2 + 1] << 8)) / 65535f * rangeY, d = Mathf.Clamp(level - h, -2f, 12f);
    half[k] = Mathf.FloatToHalf(d);
    if (d > 0) { int i = k % TN, j = k / TN; i0 = Mathf.Min(i0, i); i1 = Mathf.Max(i1, i); j0 = Mathf.Min(j0, j); j1 = Mathf.Max(j1, j); if (d > maxD) maxD = d; }
   }
   if (i1 < 0) return Fail("水位より低い地形がありません");
   var depthTex = new Texture2D(TN, TN, TextureFormat.RHalf, false, true) { name = "WaterDepth", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
   depthTex.SetPixelData(half, 0); depthTex.Apply(false, false);
   string depthPath = dir + "/WaterDepth.asset"; AssetDatabase.DeleteAsset(depthPath); AssetDatabase.CreateAsset(depthTex, depthPath);
   depthTex = AssetDatabase.LoadAssetAtPath<Texture2D>(depthPath);
   res.textures = seaTex != null ? 4 : 3;

   // ---- 材質
   Material Mat(Shader s, string n) { string pth = dir + "/" + n + ".mat"; AssetDatabase.DeleteAsset(pth); var m = new Material(s) { name = n }; AssetDatabase.CreateAsset(m, pth); return AssetDatabase.LoadAssetAtPath<Material>(pth); }
   var water = Mat(shW, "Water"); var fall = Mat(shF, "Fall"); var splash = Mat(shS, "Splash"); var stream = Mat(shT, "Stream");
   water.SetTexture("_DetailTex", detail); water.SetTexture("_FlowTex", flowTex); water.SetTexture("_MaskTex", maskTex); water.SetTexture("_DepthTex", depthTex);
   water.SetVector("_MapRect", new Vector4(0, 0, 1f / size, 1f / size));
   if (seaTex != null) water.SetTexture("_SeaTex", seaTex);
   if (meta.waterSim.maxSpeed > 0) water.SetFloat("_FlowMax", meta.waterSim.maxSpeed);
   if (meta.waterSim.bankRange > 0) water.SetFloat("_BankRange", meta.waterSim.bankRange);
   if (meta.waterSim.trailMaxCover > 0) water.SetFloat("_TrailMaxCover", meta.waterSim.trailMaxCover);
   splash.SetTexture("_DetailTex", detail);
   EditorUtility.SetDirty(water); EditorUtility.SetDirty(fall); EditorUtility.SetDirty(splash); EditorUtility.SetDirty(stream);
   res.materials = 4;

   // ---- 物
   var root = new GameObject(rootName ?? "MapWater_" + name); if (parent != null) root.transform.SetParent(parent, false);
   root.transform.position = origin ?? (parent != null ? parent.position : Vector3.zero); root.transform.rotation = Quaternion.identity; root.transform.localScale = Vector3.one;
   res.gameObjects++;
   float cell = size / (TN - 1); const int margin = 2;
   float x0 = Mathf.Max(0, (i0 - margin) * cell), x1 = Mathf.Min(size, (i1 + margin) * cell), z0 = Mathf.Max(0, (j0 - margin) * cell), z1 = Mathf.Min(size, (j1 + margin) * cell);
   var surf = new GameObject("Surface"); surf.transform.SetParent(root.transform, false); res.gameObjects++;
   var sm = new Mesh { name = "WaterSurface" };
   sm.vertices = new[] { new Vector3(x0, level, z0), new Vector3(x1, level, z0), new Vector3(x1, level, z1), new Vector3(x0, level, z1) };
   sm.triangles = new[] { 0, 2, 1, 0, 3, 2 }; sm.RecalculateNormals(); sm.bounds = new Bounds(new Vector3((x0 + x1) / 2, level, (z0 + z1) / 2), new Vector3(x1 - x0, 2f, z1 - z0));
   string smPath = dir + "/WaterSurface.mesh.asset"; AssetDatabase.DeleteAsset(smPath); AssetDatabase.CreateAsset(sm, smPath); sm = AssetDatabase.LoadAssetAtPath<Mesh>(smPath);
   surf.AddComponent<MeshFilter>().sharedMesh = sm; var sr = surf.AddComponent<MeshRenderer>(); sr.sharedMaterial = water;
   sr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; sr.receiveShadows = false; res.meshes++;

   var ctl = root.AddComponent<MapWaterController>(); ctl.surface = sr; ctl.ripple = compute; ctl.depthTexture = depthTex; ctl.mapSize = new Vector2(size, meta.terrain.size[2]);
   var fallRs = new List<Renderer>(); var splashRs = new List<Renderer>(); var streamRs = new List<Renderer>();
   float Hgt(float x, float z) {   // heightmap の双一次補間（地図の原点からの x,z）
    float fx = Mathf.Clamp(x / size * (TN - 1), 0, TN - 1.001f), fz = Mathf.Clamp(z / meta.terrain.size[2] * (TN - 1), 0, TN - 1.001f); int ix = (int)fx, iz = (int)fz; float u = fx - ix, v = fz - iz;
    float R(int a, int b) => (raw[(b * TN + a) * 2] | (raw[(b * TN + a) * 2 + 1] << 8)) / 65535f * rangeY;
    return Mathf.Lerp(Mathf.Lerp(R(ix, iz), R(ix + 1, iz), u), Mathf.Lerp(R(ix, iz + 1), R(ix + 1, iz + 1), u), v);
   }
   var plunge = new Dictionary<string, Vector3>();
   if (meta.waterSim.falls != null) foreach (var f in meta.waterSim.falls) if (!f.dry && f.plunge != null && f.plunge.Length >= 3) plunge[f.id] = new Vector3(f.plunge[0], level, f.plunge[2]);
   if (meta.waterfalls != null) foreach (var wf in meta.waterfalls) {
    if (wf == null || wf.position == null || wf.position.Length < 3 || wf.upstream == null || wf.upstream.Length < 2) continue;
    if (!plunge.TryGetValue(wf.id, out var pp)) continue;   // 着水点が乾いた所（解析で除外された滝）は作らない
    float height = Mathf.Max(wf.top - level, 1f);
    var up = new Vector2(wf.upstream[0], wf.upstream[1]); if (up.sqrMagnitude < 1e-6f) up = Vector2.up; up.Normalize();
    var info = new MapWaterFallInfo { id = wf.id, plunge = pp, upstream = up, width = Mathf.Max(wf.width, 1f), height = height };
    ctl.falls.Add(info);
    var go = new GameObject("Fall_" + wf.id); go.transform.SetParent(root.transform, false); res.gameObjects++;
    go.transform.localPosition = pp; go.transform.localRotation = Quaternion.Euler(0, Mathf.Atan2(up.x, up.y) * Mathf.Rad2Deg, 0);
    var fm = MapWaterMeshes.FallSheet(info, wf.id); string fmPath = dir + "/Fall_" + wf.id + ".mesh.asset"; AssetDatabase.DeleteAsset(fmPath); AssetDatabase.CreateAsset(fm, fmPath); fm = AssetDatabase.LoadAssetAtPath<Mesh>(fmPath);
    go.AddComponent<MeshFilter>().sharedMesh = fm; var fr = go.AddComponent<MeshRenderer>(); fr.sharedMaterial = fall; fr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; fr.receiveShadows = false; fallRs.Add(fr); res.meshes++;
    var sp = new GameObject("Splash_" + wf.id); sp.transform.SetParent(go.transform, false); res.gameObjects++;
    if (wf.source != null && wf.source.Length >= 2) {
     var sm2 = MapWaterMeshes.Stream(info, wf.source, wf.position, Hgt, wf.top);
     if (sm2 != null) {
      string stPath = dir + "/Stream_" + wf.id + ".mesh.asset"; AssetDatabase.DeleteAsset(stPath); AssetDatabase.CreateAsset(sm2, stPath); sm2 = AssetDatabase.LoadAssetAtPath<Mesh>(stPath);
      var sg = new GameObject("Stream_" + wf.id); sg.transform.SetParent(root.transform, false); res.gameObjects++;
      sg.AddComponent<MeshFilter>().sharedMesh = sm2; var str = sg.AddComponent<MeshRenderer>(); str.sharedMaterial = stream; str.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; str.receiveShadows = false; streamRs.Add(str); res.meshes++;
     }
    }
    var spm = MapWaterMeshes.Splash(info, wf.id); string spPath = dir + "/Splash_" + wf.id + ".mesh.asset"; AssetDatabase.DeleteAsset(spPath); AssetDatabase.CreateAsset(spm, spPath); spm = AssetDatabase.LoadAssetAtPath<Mesh>(spPath);
    sp.AddComponent<MeshFilter>().sharedMesh = spm; var spr = sp.AddComponent<MeshRenderer>(); spr.sharedMaterial = splash; spr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; spr.receiveShadows = false; splashRs.Add(spr); res.meshes++;
   }
   ctl.fallRenderers = fallRs.ToArray(); ctl.splashRenderers = splashRs.ToArray(); ctl.streamRenderers = streamRs.ToArray();
   AssetDatabase.SaveAssets();
   res.built = true; res.root = root; res.controller = ctl;
   res.message = $"MapWater: 作りました — {root.name}（GameObject {res.gameObjects}、材質 {res.materials}、画像 {res.textures}、メッシュ {res.meshes}、滝 {ctl.falls.Count}、水深 最大 {maxD:F2}m、水面の範囲 x {x0:F1}〜{x1:F1} z {z0:F1}〜{z1:F1}）";
   Debug.Log(res.message);
   return res;
  } catch (Exception e) {
   res.message = "MapWater: 例外 — " + e; Debug.LogError(res.message); return res;
  }
 }

 // ---- 海：sea_field.png（水際までの距離・岸への向き・海の重み）と heightmap から、約 0.5m 間隔の格子のメッシュを作り、MapWater/Sea を付ける。
 // 頂点に入れるもの（MapSea.shader の説明と同じ）：uv0 = (s, 海の重み)、uv1 = 岸への向き（エディター座標）、uv2.x = 静水の水深。
 static Result BuildSea(string exportDir, MetaDto meta, Result res, Transform parent, Vector3? origin, string assetName) {
  Result Fail(string why) { res.message = "MapWater: 海は作りません — " + why; Debug.Log(res.message); return res; }
  var sea = meta.sea; int TN = meta.terrain.heightmapResolution;
  if (meta.water == null || meta.water.Length == 0) return Fail("meta.water がありません");
  if (sea.resolution != TN) return Fail($"sea_field.png の解像度 {sea.resolution} が heightmap {TN} と違います");
  string rawName = string.IsNullOrEmpty(meta.terrain.heightmap) ? "heightmap_r16.raw" : meta.terrain.heightmap;
  string rawPath = Path.Combine(exportDir, rawName), fieldPath = Path.Combine(exportDir, sea.field);
  foreach (var p in new[] { rawPath, fieldPath }) if (!File.Exists(p)) return Fail("ファイルがありません: " + Path.GetFileName(p));
  var raw = File.ReadAllBytes(rawPath);
  if (raw.Length != TN * TN * 2) return Fail($"{rawName} の大きさが合いません（{raw.Length} バイト、期待 {TN * TN * 2}）");
  var fieldTex = new Texture2D(2, 2, TextureFormat.RGBA32, false, true);
  if (!fieldTex.LoadImage(File.ReadAllBytes(fieldPath)) || fieldTex.width != TN || fieldTex.height != TN) { UnityEngine.Object.DestroyImmediate(fieldTex); return Fail("sea_field.png を読めないか、大きさが違います"); }
  var px = fieldTex.GetPixels32(); UnityEngine.Object.DestroyImmediate(fieldTex);   // GetPixels32 の行0 = 画像の一番下 = Unity z 0（heightmap の行と同じ並び）
  var shader = Shader.Find("MapWater/Sea");
  if (shader == null) return Fail("shader MapWater/Sea が見つかりません（Assets/MapWater/Runtime/Shaders）");

  float level = meta.water[0].level, size = meta.terrain.size[0], sizeZ = meta.terrain.size[2], rangeY = meta.terrain.heightRange, cell = size / (TN - 1);
  int stride = Mathf.Max(1, Mathf.RoundToInt(0.5f / cell)), G = (TN - 1) / stride + 1;   // エディターと同じ約 0.5m 間隔
  float S(int k) => ((px[k].r * 256 + px[k].g) / 65535f) * 80f - 20f;   // meta.sea.encoding.field
  float W(int k) => px[k].a / 255f;
  Vector2 Dir(int k) { float a = px[k].b / 256f * Mathf.PI * 2f; return px[k].b == 0 && px[k].a == 0 ? Vector2.zero : new Vector2(Mathf.Cos(a), -Mathf.Sin(a)); }   // Unity の角度 → エディター座標の向き（z を反転）
  float Depth(int k) => level - (raw[k * 2] | (raw[k * 2 + 1] << 8)) / 65535f * rangeY;

  // 使う頂点：海の重みがある所と、その隣（打ち上がりは静水の水際から数 m）
  var vid = new int[G * G]; for (int k = 0; k < vid.Length; k++) vid[k] = -1;
  var pos = new List<Vector3>(); var uv0 = new List<Vector2>(); var uv1 = new List<Vector2>(); var uv2 = new List<Vector2>(); var tri = new List<int>();
  int Vert(int gi, int gj) {
   int g = gj * G + gi; if (vid[g] >= 0) return vid[g];
   int i = Mathf.Min(gi * stride, TN - 1), j = Mathf.Min(gj * stride, TN - 1), k = j * TN + i;
   vid[g] = pos.Count; pos.Add(new Vector3(i * cell, level, j * cell * sizeZ / size));
   uv0.Add(new Vector2(S(k), W(k))); uv1.Add(Dir(k)); uv2.Add(new Vector2(Depth(k), 0)); return vid[g];
  }
  bool Used(int gi, int gj) { int i = Mathf.Min(gi * stride, TN - 1), j = Mathf.Min(gj * stride, TN - 1), k = j * TN + i; return W(k) > 0.001f && Depth(k) > -3f; }
  for (int gj = 0; gj < G - 1; gj++) for (int gi = 0; gi < G - 1; gi++) {
   if (!Used(gi, gj) && !Used(gi + 1, gj) && !Used(gi, gj + 1) && !Used(gi + 1, gj + 1)) continue;
   int a = Vert(gi, gj), b = Vert(gi + 1, gj), c = Vert(gi, gj + 1), d = Vert(gi + 1, gj + 1);
   tri.Add(a); tri.Add(c); tri.Add(b); tri.Add(b); tri.Add(c); tri.Add(d);   // Unity は時計回りが表（両面描画なので向きは見た目に影響しない）
  }
  if (tri.Count == 0) return Fail("sea_field.png に海の所がありません");

  string name = assetName ?? new DirectoryInfo(exportDir).Name; string dir = GeneratedDir + "/" + name;
  Directory.CreateDirectory(dir); AssetDatabase.Refresh();
  var mesh = new Mesh { name = "Sea", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
  mesh.SetVertices(pos); mesh.SetUVs(0, uv0); mesh.SetUVs(1, uv1); mesh.SetUVs(2, uv2); mesh.SetTriangles(tri, 0);
  mesh.RecalculateNormals(); mesh.RecalculateBounds(); var bb = mesh.bounds; bb.Expand(new Vector3(0, 4f, 0)); mesh.bounds = bb;   // 波の上下の分
  string meshPath = dir + "/Sea.mesh.asset"; AssetDatabase.DeleteAsset(meshPath); AssetDatabase.CreateAsset(mesh, meshPath); mesh = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
  string matPath = dir + "/Sea.mat"; AssetDatabase.DeleteAsset(matPath); var mat = new Material(shader) { name = "Sea" }; AssetDatabase.CreateAsset(mat, matPath); mat = AssetDatabase.LoadAssetAtPath<Material>(matPath);
  Vector4 V4(float[] a, Vector4 def) => a != null && a.Length >= 3 ? new Vector4(a[0], a[1], a[2], 0) : def;
  if (sea.waves != null && sea.waves.height > 0) mat.SetFloat("_WaveHeight", sea.waves.height);
  if (sea.colors != null) { mat.SetVector("_ShallowColor", V4(sea.colors.shallow, mat.GetVector("_ShallowColor"))); mat.SetVector("_DeepColor", V4(sea.colors.deep, mat.GetVector("_DeepColor"))); }   // Vector：色の変換をしない（エディターと同じ値）
  mat.SetVector("_SunDirection", V4(sea.sunDirection, mat.GetVector("_SunDirection")));
  mat.SetFloat("_MapSize", size);
  EditorUtility.SetDirty(mat);

  var root = new GameObject("MapWater_" + name); if (parent != null) root.transform.SetParent(parent, false);
  root.transform.position = origin ?? (parent != null ? parent.position : Vector3.zero); root.transform.rotation = Quaternion.identity; root.transform.localScale = Vector3.one;
  var go = new GameObject("Sea"); go.transform.SetParent(root.transform, false);
  go.AddComponent<MeshFilter>().sharedMesh = mesh; var r = go.AddComponent<MeshRenderer>(); r.sharedMaterial = mat;
  r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false;
  AssetDatabase.SaveAssets();
  res.built = true; res.root = root; res.gameObjects = 2; res.materials = 1; res.meshes = 1; res.textures = 0;
  res.message = $"MapWater: 海を作りました — {root.name}（頂点 {pos.Count}、三角形 {tri.Count / 3}、格子 {stride * cell:F2}m、波の高さ {(sea.waves != null ? sea.waves.height : 0):F2}m）";
  Debug.Log(res.message);
  return res;
 }

}
}
