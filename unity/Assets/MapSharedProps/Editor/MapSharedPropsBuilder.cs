using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace MapSharedProps.EditorTools {
// Visual-only pilot importer. Does not replace a game's prefab resolver, physics or water importer.
public static class MapSharedPropsBuilder {
 [Serializable] public class TextureDto { public string id, png, colorSpace, wrap, filter; public int width, height, anisotropy; public bool mipmaps; }
 [Serializable] public class MaterialDto { public string texture, lighting; public float[] baseColor; public float alphaCutoff; public bool doubleSided; }
 [Serializable] public class GroundOffsetDto { public int firstVertex, count; public float deltaY; }
 [Serializable] public class AssetDto { public GroundOffsetDto[] groundOffsets; public string id, assetKey; public int version; public float[] positions, normals, colors, uv, pivot; public int[] triangles; public MaterialDto material; }
 [Serializable] public class LibraryDto { public int schemaVersion; public string libraryVersion, units, axes, winding, uvOrigin; public TextureDto[] textures; public AssetDto[] assets; }
 [Serializable] public class ModelDto { public string file, id; public int version; }
 [Serializable] public class TypeDto { public string assetKey; public float yawOffsetDeg; public ModelDto sharedModel; }
 [Serializable] public class TypesDto { public TypeDto rock, fern, pine, log, stump, rootfan; }
 [Serializable] public class CatalogDto { public TypesDto types; }
 [Serializable] public class PineWindDto { public int version;public string id;public float minY,maxY,maxDisplacementMetres;public float[] waves,phase; }
 [Serializable] class WindMeta {public TerrainMeta terrain;public WeatherMeta weather;}
 [Serializable] class TerrainMeta {public float[] size;}
 [Serializable] class WeatherMeta {public float wind,amount;public float[] windDir;}
 public sealed class Result { public GameObject root; public string assetDirectory; public int placed, skipped; public readonly Dictionary<string, GameObject> prefabs = new Dictionary<string, GameObject>(); }
 sealed class Placement { public string instanceId, type; public Vector3 position, scale; public float yaw; }

 static void Require(bool ok, string why) { if (!ok) throw new InvalidDataException("Shared props: " + why); }
 static bool Finite(float x) { return !float.IsNaN(x) && !float.IsInfinity(x); }
 static void Floats(float[] values, int expected, string name) {
  Require(values != null && values.Length == expected, name + " length");
  foreach (var x in values) Require(Finite(x), name + " non-finite value");
 }
 public static LibraryDto ReadLibrary(string file) {
  var d = JsonUtility.FromJson<LibraryDto>(File.ReadAllText(file));
  Require(d != null && d.schemaVersion == 1 && (d.libraryVersion == "shared-rock-fern/4" || d.libraryVersion == "shared-nature/1") && d.units == "metres", "unsupported library/version/units");
  Require(d.assets != null && d.assets.Length == (d.libraryVersion == "shared-nature/1" ? 6 : 2) && d.textures != null && d.textures.Length == (d.libraryVersion == "shared-nature/1" ? 3 : 2), "unexpected asset/texture count");
  var ids = new HashSet<string>(); var texIds = new HashSet<string>();
  foreach (var t in d.textures) {
   Require(t != null && texIds.Add(t.id) && (t.id == "rock-basecolor-v1" || t.id == "fern-basecolor-v1" || t.id == "forest-atlas-v1"), "texture ID");
   Require(t.width > 0 && t.width <= 1024 && t.height > 0 && t.height <= 1024 && t.colorSpace == "sRGB" && ((t.id == "forest-atlas-v1" && t.filter == "trilinear" && t.mipmaps && t.anisotropy == 2) || (t.id != "forest-atlas-v1" && t.filter == "bilinear" && !t.mipmaps)), "texture parameters");
   Require(t.wrap == "repeat" || t.wrap == "clamp", "texture wrap");
   var bytes = Convert.FromBase64String(t.png); Require(bytes.Length >= 24 && bytes[0] == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71, "PNG signature");
  }
  foreach (var a in d.assets) {
   Require(a != null && ids.Add(a.id) && (a.id == "rock" || a.id == "fern" || a.id == "pine" || a.id == "log" || a.id == "stump" || a.id == "rootfan") && a.assetKey == "tdj/" + a.id && a.version == (a.id == "rock" ? 4 : a.id == "fern" ? 3 : 1), "asset ID/version");
   Require(a.positions != null && a.positions.Length > 0 && a.positions.Length % 9 == 0 && a.positions.Length <= 180000, "mesh size");
   int n = a.positions.Length / 3;
   Floats(a.positions, n * 3, "positions"); Floats(a.normals, n * 3, "normals"); Floats(a.colors, n * 3, "colors"); Floats(a.uv, n * 2, "uv"); Floats(a.pivot, 3, "pivot");
   Require(a.pivot[0] == 0 && a.pivot[1] == 0 && a.pivot[2] == 0, "pivot must be ground origin");
   Require(a.triangles != null && a.triangles.Length > 0 && a.triangles.Length % 3 == 0, "triangle count");
   foreach (int ix in a.triangles) Require(ix >= 0 && ix < n, "triangle index");
   var m = a.material; Require(m != null && texIds.Contains(m.texture), "material texture"); Floats(m.baseColor, 4, "baseColor");
   Require(m.lighting == "lambert" && m.alphaCutoff == ((a.id == "fern" || a.id == "pine") ? .42f : 0) && m.doubleSided == (a.id == "fern" || a.id == "pine"), "material parameters");
  }
  return d;
 }
 static float Number(string x) { var v = float.Parse(x, CultureInfo.InvariantCulture); Require(Finite(v), "non-finite placement"); return v; }
 static TypeDto Type(CatalogDto c, string id) { return id == "rock" ? c.types.rock : id == "fern" ? c.types.fern : id == "pine" ? c.types.pine : id == "log" ? c.types.log : id == "stump" ? c.types.stump : id == "rootfan" ? c.types.rootfan : null; }
 static List<Placement> ReadPlacements(string file, CatalogDto cat, LibraryDto lib, out int skipped) {
  var lines = File.ReadAllLines(file); Require(lines.Length > 0 && lines[0].TrimEnd('\r') == "instanceId,type,assetKey,x,y,z,rotY_deg,scale,scaleY,auto,cliffStyle", "CSV header");
  var rows = new List<Placement>(); skipped = 0;
  for (int i = 1; i < lines.Length; i++) {
   if (string.IsNullOrWhiteSpace(lines[i])) continue;
   var s = lines[i].Split(','); Require(s.Length == 11, "CSV row " + (i + 1));
   var c = Type(cat, s[1]); var a = Array.Find(lib.assets, x => x.id == s[1]);
   // Custom assetKey mappings and non-pilot types remain the game's prefab resolver's responsibility.
   if (a == null || c == null || c.sharedModel == null || s[2] != a.assetKey || c.assetKey != a.assetKey) { skipped++; continue; }
   Require(c.sharedModel.id == a.id && c.sharedModel.version == a.version && c.sharedModel.file == "shared_props.json", "catalog model/version mismatch");
   Require(Finite(c.yawOffsetDeg), "catalog yaw offset");
   var p = new Placement { instanceId = s[0], type = s[1], position = new Vector3(Number(s[3]), Number(s[4]), Number(s[5])), yaw = Number(s[6]) + c.yawOffsetDeg, scale = new Vector3(Number(s[7]), Number(s[8]), Number(s[7])) };
   Require(p.scale.x > 0 && p.scale.y > 0, "placement scale must be positive"); rows.Add(p);
  }
  return rows;
 }
 public static Result Build(string exportDirectory, Transform parent = null) {
  var lib = ReadLibrary(Path.Combine(exportDirectory, "shared_props.json"));
  var cat = JsonUtility.FromJson<CatalogDto>(File.ReadAllText(Path.Combine(exportDirectory, "asset_catalog.json")));
  Require(cat != null && cat.types != null, "missing asset catalog types");
  string windFile=Path.Combine(exportDirectory,"pine_wind.json");PineWindDto wind=null;
  if(File.Exists(windFile)){wind=JsonUtility.FromJson<PineWindDto>(File.ReadAllText(windFile));Require(wind!=null&&wind.version==1&&wind.id=="pine"&&wind.minY==2.15f&&wind.maxY==6.408f&&wind.maxDisplacementMetres==.12f&&wind.waves!=null&&wind.waves.Length==4&&wind.phase!=null&&wind.phase.Length==2,"pine wind contract");}
  int skipped; var rows = ReadPlacements(Path.Combine(exportDirectory, "props.csv"), cat, lib, out skipped);
  var shader = Shader.Find("MapSharedProps/Lit"); Require(shader != null && shader.isSupported, "MapSharedProps/Lit shader unavailable");
  var r = new Result { skipped = skipped };
  const string rootDir = "Assets/MapSharedPropsGenerated";
  if (!AssetDatabase.IsValidFolder(rootDir)) AssetDatabase.CreateFolder("Assets", "MapSharedPropsGenerated");
  r.assetDirectory = AssetDatabase.GenerateUniqueAssetPath(rootDir + "/Pilot");
  AssetDatabase.CreateFolder(rootDir, Path.GetFileName(r.assetDirectory));
  try {
   var textures = new Dictionary<string, Texture2D>();
   foreach (var t in lib.textures) {
    string dst = r.assetDirectory + "/" + t.id + ".png";
    File.WriteAllBytes(dst, Convert.FromBase64String(t.png)); AssetDatabase.ImportAsset(dst, ImportAssetOptions.ForceSynchronousImport);
    var imp = (TextureImporter)AssetImporter.GetAtPath(dst);
    imp.sRGBTexture = true; imp.alphaSource = TextureImporterAlphaSource.FromInput; imp.alphaIsTransparency = false;
    imp.textureCompression = TextureImporterCompression.Uncompressed; imp.mipmapEnabled = t.mipmaps; imp.npotScale = TextureImporterNPOTScale.None;
    imp.wrapMode = t.wrap == "repeat" ? TextureWrapMode.Repeat : TextureWrapMode.Clamp; imp.filterMode = t.filter == "trilinear" ? FilterMode.Trilinear : FilterMode.Bilinear; imp.anisoLevel = Math.Max(1,t.anisotropy); imp.SaveAndReimport();
    var tx = AssetDatabase.LoadAssetAtPath<Texture2D>(dst); Require(tx != null && tx.width == t.width && tx.height == t.height, "PNG dimensions"); textures.Add(t.id, tx);
   }
   foreach (var a in lib.assets) {
    int n = a.positions.Length / 3; var vertices = new Vector3[n]; var normals = new Vector3[n]; var colors = new Color[n]; var uv = new Vector2[n];
    for (int i = 0; i < n; i++) {
     int k = i * 3; vertices[i] = new Vector3(a.positions[k], a.positions[k+1], a.positions[k+2]); normals[i] = new Vector3(a.normals[k], a.normals[k+1], a.normals[k+2]);
     colors[i] = new Color(a.colors[k], a.colors[k+1], a.colors[k+2], 1); uv[i] = new Vector2(a.uv[i*2], a.uv[i*2+1]);
    }
    var mesh = new Mesh { name = a.assetKey + "/v" + a.version, indexFormat = IndexFormat.UInt16, vertices = vertices, normals = normals, colors = colors, uv = uv, triangles = a.triangles };
    mesh.RecalculateBounds(); AssetDatabase.CreateAsset(mesh, r.assetDirectory + "/" + a.id + ".asset");
    var d = a.material; var mat = new Material(shader) { name = a.id + "/v" + a.version };
    mat.SetTexture("_BaseMap", textures[d.texture]); mat.SetColor("_BaseColor", new Color(d.baseColor[0],d.baseColor[1],d.baseColor[2],d.baseColor[3]));
    if(a.id=="pine"&&wind!=null){mat.SetVector("_PineBand",new Vector4(wind.minY,wind.maxY,wind.maxDisplacementMetres,1));mat.SetVector("_PineWaves",new Vector4(wind.waves[0],wind.waves[1],wind.waves[2],wind.waves[3]));mat.SetVector("_PinePhase",new Vector4(wind.phase[0],wind.phase[1],0,0));}
    mat.SetFloat("_Cutoff", d.alphaCutoff); mat.SetFloat("_Cull", d.doubleSided ? 0 : 2);
    mat.renderQueue = d.alphaCutoff > 0 ? 2450 : 2000;
    AssetDatabase.CreateAsset(mat, r.assetDirectory + "/" + a.id + ".mat");
    var go = new GameObject(a.id); go.AddComponent<MeshFilter>().sharedMesh = mesh; go.AddComponent<MeshRenderer>().sharedMaterial = mat;
    r.prefabs.Add(a.id, PrefabUtility.SaveAsPrefabAsset(go, r.assetDirectory + "/" + a.id + ".prefab")); UnityEngine.Object.DestroyImmediate(go);
   }
   r.root = new GameObject("Shared prop pilot"); if (parent != null) r.root.transform.SetParent(parent, false);
   foreach (var p in rows) {
    var go = (GameObject)PrefabUtility.InstantiatePrefab(r.prefabs[p.type], r.root.transform); go.name = p.instanceId;
    go.transform.localPosition = p.position; go.transform.localRotation = Quaternion.Euler(0, p.yaw, 0); go.transform.localScale = p.scale; r.placed++;
   }
   if(wind!=null){var driver=r.root.AddComponent<MapSharedProps.SharedPineWind>();ConfigureWind(driver,Path.Combine(exportDirectory,"meta.json"));driver.Apply(0);}
   AssetDatabase.SaveAssets(); return r;
  } catch {
   if (r.root != null) UnityEngine.Object.DestroyImmediate(r.root);
   AssetDatabase.DeleteAsset(r.assetDirectory); throw;
  }
 }
 public static void ConfigureWind(MapSharedProps.SharedPineWind driver,string metaFile){
  if(!File.Exists(metaFile))return;var meta=JsonUtility.FromJson<WindMeta>(File.ReadAllText(metaFile));
  if(meta.terrain?.size!=null&&meta.terrain.size.Length==3)driver.editorZero=new Vector2(meta.terrain.size[0]*.5f,meta.terrain.size[2]*.5f);
  if(meta.weather!=null){driver.strength=meta.weather.wind*Mathf.Clamp01(meta.weather.amount);driver.windEnabled=driver.strength>0;if(meta.weather.windDir!=null&&meta.weather.windDir.Length==2)driver.direction=new Vector2(meta.weather.windDir[0],meta.weather.windDir[1]);}
 }
 [MenuItem("Tools/Map Editor/Import shared nature (pilot)")]
 static void Import() {
  string folder = EditorUtility.OpenFolderPanel("書き出し済みマップを選択", "", ""); if (string.IsNullOrEmpty(folder)) return;
  try { var r = Build(folder); Undo.RegisterCreatedObjectUndo(r.root, "Import shared props"); Selection.activeGameObject = r.root; Debug.Log($"共有小物：{r.placed}個を配置、対象外 {r.skipped}個。資産：{r.assetDirectory}"); }
  catch (Exception e) { Debug.LogException(e); }
 }
}
}
