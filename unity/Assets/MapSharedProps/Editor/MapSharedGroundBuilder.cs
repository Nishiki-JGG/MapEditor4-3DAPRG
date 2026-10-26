using System;
using System.IO;
using UnityEditor;
using UnityEngine;
namespace MapSharedProps.EditorTools {
// Isolated shared-ground material builder; no game terrain, scene or settings changes.
public static class MapSharedGroundBuilder {
 [Serializable] public class GroundDto { public int schemaVersion,materialVersion,width,height,anisotropy;public string id,mime,imageBase64,encodedColorSpace;public float tileMetres,secondWeight,decodeExponent;public float[] rotationCS,secondOffset;public bool mipmaps,publicReleaseApproved;public DirtDto dirt; }
 [Serializable] public class DirtDto {public int width,height;public string mime,imageBase64,encodedColorSpace;public float tileMetres,secondWeight;public float[] rotationCS,secondOffset;public bool mipmaps;public int anisotropy;}
 // JsonUtility does not deserialize nested arrays. Wave parameters have named flat fields on export.
 [Serializable] public class WavesDto { public float[] waveA,waveB; }
 public sealed class Result {public Material material;public Texture2D texture;public string folder;public GroundDto data;}
  [Serializable] class FloorMeta {public FloorTerrain terrain;public BlackFloor pureBlackFloor;}
  [Serializable] class FloorTerrain {public float[] size;}
  [Serializable] class BlackFloor {public string id,mask;public int channel;public bool opaque;}
  public static void ApplyPureBlackFloor(Material material,string exportDirectory) {
   material.SetFloat("_PureBlackEnabled",0);
   string metaFile=Path.Combine(exportDirectory,"meta.json");if(!File.Exists(metaFile))return;
   var meta=JsonUtility.FromJson<FloorMeta>(File.ReadAllText(metaFile));var b=meta.pureBlackFloor;
   if(b==null||string.IsNullOrEmpty(b.id))return;
   if(b.id!="pureblack"||b.mask!="mask_3.png"||b.channel!=2||!b.opaque||meta.terrain?.size==null||meta.terrain.size.Length!=3||!(meta.terrain.size[0]>0)||!(meta.terrain.size[2]>0))throw new InvalidDataException("Unsupported pure black floor contract");
   var mask=SharedImportCache.Image(File.ReadAllBytes(Path.Combine(exportDirectory,b.mask)),".png",false,false,TextureWrapMode.Clamp,FilterMode.Bilinear,1,4096);
   material.SetTexture("_PureBlackMask",mask);material.SetVector("_PureBlackMapSize",new Vector4(meta.terrain.size[0],meta.terrain.size[2],0,0));material.SetFloat("_PureBlackEnabled",1);
  }
  public static Result Build(string jsonFile,Vector2 editorZero,string exportDirectory=null) {
  string json=SharedAssetFiles.ReadText(jsonFile);var d=JsonUtility.FromJson<GroundDto>(json);var waves=JsonUtility.FromJson<WavesDto>(json);
  if(d==null||d.schemaVersion!=1||(d.materialVersion!=2&&d.materialVersion!=3)||d.width!=512||d.height!=512||d.mime!="image/jpeg"||d.encodedColorSpace!="sRGB"||d.tileMetres!=4||d.decodeExponent!=2.2f||!d.mipmaps||d.anisotropy!=2||d.rotationCS==null||d.rotationCS.Length!=2||d.secondOffset==null||d.secondOffset.Length!=2||waves.waveA==null||waves.waveA.Length!=3||waves.waveB==null||waves.waveB.Length!=3)throw new InvalidDataException("Unsupported shared grass contract");
  if(d.materialVersion==2)d.dirt=null; // JsonUtility may instantiate an empty nested DTO for an absent object.
  if(d.materialVersion==3&&(d.dirt==null||d.dirt.width!=256||d.dirt.height!=256||d.dirt.tileMetres!=2||d.dirt.mime!="image/jpeg"||d.dirt.encodedColorSpace!="sRGB"||!d.dirt.mipmaps||d.dirt.anisotropy!=2||d.dirt.rotationCS==null||d.dirt.rotationCS.Length!=2||d.dirt.secondOffset==null||d.dirt.secondOffset.Length!=2))throw new InvalidDataException("Unsupported shared soil contract");
  var shader=Shader.Find("MapSharedGround/Grass");if(shader==null||!shader.isSupported)throw new InvalidDataException("Shared grass shader unavailable");
  const string root="Assets/MapSharedGroundGenerated";if(!AssetDatabase.IsValidFolder(root))AssetDatabase.CreateFolder("Assets","MapSharedGroundGenerated");string folder=AssetDatabase.GenerateUniqueAssetPath(root+"/Trial");AssetDatabase.CreateFolder(root,Path.GetFileName(folder));
  try {
   var tx=SharedImportCache.Image(Convert.FromBase64String(d.imageBase64),".jpg",false,true,TextureWrapMode.Repeat,FilterMode.Trilinear,2,512);var m=new Material(shader);m.SetTexture("_GroundMap",tx);m.SetVector("_GroundParams",new Vector4(d.tileMetres,d.secondWeight,d.rotationCS[0],d.rotationCS[1]));m.SetVector("_GroundOffset",new Vector4(d.secondOffset[0],d.secondOffset[1],0,0));m.SetVector("_EditorZero",new Vector4(editorZero.x,editorZero.y,0,0));m.SetVector("_WaveA",new Vector4(waves.waveA[0],waves.waveA[1],waves.waveA[2],0));m.SetVector("_WaveB",new Vector4(waves.waveB[0],waves.waveB[1],waves.waveB[2],0));m.SetFloat("_Decode",d.decodeExponent);if(d.dirt!=null){m.SetTexture("_DirtMap",SharedImportCache.Image(Convert.FromBase64String(d.dirt.imageBase64),".jpg",false,true,TextureWrapMode.Repeat,FilterMode.Trilinear,2,256));m.SetVector("_DirtParams",new Vector4(d.dirt.tileMetres,d.dirt.secondWeight,d.dirt.rotationCS[0],d.dirt.rotationCS[1]));m.SetVector("_DirtOffset",new Vector4(d.dirt.secondOffset[0],d.dirt.secondOffset[1],0,0));}ApplyPureBlackFloor(m,exportDirectory??Path.GetDirectoryName(jsonFile));AssetDatabase.CreateAsset(m,folder+"/grass.mat");AssetDatabase.SaveAssets();return new Result{material=m,texture=tx,folder=folder,data=d};
  }catch {AssetDatabase.DeleteAsset(folder);throw;}
 }
}
}
