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
 [Serializable] public class WindDto {public float minY,maxY,maxDisplacementMetres,uvMin,phaseOffset,maxCombinedDisplacementMetres;}
 [Serializable] public class ContactDto {public int version;public float radius,minY,maxY,maxDisplacementMetres;}
 [Serializable] public class RootGroundingDto {public int version;public float maxSlope,fadeHeightMetres;}
 [Serializable] public class RootSurfaceDto {public int version;public float bandMetres,mossHeightMetres;}
 [Serializable] class RootInstanceDto {public string instanceId;public float[] slope,terrain;}
 [Serializable] class RootPaintDto {public string file;public int resolution;public float[] sizeMetres;}
 [Serializable] class RootPlanesDto {public RootPaintDto paint;public int version;public string axes;public RootInstanceDto[] instances;}
 [Serializable] public class AssetDto { public RootSurfaceDto rootSurface;public float[] rootWood;public ContactDto contact;public RootGroundingDto rootGrounding;public float[] rootWeights;public float[] motionWeights,glow;public WindDto wind; public GroundOffsetDto[] groundOffsets; public string id, assetKey; public int version; public float[] positions, normals, colors, uv, pivot; public int[] triangles; public MaterialDto material; }
 [Serializable] public class LibraryDto { public int schemaVersion; public string libraryVersion, units, axes, winding, uvOrigin; public TextureDto[] textures; public AssetDto[] assets; }
 [Serializable] public class ModelDto { public string file, id; public int version; }
 [Serializable] public class TypeDto { public string assetKey; public float yawOffsetDeg; public ModelDto sharedModel; }
 [Serializable] public class TypesDto { public TypeDto shortgrass, groundlitter, meadowgrass, bush, rock, fern, pine, log, stump, rootfan, grass, reed, flowers, birch, willow, scotspine, hazel, bramble, ivy, sedge, foxglove, horsetail, dock, rowan, juniper, clover, shelfshroom, mossrock, mushroom, meadowwhite, meadowyellow, meadowpink, meadowred, meadowviolet, driftwood, woodfence, maple, cherry, zelkova, nara, sugi, hinoki, islandash, olive, eucalyptus, dragontree, elftree, worldtree, oak, palm, banana, deadtree, twisttree; }
 [Serializable] public class CatalogDto { public TypesDto types; }
 [Serializable] public class WindResponseDto {public int version;public float linear,quadratic,mean,gust;}
 [Serializable] public class PineWindDto { public WindResponseDto response;public int version;public string id;public float minY,maxY,maxDisplacementMetres;public float[] waves,phase; }
 [Serializable] class WindMeta {public TerrainMeta terrain;public WeatherMeta weather;}
 [Serializable] class TerrainMeta {public float[] size;}
 [Serializable] class WeatherMeta {public float wind,amount;public float[] windDir;}
 public sealed class Result { public Texture2D rootPaint;public MapSharedGroundBuilder.Result ground;public GameObject root; public string assetDirectory; public int placed, skipped; public readonly Dictionary<string, GameObject> prefabs = new Dictionary<string, GameObject>(); }
 sealed class Placement { public string instanceId, type; public Vector3 position, scale; public float yaw; }

 static void Require(bool ok, string why) { if (!ok) throw new InvalidDataException("Shared props: " + why); }
 static bool Finite(float x) { return !float.IsNaN(x) && !float.IsInfinity(x); }
 static void Floats(float[] values, int expected, string name) {
  Require(values != null && values.Length == expected, name + " length");
  foreach (var x in values) Require(Finite(x), name + " non-finite value");
 }
 public static LibraryDto ReadLibrary(string file) {
  var d = JsonUtility.FromJson<LibraryDto>(File.ReadAllText(file));
  Require(d != null && d.schemaVersion == 1 && (d.libraryVersion == "shared-rock-fern/4" || d.libraryVersion == "shared-nature/1" || d.libraryVersion == "shared-plants/1" || d.libraryVersion == "shared-plants/2" || (d.libraryVersion == "shared-plants/3" || (d.libraryVersion == "shared-plants/4" || (d.libraryVersion == "shared-plants/5" || (d.libraryVersion == "shared-plants/6" || d.libraryVersion == "shared-plants/7"))))) && d.units == "metres", "unsupported library/version/units");
  int optionalBush=d.assets!=null&&Array.Exists(d.assets,a=>a.id=="bush")?1:0;
  int optionalGround=d.assets==null?0:Array.FindAll(d.assets,a=>a.id=="meadowgrass"||a.id=="shortgrass"||a.id=="groundlitter").Length;
  Require(d.assets != null && d.assets.Length == (d.libraryVersion == "shared-plants/7" ? 49+optionalBush+optionalGround : (d.libraryVersion == "shared-plants/6" || d.libraryVersion == "shared-plants/7") ? 32 : (d.libraryVersion == "shared-plants/5" || (d.libraryVersion == "shared-plants/6" || d.libraryVersion == "shared-plants/7")) ? 30 : d.libraryVersion == "shared-plants/4" ? 25 : (d.libraryVersion == "shared-plants/2" || (d.libraryVersion == "shared-plants/3" || (d.libraryVersion == "shared-plants/4" || (d.libraryVersion == "shared-plants/5" || (d.libraryVersion == "shared-plants/6" || d.libraryVersion == "shared-plants/7"))))) ? 19 : d.libraryVersion == "shared-plants/1" ? 9 : d.libraryVersion == "shared-nature/1" ? 6 : 2) && d.textures != null && d.textures.Length == (d.libraryVersion == "shared-plants/7" ? 7 : (d.libraryVersion == "shared-plants/6" || d.libraryVersion == "shared-plants/7") ? 6 : (d.libraryVersion == "shared-plants/2" || (d.libraryVersion == "shared-plants/3" || (d.libraryVersion == "shared-plants/4" || (d.libraryVersion == "shared-plants/5" || (d.libraryVersion == "shared-plants/6" || d.libraryVersion == "shared-plants/7"))))) ? 5 : d.libraryVersion == "shared-plants/1" ? 4 : d.libraryVersion == "shared-nature/1" ? 3 : 2), "unexpected asset/texture count");
  var ids = new HashSet<string>(); var texIds = new HashSet<string>();
  foreach (var t in d.textures) {
   Require(t != null && texIds.Add(t.id) && (t.id == "rock-basecolor-v1" || t.id == "fern-basecolor-v1" || t.id == "forest-atlas-v1" || t.id == "ground-plants-atlas-v1" || t.id == "woodland-plants-atlas-v1" || t.id == "weathered-wood-v1" || t.id == "tree-canopies-v1"), "texture ID");
   Require(t.width > 0 && t.width <= 1024 && t.height > 0 && t.height <= 1024 && t.colorSpace == "sRGB" && (((t.id == "forest-atlas-v1" || t.id == "ground-plants-atlas-v1" || t.id == "woodland-plants-atlas-v1" || t.id == "weathered-wood-v1" || t.id == "tree-canopies-v1") && t.filter == "trilinear" && t.mipmaps && t.anisotropy == 2) || (t.id != "forest-atlas-v1" && t.id != "ground-plants-atlas-v1" && t.id != "woodland-plants-atlas-v1" && t.id != "weathered-wood-v1" && t.id != "tree-canopies-v1" && t.filter == "bilinear" && !t.mipmaps)), "texture parameters");
   Require(t.wrap == "repeat" || t.wrap == "clamp", "texture wrap");
   var bytes = Convert.FromBase64String(t.png); Require(bytes.Length >= 24 && bytes[0] == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71, "PNG signature");
  }
  foreach (var a in d.assets) {
   Require(a != null && ids.Add(a.id) && (a.id == "shortgrass" || a.id == "groundlitter" || a.id == "meadowgrass" || a.id == "bush" || a.id == "rock" || a.id == "fern" || a.id == "pine" || a.id == "log" || a.id == "stump" || a.id == "rootfan" || a.id == "grass" || a.id == "reed" || a.id == "flowers" || a.id == "birch" || a.id == "willow" || a.id == "scotspine" || a.id == "hazel" || a.id == "bramble" || a.id == "ivy" || a.id == "sedge" || a.id == "foxglove" || a.id == "horsetail" || a.id == "dock" || a.id == "rowan" || a.id == "juniper" || a.id == "clover" || a.id == "shelfshroom" || a.id == "mossrock" || a.id == "mushroom" || a.id == "meadowwhite" || a.id == "meadowyellow" || a.id == "meadowpink" || a.id == "meadowred" || a.id == "meadowviolet" || a.id == "driftwood" || a.id == "woodfence" || a.id == "maple" || a.id == "cherry" || a.id == "zelkova" || a.id == "nara" || a.id == "sugi" || a.id == "hinoki" || a.id == "islandash" || a.id == "olive" || a.id == "eucalyptus" || a.id == "dragontree" || a.id == "elftree" || a.id == "worldtree" || a.id == "oak" || a.id == "palm" || a.id == "banana" || a.id == "deadtree" || a.id == "twisttree") && a.assetKey == "tdj/" + a.id && a.version == (a.id == "bush" && a.version==2 ? 2 : a.id == "rock" ? 4 : a.id == "fern" ? 3 : 1), "asset ID/version");
   if(a.wind!=null&&a.wind.maxDisplacementMetres>0)Require(a.wind.minY>=0&&a.wind.maxY>a.wind.minY&&a.wind.maxDisplacementMetres<=.3f&&a.wind.uvMin==-1,"plant wind contract");
   Require(a.positions != null && a.positions.Length > 0 && a.positions.Length % 3 == 0 && a.positions.Length <= 180000, "mesh size");
   int n = a.positions.Length / 3;if(a.wind!=null)Require(Finite(a.wind.maxCombinedDisplacementMetres)&&a.wind.maxCombinedDisplacementMetres>=0&&a.wind.maxCombinedDisplacementMetres<=.3f&&(a.wind.maxCombinedDisplacementMetres==0||a.wind.maxCombinedDisplacementMetres>=a.wind.maxDisplacementMetres),"combined motion cap");
   Require(a.contact==null||a.contact.version==0||a.motionWeights!=null,"contact requires weights");if((d.libraryVersion=="shared-plants/3"||(d.libraryVersion=="shared-plants/4"||(d.libraryVersion=="shared-plants/5"||(d.libraryVersion=="shared-plants/6"||d.libraryVersion=="shared-plants/7"))))&&a.id!="shortgrass"&&a.id!="groundlitter"&&a.id!="meadowgrass"&&a.id!="rock"&&a.id!="fern"&&a.id!="pine"&&a.id!="log"&&a.id!="stump"&&a.id!="rootfan"&&a.id!="grass"&&a.id!="reed"&&a.id!="flowers"&&a.id!="shelfshroom"&&a.id!="mossrock"&&a.id!="mushroom"&&a.id!="driftwood"&&a.id!="woodfence")Require(a.motionWeights!=null,"plant motion missing");if(a.motionWeights!=null){Require(d.libraryVersion=="shared-plants/3"||(d.libraryVersion=="shared-plants/4"||(d.libraryVersion=="shared-plants/5"||(d.libraryVersion=="shared-plants/6"||d.libraryVersion=="shared-plants/7"))),"weighted library version");Floats(a.motionWeights,n*2,"motion mask");foreach(float w in a.motionWeights)Require(w>=0&&w<=1,"motion mask range");Require(a.wind!=null&&Finite(a.wind.phaseOffset)&&a.contact!=null&&a.contact.version==1&&Finite(a.contact.radius)&&a.contact.radius>0&&a.contact.minY>=0&&a.contact.maxY>a.contact.minY&&a.contact.maxDisplacementMetres>0&&a.contact.maxDisplacementMetres<=.3f,"motion/contact contract");}
   // JsonUtility can instantiate an absent nested DTO with its default version zero.
   if(a.rootGrounding!=null&&a.rootGrounding.version==0)a.rootGrounding=null;
   if(a.rootSurface!=null&&a.rootSurface.version==0)a.rootSurface=null;
   if(a.rootSurface!=null){Require(a.rootSurface.version==1&&a.rootSurface.bandMetres>0&&a.rootSurface.bandMetres<=.3f&&a.rootSurface.mossHeightMetres>=a.rootSurface.bandMetres&&a.rootSurface.mossHeightMetres<=1,"root surface contract");Floats(a.rootWood,n,"root wood mask");foreach(float w in a.rootWood)Require(w==0||w==1,"wood mask binary");}
   if(a.rootGrounding!=null){Require(a.rootGrounding.version==1&&a.rootGrounding.maxSlope==.15f&&a.rootGrounding.fadeHeightMetres>0,"root plane contract");Floats(a.rootWeights,n,"root weights");foreach(float w in a.rootWeights)Require(w>=0&&w<=1,"root weight range");}
   if(a.glow!=null){Floats(a.glow,n,"glow");foreach(float g in a.glow)Require(g>=0&&g<=4,"glow range");}
   Floats(a.positions, n * 3, "positions"); Floats(a.normals, n * 3, "normals"); Floats(a.colors, n * 3, "colors"); Floats(a.uv, n * 2, "uv"); Floats(a.pivot, 3, "pivot");
   Require(a.pivot[0] == 0 && a.pivot[1] == 0 && a.pivot[2] == 0, "pivot must be ground origin");
   Require(a.triangles != null && a.triangles.Length > 0 && a.triangles.Length % 3 == 0, "triangle count");
   foreach (int ix in a.triangles) Require(ix >= 0 && ix < n, "triangle index");
   var m = a.material; Require(m != null && texIds.Contains(m.texture), "material texture"); Floats(m.baseColor, 4, "baseColor");
   Require(m.lighting == "lambert" && m.alphaCutoff == (m.texture == "tree-canopies-v1" ? ((a.id=="deadtree"||a.id=="twisttree")?0:.42f) : (((a.id == "bush" && a.version==2) || a.id == "fern" || a.id == "pine" || a.id == "flowers" || a.id == "birch" || a.id == "willow" || a.id == "scotspine" || a.id == "hazel" || a.id == "juniper" || a.id == "rowan") ? .42f : 0)) && m.doubleSided == (a.id=="shortgrass" || a.id=="groundlitter" || a.id=="meadowgrass" || a.id=="bush" || m.texture == "tree-canopies-v1" || a.id == "fern" || a.id == "pine" || a.id == "grass" || a.id == "reed" || a.id == "flowers" || a.id == "birch" || a.id == "willow" || a.id == "scotspine" || a.id == "hazel" || a.id == "bramble" || a.id == "ivy" || a.id == "sedge" || a.id == "foxglove" || a.id == "horsetail" || a.id == "dock" || a.id == "rowan" || a.id == "juniper" || a.id == "clover" || a.id == "shelfshroom" || a.id == "mossrock" || a.id == "mushroom" || a.id == "meadowwhite" || a.id == "meadowyellow" || a.id == "meadowpink" || a.id == "meadowred" || a.id == "meadowviolet"), "material parameters");
  }
  return d;
 }
 static float Number(string x) { var v = float.Parse(x, CultureInfo.InvariantCulture); Require(Finite(v), "non-finite placement"); return v; }
 static TypeDto Type(CatalogDto c,string id){switch(id){case "shortgrass":return c.types.shortgrass;case "groundlitter":return c.types.groundlitter;case "meadowgrass":return c.types.meadowgrass;case "bush":return c.types.bush;case "rock":return c.types.rock;case "fern":return c.types.fern;case "pine":return c.types.pine;case "log":return c.types.log;case "stump":return c.types.stump;case "rootfan":return c.types.rootfan;case "grass":return c.types.grass;case "reed":return c.types.reed;case "flowers":return c.types.flowers;case "birch":return c.types.birch;case "willow":return c.types.willow;case "scotspine":return c.types.scotspine;case "hazel":return c.types.hazel;case "bramble":return c.types.bramble;case "ivy":return c.types.ivy;case "sedge":return c.types.sedge;case "foxglove":return c.types.foxglove;case "horsetail":return c.types.horsetail;case "dock":return c.types.dock;case "rowan":return c.types.rowan;case "juniper":return c.types.juniper;case "clover":return c.types.clover;case "shelfshroom":return c.types.shelfshroom;case "mossrock":return c.types.mossrock;case "mushroom":return c.types.mushroom;case "meadowwhite":return c.types.meadowwhite;case "meadowyellow":return c.types.meadowyellow;case "meadowpink":return c.types.meadowpink;case "meadowred":return c.types.meadowred;case "meadowviolet":return c.types.meadowviolet;case "driftwood":return c.types.driftwood;case "woodfence":return c.types.woodfence;case "maple":return c.types.maple;case "cherry":return c.types.cherry;case "zelkova":return c.types.zelkova;case "nara":return c.types.nara;case "sugi":return c.types.sugi;case "hinoki":return c.types.hinoki;case "islandash":return c.types.islandash;case "olive":return c.types.olive;case "eucalyptus":return c.types.eucalyptus;case "dragontree":return c.types.dragontree;case "elftree":return c.types.elftree;case "worldtree":return c.types.worldtree;case "oak":return c.types.oak;case "palm":return c.types.palm;case "banana":return c.types.banana;case "deadtree":return c.types.deadtree;case "twisttree":return c.types.twisttree;default:return null;}}
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
  if(File.Exists(windFile)){wind=JsonUtility.FromJson<PineWindDto>(File.ReadAllText(windFile));Require(wind!=null&&(wind.version==1||wind.version==2)&&wind.id=="pine"&&wind.minY==2.15f&&wind.maxY==6.408f&&wind.maxDisplacementMetres==(wind.version==1?.12f:.16f)&&wind.waves!=null&&wind.waves.Length==4&&wind.phase!=null&&wind.phase.Length==2,"pine wind contract");}
  if(wind!=null&&wind.version==2)Require(wind.response!=null&&wind.response.version==1&&wind.response.linear==.25f&&wind.response.quadratic==.75f&&wind.response.mean==.65f&&wind.response.gust==.35f,"wind response contract");
  RootPaintDto rootPaint=null;var surfaces=new Dictionary<string,Vector4>();var rootPlanes=new Dictionary<string,Vector2>();string rootFile=Path.Combine(exportDirectory,"root_grounding.json");
  if(File.Exists(rootFile)){var planes=JsonUtility.FromJson<RootPlanesDto>(File.ReadAllText(rootFile));Require(planes!=null&&planes.version==1&&planes.axes=="Unity world XZ"&&planes.instances!=null,"root planes");rootPaint=planes.paint;if(rootPaint!=null&&rootPaint.resolution==0)rootPaint=null;foreach(var plane in planes.instances){Floats(plane.slope,2,"root slope");var slope=new Vector2(plane.slope[0],plane.slope[1]);Require(slope.magnitude<=.15001f&&!rootPlanes.ContainsKey(plane.instanceId),"root slope range/unique ID");rootPlanes.Add(plane.instanceId,slope);if(plane.terrain!=null){Floats(plane.terrain,4,"root terrain");Require(plane.terrain[0]>=0&&plane.terrain[1]>=0&&plane.terrain[2]>=0&&plane.terrain[0]+plane.terrain[1]+plane.terrain[2]<=1.00001f,"root terrain range");surfaces.Add(plane.instanceId,new Vector4(plane.terrain[0],plane.terrain[1],plane.terrain[2],plane.terrain[3]));}}}
  int skipped; var rows = ReadPlacements(Path.Combine(exportDirectory, "props.csv"), cat, lib, out skipped);
  var shader = Shader.Find("MapSharedProps/Lit"); Require(shader != null && shader.isSupported, "MapSharedProps/Lit shader unavailable");
  var r = new Result { skipped = skipped };
  const string rootDir = "Assets/MapSharedPropsGenerated";
  if (!AssetDatabase.IsValidFolder(rootDir)) AssetDatabase.CreateFolder("Assets", "MapSharedPropsGenerated");
  r.assetDirectory = AssetDatabase.GenerateUniqueAssetPath(rootDir + "/Pilot");
  AssetDatabase.CreateFolder(rootDir, Path.GetFileName(r.assetDirectory));
  try {
   if(Array.Exists(lib.assets,a=>a.rootSurface!=null)&&File.Exists(Path.Combine(exportDirectory,"shared_ground.json")))r.ground=MapSharedGroundBuilder.Build(Path.Combine(exportDirectory,"shared_ground.json"),GroundEditorZero(Path.Combine(exportDirectory,"meta.json")));
   if(rootPaint!=null){Require(rootPaint.file=="root_paint.png"&&rootPaint.resolution>=2&&rootPaint.resolution<=1025,"root paint filename/resolution");Floats(rootPaint.sizeMetres,2,"root paint size");Require(rootPaint.sizeMetres[0]>0&&rootPaint.sizeMetres[1]>0,"root paint extent");string path=r.assetDirectory+"/root_paint.png";File.Copy(Path.Combine(exportDirectory,rootPaint.file),path);AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceSynchronousImport);var importer=(TextureImporter)AssetImporter.GetAtPath(path);importer.sRGBTexture=false;importer.mipmapEnabled=false;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.wrapMode=TextureWrapMode.Clamp;importer.filterMode=FilterMode.Bilinear;importer.npotScale=TextureImporterNPOTScale.None;importer.maxTextureSize=2048;importer.SaveAndReimport();r.rootPaint=AssetDatabase.LoadAssetAtPath<Texture2D>(path);Require(r.rootPaint&&r.rootPaint.width==rootPaint.resolution&&r.rootPaint.height==rootPaint.resolution,"root paint dimensions");}
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
    int n = a.positions.Length / 3;if(a.wind!=null)Require(Finite(a.wind.maxCombinedDisplacementMetres)&&a.wind.maxCombinedDisplacementMetres>=0&&a.wind.maxCombinedDisplacementMetres<=.3f&&(a.wind.maxCombinedDisplacementMetres==0||a.wind.maxCombinedDisplacementMetres>=a.wind.maxDisplacementMetres),"combined motion cap"); var vertices = new Vector3[n]; var normals = new Vector3[n]; var colors = new Color[n]; var uv = new Vector2[n];
    for (int i = 0; i < n; i++) {
     int k = i * 3; vertices[i] = new Vector3(a.positions[k], a.positions[k+1], a.positions[k+2]); normals[i] = new Vector3(a.normals[k], a.normals[k+1], a.normals[k+2]);
     colors[i] = new Color(a.colors[k], a.colors[k+1], a.colors[k+2], 1); uv[i] = new Vector2(a.uv[i*2], a.uv[i*2+1]);
    }
    var mesh = new Mesh { name = a.assetKey + "/v" + a.version, indexFormat = IndexFormat.UInt16, vertices = vertices, normals = normals, colors = colors, uv = uv, triangles = a.triangles };
    if(a.motionWeights!=null){var mask=new Vector2[n];for(int i=0;i<n;i++)mask[i]=new Vector2(a.motionWeights[i*2],a.motionWeights[i*2+1]);mesh.uv2=mask;}if(a.glow!=null){var emission=new Vector2[n];for(int i=0;i<n;i++)emission[i]=new Vector2(a.glow[i],0);mesh.uv3=emission;}if(a.rootGrounding!=null){var roots=new Vector2[n];for(int i=0;i<n;i++)roots[i]=new Vector2(a.rootWeights[i],a.rootWood!=null?a.rootWood[i]:0);mesh.uv4=roots;}mesh.RecalculateBounds();if(a.rootGrounding!=null){var b=mesh.bounds;float radius=Mathf.Max(Mathf.Abs(b.min.x),Mathf.Abs(b.max.x))+Mathf.Max(Mathf.Abs(b.min.z),Mathf.Abs(b.max.z));b.Expand(new Vector3(0,radius*.3f,0));mesh.bounds=b;}if((a.wind!=null&&a.wind.maxDisplacementMetres>0)||(a.id=="pine"&&wind!=null)){var bounds=mesh.bounds;float pad=(a.wind!=null&&a.wind.maxDisplacementMetres>0?a.wind.maxDisplacementMetres:wind.maxDisplacementMetres)+(a.contact!=null?a.contact.maxDisplacementMetres:0);bounds.Expand(new Vector3(pad*2,0,pad*2));mesh.bounds=bounds;} AssetDatabase.CreateAsset(mesh, r.assetDirectory + "/" + a.id + ".asset");
    var d = a.material; var mat = new Material(shader) { name = a.id + "/v" + a.version };
    mat.SetTexture("_BaseMap", textures[d.texture]); mat.SetColor("_BaseColor", new Color(d.baseColor[0],d.baseColor[1],d.baseColor[2],d.baseColor[3]));
    if(a.id=="pine"&&wind!=null){mat.SetVector("_PineBand",new Vector4(wind.minY,wind.maxY,wind.maxDisplacementMetres,1));mat.SetVector("_PineWaves",new Vector4(wind.waves[0],wind.waves[1],wind.waves[2],wind.waves[3]));mat.SetVector("_PinePhase",new Vector4(wind.phase[0],wind.phase[1],0,0));}
    if(a.wind!=null&&a.wind.maxDisplacementMetres>0){mat.SetVector("_PineBand",new Vector4(a.wind.minY,a.wind.maxY,a.wind.maxDisplacementMetres,a.motionWeights!=null?3:2));if(a.motionWeights!=null)mat.SetVector("_PinePhase",new Vector4(.17f,.13f,a.wind.phaseOffset,0));}
    if(wind!=null&&wind.version==2)mat.SetVector("_PineResponse",new Vector4(wind.response.linear,wind.response.quadratic,wind.response.mean,wind.response.gust));
    if(a.wind!=null)mat.SetFloat("_PlantCombinedLimit",a.wind.maxCombinedDisplacementMetres);
    if(a.rootSurface!=null&&r.ground!=null&&r.ground.data.materialVersion==3){var ground=r.ground.material;if(r.rootPaint){mat.SetTexture("_RootPaint",r.rootPaint);mat.SetVector("_RootPaintMap",new Vector4(rootPaint.sizeMetres[0]*.5f,rootPaint.sizeMetres[1]*.5f,rootPaint.resolution,1));}mat.EnableKeyword("ROOT_SURFACE");mat.SetVector("_RootSurface",new Vector4(a.rootSurface.bandMetres,a.rootSurface.mossHeightMetres,0,0));mat.SetTexture("_RootGrass",ground.GetTexture("_GroundMap"));mat.SetTexture("_RootDirt",ground.GetTexture("_DirtMap"));foreach(var pair in new[]{new[]{"_RootGrassParams","_GroundParams"},new[]{"_RootDirtParams","_DirtParams"},new[]{"_RootGrassOffset","_GroundOffset"},new[]{"_RootDirtOffset","_DirtOffset"},new[]{"_RootWaveA","_WaveA"},new[]{"_RootWaveB","_WaveB"}})mat.SetVector(pair[0],ground.GetVector(pair[1]));}
    if(a.rootGrounding!=null)mat.EnableKeyword("ROOT_GROUND");
    if(a.glow!=null)mat.EnableKeyword("SHARED_GLOW");mat.SetFloat("_Cutoff", d.alphaCutoff); mat.SetFloat("_Cull", d.doubleSided ? 0 : 2);
    mat.renderQueue = d.alphaCutoff > 0 ? 2450 : 2000;
    AssetDatabase.CreateAsset(mat, r.assetDirectory + "/" + a.id + ".mat");
    var go = new GameObject(a.id); go.AddComponent<MeshFilter>().sharedMesh = mesh; go.AddComponent<MeshRenderer>().sharedMaterial = mat;
    r.prefabs.Add(a.id, PrefabUtility.SaveAsPrefabAsset(go, r.assetDirectory + "/" + a.id + ".prefab")); UnityEngine.Object.DestroyImmediate(go);
   }
   r.root = new GameObject("Shared prop pilot");var contactDriver=(lib.libraryVersion=="shared-plants/3"||(lib.libraryVersion=="shared-plants/4"||(lib.libraryVersion=="shared-plants/5"||(lib.libraryVersion=="shared-plants/6"||lib.libraryVersion=="shared-plants/7"))))?r.root.AddComponent<MapSharedProps.SharedPlantContact>():null; if (parent != null) r.root.transform.SetParent(parent, false);
   foreach (var p in rows) {
    var go = (GameObject)PrefabUtility.InstantiatePrefab(r.prefabs[p.type], r.root.transform); go.name = p.instanceId;
    go.transform.localPosition = p.position; go.transform.localRotation = Quaternion.Euler(0, p.yaw, 0); go.transform.localScale = p.scale; r.placed++;var model=Array.Find(lib.assets,a=>a.id==p.type);if(model.contact!=null&&model.contact.version==1)contactDriver.Register(go.GetComponent<Renderer>(),model.contact.radius,model.contact.minY,model.contact.maxY,model.contact.maxDisplacementMetres);
   }
   foreach(var p in rows)if(rootPlanes.TryGetValue(p.instanceId,out var slope)){var tr=r.root.transform.Find(p.instanceId);if(tr&&Array.Find(lib.assets,a=>a.id==p.type).rootGrounding!=null)MapSharedProps.SharedRootGrounding.SetSlope(tr.GetComponent<Renderer>(),slope);}
   foreach(var p in rows)if(surfaces.TryGetValue(p.instanceId,out var surface)){var tr=r.root.transform.Find(p.instanceId);if(tr&&Array.Find(lib.assets,a=>a.id==p.type).rootSurface!=null)MapSharedProps.SharedRootGrounding.SetSurface(tr.GetComponent<Renderer>(),surface);}
   if(contactDriver)contactDriver.Refresh();
   if(wind!=null){var driver=r.root.AddComponent<MapSharedProps.SharedPineWind>();ConfigureWind(driver,Path.Combine(exportDirectory,"meta.json"));driver.Apply(0);}
   AssetDatabase.SaveAssets(); return r;
  } catch (Exception failure) {
   Debug.LogException(failure);
   if (r.root != null) UnityEngine.Object.DestroyImmediate(r.root);
   AssetDatabase.DeleteAsset(r.assetDirectory);if(r.ground!=null)AssetDatabase.DeleteAsset(r.ground.folder); throw;
  }
 }
 static Vector2 GroundEditorZero(string metaFile){if(!File.Exists(metaFile))return Vector2.zero;var meta=JsonUtility.FromJson<WindMeta>(File.ReadAllText(metaFile));return meta.terrain?.size!=null&&meta.terrain.size.Length==3?new Vector2(meta.terrain.size[0]*.5f,meta.terrain.size[2]*.5f):Vector2.zero;}
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
