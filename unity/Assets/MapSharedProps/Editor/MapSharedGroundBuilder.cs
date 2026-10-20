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
 public static Result Build(string jsonFile,Vector2 editorZero) {
  string json=File.ReadAllText(jsonFile);var d=JsonUtility.FromJson<GroundDto>(json);var waves=JsonUtility.FromJson<WavesDto>(json);
  if(d==null||d.schemaVersion!=1||(d.materialVersion!=2&&d.materialVersion!=3)||d.width!=512||d.height!=512||d.mime!="image/jpeg"||d.encodedColorSpace!="sRGB"||d.tileMetres!=4||d.decodeExponent!=2.2f||!d.mipmaps||d.anisotropy!=2||d.rotationCS==null||d.rotationCS.Length!=2||d.secondOffset==null||d.secondOffset.Length!=2||waves.waveA==null||waves.waveA.Length!=3||waves.waveB==null||waves.waveB.Length!=3)throw new InvalidDataException("Unsupported shared grass contract");
  if(d.materialVersion==2)d.dirt=null; // JsonUtility may instantiate an empty nested DTO for an absent object.
  if(d.materialVersion==3&&(d.dirt==null||d.dirt.width!=256||d.dirt.height!=256||d.dirt.tileMetres!=2||d.dirt.mime!="image/jpeg"||d.dirt.encodedColorSpace!="sRGB"||!d.dirt.mipmaps||d.dirt.anisotropy!=2||d.dirt.rotationCS==null||d.dirt.rotationCS.Length!=2||d.dirt.secondOffset==null||d.dirt.secondOffset.Length!=2))throw new InvalidDataException("Unsupported shared soil contract");
  var shader=Shader.Find("MapSharedGround/Grass");if(shader==null||!shader.isSupported)throw new InvalidDataException("Shared grass shader unavailable");
  const string root="Assets/MapSharedGroundGenerated";if(!AssetDatabase.IsValidFolder(root))AssetDatabase.CreateFolder("Assets","MapSharedGroundGenerated");string folder=AssetDatabase.GenerateUniqueAssetPath(root+"/Trial");AssetDatabase.CreateFolder(root,Path.GetFileName(folder));
  try {
   string texPath=folder+"/grass.jpg";File.WriteAllBytes(texPath,Convert.FromBase64String(d.imageBase64));AssetDatabase.ImportAsset(texPath,ImportAssetOptions.ForceSynchronousImport);
   var imp=(TextureImporter)AssetImporter.GetAtPath(texPath);imp.sRGBTexture=false;imp.mipmapEnabled=true;imp.textureCompression=TextureImporterCompression.Uncompressed;imp.wrapMode=TextureWrapMode.Repeat;imp.filterMode=FilterMode.Trilinear;imp.anisoLevel=2;imp.npotScale=TextureImporterNPOTScale.None;imp.maxTextureSize=512;imp.SaveAndReimport();
   var tx=AssetDatabase.LoadAssetAtPath<Texture2D>(texPath);var m=new Material(shader);m.SetTexture("_GroundMap",tx);m.SetVector("_GroundParams",new Vector4(d.tileMetres,d.secondWeight,d.rotationCS[0],d.rotationCS[1]));m.SetVector("_GroundOffset",new Vector4(d.secondOffset[0],d.secondOffset[1],0,0));m.SetVector("_EditorZero",new Vector4(editorZero.x,editorZero.y,0,0));m.SetVector("_WaveA",new Vector4(waves.waveA[0],waves.waveA[1],waves.waveA[2],0));m.SetVector("_WaveB",new Vector4(waves.waveB[0],waves.waveB[1],waves.waveB[2],0));m.SetFloat("_Decode",d.decodeExponent);if(d.dirt!=null){string soilPath=folder+"/soil.jpg";File.WriteAllBytes(soilPath,Convert.FromBase64String(d.dirt.imageBase64));AssetDatabase.ImportAsset(soilPath,ImportAssetOptions.ForceSynchronousImport);
   var soilImp=(TextureImporter)AssetImporter.GetAtPath(soilPath);soilImp.sRGBTexture=false;soilImp.mipmapEnabled=true;soilImp.textureCompression=TextureImporterCompression.Uncompressed;soilImp.wrapMode=TextureWrapMode.Repeat;soilImp.filterMode=FilterMode.Trilinear;soilImp.anisoLevel=2;soilImp.npotScale=TextureImporterNPOTScale.None;soilImp.maxTextureSize=256;soilImp.SaveAndReimport();
   m.SetTexture("_DirtMap",AssetDatabase.LoadAssetAtPath<Texture2D>(soilPath));m.SetVector("_DirtParams",new Vector4(d.dirt.tileMetres,d.dirt.secondWeight,d.dirt.rotationCS[0],d.dirt.rotationCS[1]));m.SetVector("_DirtOffset",new Vector4(d.dirt.secondOffset[0],d.dirt.secondOffset[1],0,0));}AssetDatabase.CreateAsset(m,folder+"/grass.mat");AssetDatabase.SaveAssets();return new Result{material=m,texture=tx,folder=folder,data=d};
  }catch {AssetDatabase.DeleteAsset(folder);throw;}
 }
}
}
