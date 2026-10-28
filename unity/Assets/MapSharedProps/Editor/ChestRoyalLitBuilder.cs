using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace MapSharedProps.EditorTools
{
    // Converts the optional baked royal surface to stock URP/Lit at import time.
    // No scene lighting changes, runtime texture creation, or per-instance materials.
    public sealed class ChestRoyalLitBuilder
    {
        readonly Material plain, relief;
        readonly string surfaceKey;
        public static readonly Color Gold = new Color(245f / 255, 215f / 255, 121f / 255, 1).linear;

        public ChestRoyalLitBuilder(ChestSurfaceBuilder.RoyalRelief source, string folder)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (!shader || !shader.isSupported) throw new InvalidDataException("Royal gold requires URP/Lit.");
            surfaceKey = "royal-lit-v1/" + SharedAssetFiles.Hash(Encoding.UTF8.GetBytes(JsonUtility.ToJson(source)));
            var normal = Normal(Convert.FromBase64String(source.normal.png));
            var packed = Packed(Convert.FromBase64String(source.ao.png));
            plain = Material(shader, folder + "/royal-standard-gold.mat", false, normal, packed);
            relief = Material(shader, folder + "/royal-standard-relief.mat", true, normal, packed);
        }

        static Material Material(Shader shader, string path, bool mapped, Texture2D normal, Texture2D packed)
        {
            var m = new Material(shader) { name = mapped ? "Royal baked relief - URP Lit" : "Royal gold - URP Lit", enableInstancing = true };
            m.SetFloat("_WorkflowMode", 1);
            m.SetColor("_BaseColor", Gold);
            m.SetColor("_EmissionColor", Color.black);
            m.SetFloat("_Metallic", .8f);
            m.SetFloat("_Smoothness", mapped ? 1 : .8f);
            if (mapped)
            {
                m.SetTexture("_BumpMap", normal); m.SetFloat("_BumpScale", 1); m.EnableKeyword("_NORMALMAP");
                // Standard Lit reads metallic R, occlusion G, smoothness A. Data is linear.
                m.SetTexture("_MetallicGlossMap", packed); m.EnableKeyword("_METALLICSPECGLOSSMAP");
                m.SetTexture("_OcclusionMap", packed); m.SetFloat("_OcclusionStrength", 1); m.EnableKeyword("_OCCLUSIONMAP");
                m.SetFloat("_SmoothnessTextureChannel", 0);
            }
            // Re-import updates an existing asset in place to preserve its GUID.
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing) { EditorUtility.CopySerialized(m, existing); UnityEngine.Object.DestroyImmediate(m); return existing; }
            if (File.Exists(path) || File.Exists(path + ".meta")) throw new IOException("Occupied royal material path: " + path);
            AssetDatabase.CreateAsset(m, path); return m;
        }

        static Texture2D Packed(byte[] aoBytes)
        {
            var decoded = new Texture2D(2, 2, TextureFormat.RGBA32, false, true);
            try
            {
                if (!ImageConversion.LoadImage(decoded, aoBytes) || decoded.width != 512 || decoded.height != 512)
                    throw new InvalidDataException("Royal AO cannot be decoded.");
                var pixels = decoded.GetPixels32();
                // Keep the approved 0.8/0.8 reference, not the old custom roughness multiplier.
                for (int i = 0; i < pixels.Length; i++) pixels[i] = new Color32(204, pixels[i].r, 0, 204);
                decoded.SetPixels32(pixels); decoded.Apply();
                byte[] bytes = decoded.EncodeToPNG();
                string path = SharedImportCache.Root + "/royal-lit-mask-bc7-" + SharedAssetFiles.Hash(bytes) + ".png";
                var saved = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if (saved) return saved;
                if (File.Exists(path) || File.Exists(path + ".meta")) throw new IOException("Occupied royal mask path: " + path);
                File.WriteAllBytes(path, bytes); AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
                var imp = (TextureImporter)AssetImporter.GetAtPath(path);
                imp.sRGBTexture = false; imp.alphaSource = TextureImporterAlphaSource.FromInput; imp.alphaIsTransparency = false;
                imp.mipmapEnabled = true; imp.wrapMode = TextureWrapMode.Clamp; imp.filterMode = FilterMode.Trilinear;
                imp.anisoLevel = 2; imp.maxTextureSize = 512; imp.textureCompression = TextureImporterCompression.CompressedHQ;
                foreach (string platform in new[] { "Standalone", "Android", "iPhone" })
                {
                    var setting = imp.GetPlatformTextureSettings(platform); setting.name = platform; setting.overridden = true;
                    setting.maxTextureSize = 512; setting.format = platform == "Standalone" ? TextureImporterFormat.BC7 : TextureImporterFormat.ASTC_6x6;
                    imp.SetPlatformTextureSettings(setting);
                }
                imp.SaveAndReimport();
                saved = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if (!saved || saved.width != 512 || saved.height != 512) throw new InvalidDataException("Royal packed map import failed.");
                return saved;
            }
            finally { UnityEngine.Object.DestroyImmediate(decoded); }
        }

        static Texture2D Normal(byte[] bytes)
        {
            if (!AssetDatabase.IsValidFolder(SharedImportCache.Root)) AssetDatabase.CreateFolder("Assets", "MapSharedAssetCache");
            string path = SharedImportCache.Root + "/royal-lit-normal-" + SharedAssetFiles.Hash(bytes) + ".png";
            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (texture) return texture;
            if (File.Exists(path) || File.Exists(path + ".meta")) throw new IOException("Occupied royal normal path: " + path);
            File.WriteAllBytes(path, bytes);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var imp = (TextureImporter)AssetImporter.GetAtPath(path);
            imp.textureType = TextureImporterType.NormalMap; imp.sRGBTexture = false;
            imp.convertToNormalmap = false; imp.flipGreenChannel = false;
            imp.mipmapEnabled = true; imp.wrapMode = TextureWrapMode.Clamp; imp.filterMode = FilterMode.Trilinear;
            imp.anisoLevel = 2; imp.maxTextureSize = 512; imp.textureCompression = TextureImporterCompression.CompressedHQ;
            var pc = imp.GetPlatformTextureSettings("Standalone"); pc.name = "Standalone"; pc.overridden = true;
            pc.maxTextureSize = 512; pc.format = TextureImporterFormat.BC5; imp.SetPlatformTextureSettings(pc);
            imp.SaveAndReimport();
            texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (!texture || texture.width != 512 || texture.height != 512) throw new InvalidDataException("Royal normal import failed.");
            return texture;
        }

        public void Apply(GameObject root)
        {
            foreach (var r in root.GetComponentsInChildren<MeshRenderer>())
            {
                var old = r.sharedMaterial;
                if (!old || old.shader.name != "MapSharedProps/ChestMetal") continue;
                bool ornament = old.IsKeywordEnabled("CHEST_ROYAL_RELIEF");
                var filter = r.GetComponent<MeshFilter>(); var source = filter.sharedMesh;
                var mask = new List<Vector2>(); source.GetUVs(4, mask); var colors = source.colors;
                var ordinary = new List<int>(); var special = new List<int>(); var indices = source.triangles;
                Func<int, bool> classify = i => ornament ? mask.Count == source.vertexCount && mask[i].x > .5f : colors.Length == source.vertexCount && colors[i].r > colors[i].g * 2.5f;
                for (int t = 0; t < indices.Length; t += 3)
                {
                    bool group = classify(indices[t]);
                    if (classify(indices[t + 1]) != group || classify(indices[t + 2]) != group)
                        throw new InvalidDataException("Royal material mask crosses a triangle.");
                    var dst = group ? special : ordinary;
                    dst.Add(indices[t]); dst.Add(indices[t + 1]); dst.Add(indices[t + 2]);
                }
                var mesh = UnityEngine.Object.Instantiate(source);
                mesh.subMeshCount = 2; mesh.SetTriangles(ordinary, 0); mesh.SetTriangles(special, 1);
                string sourceId = AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(source));
                filter.sharedMesh = SharedImportCache.StoreMesh(mesh, surfaceKey + "/" + sourceId + "/" + ornament);
                r.sharedMaterials = new[] { plain, ornament ? relief : old };
                // One anchor across the shell and relief prevents different probe selection at their seam.
                r.probeAnchor = root.transform;
            }
        }
    }
}
