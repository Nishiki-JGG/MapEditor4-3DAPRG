using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace MapRuins.EditorTools {
// 必須構造は省略して成功扱いにしない。呼出元は既存地図生成前に Preflight を行う。
public static class RuinsStructureImporter {
 public const string Feature="ruinsStructuresV1";
 [Serializable] public sealed class Item { public string id,kind,finish; public float[] positions,normals,uv,position; public float yawDeg; public int[] triangles; }
 [Serializable] public sealed class MeshPart { public float[] positions,uv; public int[] triangles; }
 [Serializable] public sealed class Data { public string format,requiredFeature; public int version,terrainResolution; public float size; public Item[] items; public StoneSurface surface; public SoilSurface soilSurface; public MeshPart cap; public int[] holes; }
 static void Check(bool v,string reason){if(!v)throw new InvalidDataException(reason);}
 static bool Finite(float v)=>!float.IsNaN(v)&&!float.IsInfinity(v);
 public static void CheckRequirements(string json,ISet<string> supported){
  // JsonUtility silently treats a scalar requiredFeatures as a missing array.
  // Inspect JSON types with the framework reader before accepting legacy absence.
  Check(json!=null,"Missing manifest JSON");
  var quotas=new System.Xml.XmlDictionaryReaderQuotas{MaxDepth=64,MaxStringContentLength=64*1024*1024,MaxArrayLength=1000000};
  using(var reader=System.Runtime.Serialization.Json.JsonReaderWriterFactory.CreateJsonReader(System.Text.Encoding.UTF8.GetBytes(json),quotas)){
   var doc=new System.Xml.XmlDocument();doc.XmlResolver=null;doc.Load(reader);
   var root=doc.DocumentElement;Check(root!=null&&root.GetAttribute("type")=="object","Manifest must be a JSON object");bool found=false;
   foreach(System.Xml.XmlNode node in root.ChildNodes){
    var field=node as System.Xml.XmlElement;if(field==null||field.LocalName!="requiredFeatures")continue;
    Check(!found,"Duplicate requiredFeatures");found=true;Check(field.GetAttribute("type")=="array","requiredFeatures must be an array");
    foreach(System.Xml.XmlNode child in field.ChildNodes){var feature=child as System.Xml.XmlElement;Check(feature!=null&&feature.GetAttribute("type")=="string"&&!string.IsNullOrEmpty(feature.InnerText),"Invalid required feature");Check(supported!=null&&supported.Contains(feature.InnerText),"Unsupported required feature: "+feature.InnerText);}
   }
  }
 }
 public static Data Preflight(string exportDirectory,ISet<string> supported) {
  foreach(var name in new[]{"manifest.json","meta.json"}){string f=Path.Combine(exportDirectory,name);Check(File.Exists(f),name+" がありません");CheckRequirements(File.ReadAllText(f),supported);}
  string source=Path.Combine(exportDirectory,"ruins_structures.json");Check(File.Exists(source),"必須の遺跡構造データがありません");
  Check(new FileInfo(source).Length<=64*1024*1024,"構造データが上限64MBを超えています");var d=JsonUtility.FromJson<Data>(File.ReadAllText(source));Validate(d);return d;
 }
 [Serializable] public sealed class SoilSurface {public string id,encodedColorSpace;public int appearanceRevision;public float secondWeight;public float[] rotationCS,secondOffset;public string mime,imageBase64;public float tileMetres;public int width,height;}
 [Serializable] public sealed class StoneSurface {public string id,colorSpace,normalConvention,surfaceChannels,colorPng,normalPng,surfacePng;public int width,height;public float tileMetres;}
 public static void Validate(Data d){
  Check(d!=null&&d.format=="tdj-ruins-structures"&&d.version==1&&d.requiredFeature==Feature,"遺跡構造形式が未対応です");
  Check(Finite(d.size)&&d.size>0&&d.size<=128&&d.terrainResolution>=33&&d.terrainResolution<=4097,"遺跡地形範囲が不正です");
  int n=d.terrainResolution-1;Check((n&(n-1))==0&&d.holes!=null&&d.holes.Length==n*n,"地形穴の解像度が不正です");foreach(int v in d.holes)Check(v==0||v==1,"地形穴の値が不正です");
  Check(d.items!=null&&d.items.Length<=2048&&d.cap!=null,"遺跡構造一覧が不正です");var ids=new HashSet<string>();var kinds=new HashSet<string>(new[]{"buttress_wall","offering_table","soil_bank","window_wall","balustrade","wall_niche","stone_beam","edge_corner","edge_end","column_base","column_shaft","column_capital","paving","paving_broken","arch","arch_broken","pier","pier_broken","wall","wall_broken","wall_ruined","opening_broken","corner_in","corner_out","end","opening","tee","platform","edge","stairs"});long totalVertices=0;
  foreach(var p in d.items){Check(p!=null&&!string.IsNullOrEmpty(p.id)&&ids.Add(p.id),"遺跡構造IDが不正です");Check(kinds.Contains(p.kind),"未対応の構造種別です");ValidateMesh(p.positions,p.triangles);totalVertices+=p.positions.Length/3;Check(totalVertices<=1000000,"構造頂点の総数が上限を超えています");Check(p.position!=null&&p.position.Length==3&&Array.TrueForAll(p.position,v=>Finite(v)&&Mathf.Abs(v)<10000)&&Finite(p.yawDeg)&&Mathf.Abs(p.yawDeg/90-Mathf.Round(p.yawDeg/90))<.00001f,"構造物の配置が不正です");Check(p.normals!=null&&p.normals.Length==p.positions.Length&&p.uv!=null&&p.uv.Length==p.positions.Length/3*2,"法線・UVが不正です");foreach(float f in p.normals)Check(Finite(f),"法線に非有限値があります");foreach(float f in p.uv)Check(Finite(f),"UVに非有限値があります");Check(p.finish=="stone"||p.finish=="worn"||p.finish=="carved","未対応の石材です");}
  if(d.surface!=null&&!string.IsNullOrEmpty(d.surface.id)){var t=d.surface;Check((((t.id=="ruins-limestone-v1"||t.id=="ruins-limestone-aged-v2")&&t.width==256&&t.height==256&&t.tileMetres==2)||(t.id=="ruins-limestone-aged-v3"&&(t.width==512||t.width==1024)&&t.height==t.width&&t.tileMetres==4))&&t.colorSpace=="sRGB"&&t.normalConvention=="OpenGL"&&t.surfaceChannels=="R:ao,G:roughness,B:metal","Unsupported ruins surface");foreach(var image in new[]{t.colorPng,t.normalPng,t.surfacePng})Check(!string.IsNullOrEmpty(image)&&image.Length<=8*1024*1024,"Invalid ruins surface image");}
  foreach(var item in d.items)if(item.finish=="carved"){Check(new HashSet<string>{"buttress_wall","offering_table","window_wall","balustrade","wall_niche","opening","opening_broken","stone_beam","wall","wall_broken","wall_ruined","pier","pier_broken","arch","arch_broken","paving","paving_broken","corner_in","corner_out","tee","end","stairs","column_base","column_shaft","column_capital","platform","edge","edge_corner","edge_end"}.Contains(item.kind)&&d.surface?.id=="ruins-limestone-aged-v3","Unsupported carved structure/surface combination");}
  if(Array.Exists(d.items,p=>p.kind=="soil_bank")){Check(d.soilSurface!=null&&d.soilSurface.mime=="image/jpeg"&&d.soilSurface.tileMetres==2&&!string.IsNullOrEmpty(d.soilSurface.imageBase64)&&d.soilSurface.imageBase64.Length<2*1024*1024,"Missing or invalid soil texture");}
  ValidateMesh(d.cap.positions,d.cap.triangles);Check(d.cap.uv!=null&&d.cap.uv.Length==d.cap.positions.Length/3*2&&Array.TrueForAll(d.cap.uv,Finite),"補完面UVが不正です");
 }
 static void ValidateMesh(float[] p,int[] t){Check(p!=null&&p.Length%3==0&&p.Length<=3000000&&t!=null&&t.Length%3==0&&t.Length<=3000000,"構造メッシュが不正です");foreach(float v in p)Check(Finite(v)&&Mathf.Abs(v)<10000,"メッシュ座標が不正です");foreach(int i in t)Check(i>=0&&i<p.Length/3,"メッシュの頂点参照が不正です");}
 static string MeshKey(Item p){using(var s=new MemoryStream()){using(var w=new BinaryWriter(s,System.Text.Encoding.UTF8,true)){foreach(var a in new[]{p.positions,p.normals,p.uv})foreach(float v in a)w.Write(v);foreach(int i in p.triangles)w.Write(i);}using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(s.ToArray()));}}
 static Mesh MakeMesh(string name,float[] p,int[] tris,float[] normals=null,float[] uv=null){var g=new Mesh{name=name,indexFormat=p.Length/3>65535?IndexFormat.UInt32:IndexFormat.UInt16};var v=new Vector3[p.Length/3];for(int i=0;i<v.Length;i++)v[i]=new Vector3(p[i*3],p[i*3+1],p[i*3+2]);g.vertices=v;g.triangles=tris;
  if(normals!=null){var a=new Vector3[v.Length];for(int i=0;i<a.Length;i++)a[i]=new Vector3(normals[3*i],normals[3*i+1],normals[3*i+2]);g.normals=a;}else g.RecalculateNormals();
  if(uv!=null){var a=new Vector2[v.Length];for(int i=0;i<a.Length;i++)a[i]=new Vector2(uv[2*i],uv[2*i+1]);g.uv=a;}if(uv!=null)g.RecalculateTangents();g.RecalculateBounds();return g;}
 // 出力先は新規専用フォルダー。既存TerrainDataは複製後に穴を適用し、失敗時は原本を保全する。
 // URP 17.5 Terrain/Lit のレイヤーを補完メッシュにも接続する。
 // カスタムshaderは無言で代替せず対応材質の明示を要求する。
 static Material[] TerrainCaps(Terrain target,TerrainData terrain,List<UnityEngine.Object> resources){
  const string standard="Universal Render Pipeline/Terrain/Lit";
  Check(target.materialTemplate==null||target.materialTemplate.shader.name==standard,"カスタム地形shaderには明示的な補完面材質アダプターが必要です");
  var layers=terrain.terrainLayers;Check(layers.Length>0&&layers.Length<=32,"補完面には1～32のTerrainLayerが必要です");
  foreach(var l in layers)Check(l!=null&&l.diffuseTexture!=null&&l.tileSize.x>0&&l.tileSize.y>0,"地形レイヤーの画像/寸法が不正です");
  var result=new Material[(layers.Length+3)/4];
  for(int group=0;group<result.Length;group++){
   var shader=Shader.Find(group==0?"MapRuins/TerrainCap":"MapRuins/TerrainCapAdd");Check(shader!=null,"URP地形shaderがありません");
   var m=new Material(shader){name="RuinsTerrainCap_"+group,enableInstancing=false,renderQueue=1900+group};resources.Add(m);result[group]=m;
   var control=terrain.GetAlphamapTexture(group);m.SetTexture("_Control",control);m.SetVector("_Control_TexelSize",new Vector4(1f/control.width,1f/control.height,control.width,control.height));m.SetVector("_Control_ST",new Vector4(1,1,0,0));m.SetFloat("_NumLayersCount",layers.Length);
   m.SetFloat("_TerrainBasemapDistance",100000);m.SetFloat("_EnableInstancedPerPixelNormal",0);
   m.DisableKeyword("_ALPHATEST_ON");m.DisableKeyword("_TERRAIN_INSTANCED_PERPIXEL_NORMAL");
   bool normal=false,mask=false;
   for(int k=0;k<4;k++){
    var l=layers[Mathf.Min(group*4+k,layers.Length-1)];string id=k.ToString();
    m.SetTexture("_Splat"+id,l.diffuseTexture);m.SetTextureScale("_Splat"+id,new Vector2(terrain.size.x/l.tileSize.x,terrain.size.z/l.tileSize.y));m.SetTextureOffset("_Splat"+id,new Vector2(l.tileOffset.x/l.tileSize.x,l.tileOffset.y/l.tileSize.y));
    m.SetTexture("_Normal"+id,l.normalMapTexture);m.SetFloat("_NormalScale"+id,l.normalScale);normal|=l.normalMapTexture!=null;
    m.SetTexture("_Mask"+id,l.maskMapTexture);m.SetFloat("_LayerHasMask"+id,l.maskMapTexture!=null?1:0);mask|=l.maskMapTexture!=null;
    m.SetFloat("_Metallic"+id,l.metallic);m.SetFloat("_Smoothness"+id,l.smoothness);m.SetFloat("_SmoothnessSource"+id,(float)l.smoothnessSource);
    m.SetFloat("_DiffuseHasAlpha"+id,UnityEngine.Experimental.Rendering.GraphicsFormatUtility.HasAlphaChannel(l.diffuseTexture.graphicsFormat)?1:0);
    m.SetVector("_DiffuseRemapScale"+id,l.diffuseRemapMax-l.diffuseRemapMin);m.SetVector("_MaskMapRemapOffset"+id,l.maskMapRemapMin);m.SetVector("_MaskMapRemapScale"+id,l.maskMapRemapMax-l.maskMapRemapMin);
   }
   if(normal)m.EnableKeyword("_NORMALMAP");if(mask)m.EnableKeyword("_MASKMAP");
   if(target.materialTemplate!=null&&target.materialTemplate.IsKeywordEnabled("_TERRAIN_BLEND_HEIGHT")){m.EnableKeyword("_TERRAIN_BLEND_HEIGHT");m.SetFloat("_HeightTransition",target.materialTemplate.GetFloat("_HeightTransition"));}
  }
  return result;
 }

 static Texture2D[] LoadStone(StoneSurface s,string output){
  if(s==null||string.IsNullOrEmpty(s.id))return null;
  var maps=new Texture2D[3];var inputs=new[]{s.colorPng,s.normalPng,s.surfacePng};
  for(int i=0;i<3;i++){
   byte[] bytes=Convert.FromBase64String(inputs[i]);var decoded=new Texture2D(2,2,TextureFormat.RGBA32,false,i!=0);
   try{Check(ImageConversion.LoadImage(decoded,bytes)&&decoded.width==s.width&&decoded.height==s.height,"Invalid limestone PNG");
    if(i==2){var pixels=decoded.GetPixels32();for(int k=0;k<pixels.Length;k++){var p=pixels[k];pixels[k]=new Color32(p.b,p.r,0,(byte)(255-p.g));}decoded.SetPixels32(pixels);decoded.Apply();bytes=decoded.EncodeToPNG();}
   }finally{UnityEngine.Object.DestroyImmediate(decoded);}
   string path=output+"/Stone"+i+".png";File.WriteAllBytes(path,bytes);AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceSynchronousImport);
   var importer=(TextureImporter)AssetImporter.GetAtPath(path);importer.textureType=i==1?TextureImporterType.NormalMap:TextureImporterType.Default;importer.sRGBTexture=i==0;importer.mipmapEnabled=true;importer.wrapMode=TextureWrapMode.Repeat;importer.filterMode=FilterMode.Trilinear;importer.anisoLevel=2;importer.maxTextureSize=s.width;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.SaveAndReimport();maps[i]=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
  }
  return maps;
 }
 public static GameObject Build(Data d,Terrain target,string outputFolder,Material capMaterial=null,bool detailedSoil=false){
  Validate(d);Check(target!=null&&target.terrainData!=null,"対象のTerrainが必要です");var original=target.terrainData;Check(target.transform.rotation==Quaternion.identity&&target.transform.lossyScale==Vector3.one,"Terrainの回転・拡縮は未対応です");
  Check(original.heightmapResolution==d.terrainResolution&&Mathf.Abs(original.size.x-d.size)<.001f&&Mathf.Abs(original.size.z-d.size)<.001f,"Terrainと出力の寸法・解像度が一致しません");
  Check(outputFolder.StartsWith("Assets/",StringComparison.Ordinal)&&!outputFolder.Contains("..")&&!AssetDatabase.IsValidFolder(outputFolder)&&!Directory.Exists(outputFolder),"新しい専用出力先を指定してください");
  var shader=Shader.Find((d.surface?.id=="ruins-limestone-aged-v2"||d.surface?.id=="ruins-limestone-aged-v3")?"MapRuins/AgedLimestone":"Universal Render Pipeline/Lit");Check(shader!=null,"Required ruins stone shader is missing");

  // Explicit pure-soil opt-in: never reinterpret mixed, grass, cave or custom terrain.
  Shader detailedShader=null;
  if(detailedSoil){
   Check(capMaterial==null,"Detailed soil supplies its own cap material");
   Check(d.soilSurface!=null&&d.soilSurface.id=="soil-procedural-v1"&&d.soilSurface.appearanceRevision==2&&d.soilSurface.encodedColorSpace=="sRGB"&&d.soilSurface.mime=="image/jpeg"&&d.soilSurface.tileMetres==2&&d.soilSurface.width==256&&d.soilSurface.height==256,"Detailed soil requires the supported revision 2 exported 256px soil surface");
   var soil=d.soilSurface;Check(!string.IsNullOrEmpty(soil.imageBase64)&&soil.imageBase64.Length<2*1024*1024,"Invalid detailed soil image");Check(Finite(soil.secondWeight)&&soil.secondWeight>=0&&soil.secondWeight<=1&&soil.rotationCS!=null&&soil.rotationCS.Length==2&&Array.TrueForAll(soil.rotationCS,Finite)&&Mathf.Abs(soil.rotationCS[0]*soil.rotationCS[0]+soil.rotationCS[1]*soil.rotationCS[1]-1)<.001f&&soil.secondOffset!=null&&soil.secondOffset.Length==2&&Array.TrueForAll(soil.secondOffset,v=>Finite(v)&&Mathf.Abs(v)<10000),"Invalid detailed soil sampling metadata");
   var layers=original.terrainLayers;Check(layers.Length==1&&layers[0]!=null&&layers[0].diffuseTexture!=null,"Detailed soil requires exactly one soil TerrainLayer");
   var l=layers[0];Check(l.tileSize==Vector2.one*2&&l.tileOffset==Vector2.zero&&l.normalMapTexture==null&&l.maskMapTexture==null,"Detailed soil does not support layer transforms or extra maps");
   Check(l.metallic==0&&l.diffuseRemapMin==Vector4.zero&&l.diffuseRemapMax==Vector4.one,"Detailed soil cannot reinterpret tinted or metallic layers");
   Check(target.materialTemplate==null||target.materialTemplate.shader.name=="Universal Render Pipeline/Terrain/Lit","Detailed soil cannot replace a custom terrain shader");
   var texturePath=AssetDatabase.GetAssetPath(l.diffuseTexture);Check(!string.IsNullOrEmpty(texturePath)&&File.Exists(texturePath),"Detailed soil layer source is unavailable");
   using(var digest=SHA256.Create())Check(Convert.ToBase64String(digest.ComputeHash(File.ReadAllBytes(texturePath)))==Convert.ToBase64String(digest.ComputeHash(Convert.FromBase64String(d.soilSurface.imageBase64))),"Detailed soil TerrainLayer must match the exported soil image");
   detailedShader=Shader.Find("MapRuins/SoilGround");Check(detailedShader!=null&&!ShaderUtil.ShaderHasError(detailedShader),"Detailed soil shader missing or invalid");
  }
  var resources=new List<UnityEngine.Object>();GameObject root=null;TerrainData derived=null;bool committed=false,createdFolder=false;
  try{
   Directory.CreateDirectory(outputFolder);createdFolder=true;AssetDatabase.Refresh();
   derived=UnityEngine.Object.Instantiate(original);derived.name="RuinsTerrain";resources.Add(derived);int n=d.terrainResolution-1;var holes=derived.GetHoles(0,0,n,n);
   // Webの行は-Zから、UnityのTerrain行は+Zから。
   for(int j=0;j<n;j++)for(int i=0;i<n;i++)if(d.holes[j*n+i]!=0)holes[n-1-j,i]=false;derived.SetHoles(0,0,holes);
   var stone=LoadStone(d.surface,outputFolder);
   var mats=new Dictionary<string,Material>();foreach(var finish in (Array.Exists(d.items,i=>i.finish=="carved")?new[]{"stone","worn","carved"}:new[]{"stone","worn"})){var m=new Material(shader){name="Ruins_"+finish};if(finish=="carved")m.EnableKeyword("_RUINS_ORNAMENT");m.SetColor("_BaseColor",finish=="stone"?new Color(.655f,.635f,.573f):new Color(.533f,.518f,.467f));m.SetFloat("_Metallic",0);m.SetFloat("_Smoothness",finish=="stone"?.18f:.06f);if(stone!=null){if(d.surface.id=="ruins-limestone-aged-v3")m.EnableKeyword("_RUINS_DETAIL_V3");var tint=finish!="worn"?Color.white:(d.surface.id=="ruins-limestone-aged-v3"?new Color(229f/255,223f/255,211f/255):new Color(.8353f,.8275f,.7961f));m.SetColor("_BaseColor",QualitySettings.activeColorSpace==ColorSpace.Linear?tint.linear:tint);m.SetTexture("_BaseMap",stone[0]);m.SetTexture("_BumpMap",stone[1]);m.SetFloat("_BumpScale",1);m.SetTexture("_MetallicGlossMap",stone[2]);m.SetTexture("_OcclusionMap",stone[2]);m.SetFloat("_Smoothness",1);m.SetFloat("_OcclusionStrength",1);m.SetTextureScale("_BaseMap",Vector2.one/d.surface.tileMetres);m.EnableKeyword("_NORMALMAP");m.EnableKeyword("_METALLICSPECGLOSSMAP");m.EnableKeyword("_OCCLUSIONMAP");}mats.Add(finish,m);resources.Add(m);}
   Material soilMat=null,soilTerrainMat=null;if(detailedSoil||Array.Exists(d.items,p=>p.kind=="soil_bank")){
    var soilShader=detailedSoil?detailedShader:Shader.Find("Universal Render Pipeline/Lit");Check(soilShader!=null,"Missing URP Lit");string soilPath=outputFolder+"/Soil.jpg";File.WriteAllBytes(soilPath,Convert.FromBase64String(d.soilSurface.imageBase64));AssetDatabase.ImportAsset(soilPath,ImportAssetOptions.ForceSynchronousImport);var si=(TextureImporter)AssetImporter.GetAtPath(soilPath);si.sRGBTexture=!detailedSoil;if(detailedSoil){si.filterMode=FilterMode.Trilinear;si.anisoLevel=2;}si.mipmapEnabled=true;si.wrapMode=TextureWrapMode.Repeat;si.textureCompression=TextureImporterCompression.Uncompressed;si.SaveAndReimport();var st=AssetDatabase.LoadAssetAtPath<Texture2D>(soilPath);Check(st!=null&&st.width==256&&st.height==256,"Invalid soil texture dimensions");soilMat=new Material(soilShader){name="RuinsSoil"};if(!detailedSoil){soilMat.SetColor("_BaseColor",Color.white);soilMat.SetTexture("_BaseMap",st);soilMat.SetFloat("_Smoothness",0);}resources.Add(soilMat);
    if(detailedSoil){soilMat.name="RuinsDetailedSoil";soilMat.SetTexture("_DirtMap",st);soilMat.SetFloat("_DirtWeight",1);soilMat.SetVector("_DirtParams",new Vector4(d.soilSurface.tileMetres,d.soilSurface.secondWeight,d.soilSurface.rotationCS[0],d.soilSurface.rotationCS[1]));soilMat.SetVector("_DirtOffset",new Vector4(d.soilSurface.secondOffset[0],d.soilSurface.secondOffset[1],0,0));soilMat.SetVector("_EditorZero",new Vector4(target.transform.position.x+d.size/2,target.transform.position.z+d.size/2,0,0));soilMat.SetVector("_TerrainSize",new Vector4(d.size,d.size,0,0));soilMat.DisableKeyword("_ALPHATEST_ON");soilMat.enableInstancing=false;
     soilTerrainMat=new Material(soilMat){name="RuinsDetailedSoilTerrain",enableInstancing=true};soilTerrainMat.EnableKeyword("_SOIL_TERRAIN");soilTerrainMat.EnableKeyword("_ALPHATEST_ON");resources.Add(soilTerrainMat);capMaterial=soilMat;
    }
   }
   root=new GameObject("RuinsStructures");root.transform.SetPositionAndRotation(target.transform.position,Quaternion.identity);
   GameObject Add(string name,Mesh mesh,Material material){if(!resources.Contains(mesh))resources.Add(mesh);var o=new GameObject(name);o.transform.SetParent(root.transform,false);o.AddComponent<MeshFilter>().sharedMesh=mesh;o.AddComponent<MeshRenderer>().sharedMaterial=material;o.AddComponent<MeshCollider>().sharedMesh=mesh;return o;}
   var sharedMeshes=new Dictionary<string,Mesh>();foreach(var p in d.items){string key=MeshKey(p);if(!sharedMeshes.TryGetValue(key,out var mesh)){mesh=MakeMesh(p.id,p.positions,p.triangles,p.normals,p.uv);sharedMeshes.Add(key,mesh);}var o=Add(p.id,mesh,p.kind=="soil_bank"?soilMat:mats[p.finish]);o.transform.localPosition=new Vector3(p.position[0],p.position[1],p.position[2]);o.transform.localRotation=Quaternion.Euler(0,p.yawDeg,0);}
   if(d.cap.positions.Length>0){var capMaterials=capMaterial!=null?new[]{capMaterial}:TerrainCaps(target,derived,resources);var cap=Add("TerrainCaps",MakeMesh("TerrainCaps",d.cap.positions,d.cap.triangles,null,d.cap.uv),capMaterials[0]);
    // 1 submeshを各4層パスで描画。Collider/meshを複製しない。
    cap.GetComponent<MeshRenderer>().sharedMaterials=capMaterials;
   }
   int index=0;foreach(var r in resources)AssetDatabase.CreateAsset(r,outputFolder+"/"+(index++).ToString("D4")+".asset");
   // TerrainDataのasset化は複製元のControl subassetをそのまま保存しない。
   // 塗り分けも明示転記する。全解像度×全層の一括配列を避け32行ずつ処理。
   for(int z=0;original.alphamapLayers>0&&z<original.alphamapHeight;z+=32)derived.SetAlphamaps(0,z,original.GetAlphamaps(0,z,original.alphamapWidth,Math.Min(32,original.alphamapHeight-z)));
   EditorUtility.SetDirty(derived);
   // 再生成されたControl subassetの保存参照を結び直す。
   if(d.cap.positions.Length>0&&capMaterial==null){var cm=root.transform.Find("TerrainCaps").GetComponent<MeshRenderer>().sharedMaterials;for(int i=0;i<cm.Length;i++){cm[i].SetTexture("_Control",derived.GetAlphamapTexture(i));EditorUtility.SetDirty(cm[i]);}}
   PrefabUtility.SaveAsPrefabAsset(root,outputFolder+"/Ruins.prefab");AssetDatabase.SaveAssets();
   if(detailedSoil)target.materialTemplate=soilTerrainMat;target.terrainData=derived;var collider=target.GetComponent<TerrainCollider>();if(collider!=null)collider.terrainData=derived;committed=true;return root;
  }finally{if(!committed){if(createdFolder)AssetDatabase.DeleteAsset(outputFolder);if(root!=null)UnityEngine.Object.DestroyImmediate(root);foreach(var r in resources)if(r!=null&&!AssetDatabase.Contains(r))UnityEngine.Object.DestroyImmediate(r);}}
 }
}
}
