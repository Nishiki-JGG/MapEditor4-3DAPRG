using System;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace MapSharedProps.EditorTools
{
    // Only immutable mesh and image assets. Per-room paint maps/materials stay in the room.
    public static class SharedImportCache
    {
        public const string Root = "Assets/MapSharedAssetCache";
        static string PathFor(string key, string extension)
        {
            if (!AssetDatabase.IsValidFolder(Root)) AssetDatabase.CreateFolder("Assets", "MapSharedAssetCache");
            return Root + "/" + SharedAssetFiles.Hash(Encoding.UTF8.GetBytes("shared-import/1\n" + key)) + extension;
        }
        // The key and path are identical to StoreMesh: existing GUIDs remain valid.
        public static Mesh GetOrCreateMesh(string key, Func<Mesh> create)
        {
            if (create == null) throw new ArgumentNullException(nameof(create));
            string path = PathFor("mesh\n" + key, ".asset");
            var saved = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if (saved) return saved;
            if (File.Exists(path) || File.Exists(path + ".meta"))
                throw new IOException("共通Meshの保存先が不正です: " + path);
            Mesh candidate = create();
            if (!candidate) throw new InvalidOperationException("共通Meshを生成できませんでした");
            if (AssetDatabase.Contains(candidate))
                throw new InvalidOperationException("既存の資産を共通Meshの新規候補にできません");
            try { AssetDatabase.CreateAsset(candidate, path); return candidate; }
            catch { UnityEngine.Object.DestroyImmediate(candidate); throw; }
        }
        public static Mesh StoreMesh(Mesh candidate, string key)
        {
            string path = PathFor("mesh\n" + key, ".asset");
            var saved = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if (saved) { UnityEngine.Object.DestroyImmediate(candidate); return saved; }
            if (File.Exists(path) || File.Exists(path + ".meta")) throw new IOException("共通Meshの保存先が不正です: " + path);
            AssetDatabase.CreateAsset(candidate, path); return candidate;
        }
        public static Texture2D Image(byte[] bytes, string extension, bool srgb, bool mipmaps,
            TextureWrapMode wrap, FilterMode filter, int anisotropy, int maxSize)
        {
            if (extension != ".png" && extension != ".jpg") throw new ArgumentException("画像形式が不正です");
            string key = SharedAssetFiles.Hash(bytes) + "/" + srgb + "/" + mipmaps + "/" + wrap + "/" + filter + "/" + anisotropy + "/" + maxSize;
            string path = PathFor(key, extension);
            var saved = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (saved) return saved;
            if (File.Exists(path) || File.Exists(path + ".meta")) throw new IOException("共通Textureの保存先が不正です: " + path);
            try
            {
                File.WriteAllBytes(path, bytes); AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
                var imp = (TextureImporter)AssetImporter.GetAtPath(path);
                imp.sRGBTexture = srgb; imp.alphaSource = TextureImporterAlphaSource.FromInput; imp.alphaIsTransparency = false;
                imp.textureCompression = TextureImporterCompression.Uncompressed; imp.mipmapEnabled = mipmaps;
                imp.npotScale = TextureImporterNPOTScale.None; imp.wrapMode = wrap; imp.filterMode = filter;
                imp.anisoLevel = anisotropy; imp.maxTextureSize = maxSize; imp.SaveAndReimport();
                saved = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if (!saved) throw new IOException("共通Textureを取り込めませんでした");
                return saved;
            }
            catch { AssetDatabase.DeleteAsset(path); throw; }
        }
    }
}
