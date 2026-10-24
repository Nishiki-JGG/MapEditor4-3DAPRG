using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace MapSharedProps.EditorTools
{
    // Shared sources live once in <intake parent>/_shared/<content hash>.
    public static class SharedAssetFiles
    {
        [Serializable] public class Entry { public string name, sha256; public long bytes; }
        [Serializable] public class Reference { public string format, bundleHash; public int schemaVersion; public Entry[] files; }
        static readonly string[] Names = { "pine_wind.json", "shared_ground.json", "shared_props.json", "small_props_library.json" };
        public static string Hash(byte[] bytes)
        { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant(); }
        static void Check(bool ok, string why) { if (!ok) throw new InvalidDataException("共通資産: " + why); }
        static bool Hex(string s) => s != null && s.Length == 64 && s.All(c => c >= '0' && c <= '9' || c >= 'a' && c <= 'f');

        [Serializable] public class Part { public string text, sha256, id; public long bytes; }
        [Serializable] public class Recipe { public string format, name, sha256; public int schemaVersion; public long bytes; public Part[] parts; }
        public static string ReadText(string path)
        {
            if (!path.EndsWith(".recipe.json", StringComparison.Ordinal)) return File.ReadAllText(path);
            Check(new FileInfo(path).Length <= 8L*1024*1024, "素材レシピが大きすぎます");
            var r = JsonUtility.FromJson<Recipe>(File.ReadAllText(path));
            Check(r != null && r.format == "tdj-source-recipe" && r.schemaVersion == 1 && Names.Contains(r.name)
                && Hex(r.sha256) && r.bytes >= 0 && r.bytes <= 128L*1024*1024 && r.parts != null && r.parts.Length <= 8192, "素材レシピ形式");
            string objects = Path.Combine(Directory.GetParent(path).Parent.FullName, "objects");
            using (var output = new MemoryStream())
            {
                foreach (var p in r.parts)
                {
                    Check(p != null, "素材断片なし"); byte[] data;
                    if (string.IsNullOrEmpty(p.sha256)) data = Encoding.UTF8.GetBytes(p.text ?? "");
                    else
                    {
                        Check(Hex(p.sha256) && string.IsNullOrEmpty(p.text) && p.bytes >= 0 && p.bytes <= r.bytes, "素材IDが不正");
                        string file = Path.Combine(objects, p.sha256 + ".json");
                        Check(File.Exists(file) && new FileInfo(file).Length == p.bytes, "素材不足: " + p.id);
                        data = File.ReadAllBytes(file); Check(Hash(data) == p.sha256, "素材の内容が違います: " + p.id);
                    }
                    Check(output.Length + data.Length <= r.bytes, "復元サイズ超過"); output.Write(data, 0, data.Length);
                }
                var all = output.ToArray(); Check(all.Length == r.bytes && Hash(all) == r.sha256, "素材復元の内容が違います");
                return new UTF8Encoding(false, true).GetString(all);
            }
        }

        public static string Resolve(string directory, string name, bool optional = false)
        {
            Check(Names.Contains(name), "未対応の共通ファイル名");
            string local = Path.Combine(directory, name), reference = Path.Combine(directory, "shared_assets.json");
            if (!File.Exists(reference))
            {
                if (optional && !File.Exists(local)) return null;
                Check(File.Exists(local), name + " がありません"); return local;
            }
            Check(new FileInfo(reference).Length <= 65536, "参照が大きすぎます");
            var r = JsonUtility.FromJson<Reference>(File.ReadAllText(reference));
            Check(r != null && r.format == "tdj-shared-assets" && r.schemaVersion == 1 && Hex(r.bundleHash)
                && r.files != null && r.files.Length > 0 && r.files.Length <= Names.Length, "参照形式が不正です");
            var ordered = r.files.Select(e => e.name).ToArray();
            Check(ordered.Distinct().Count() == ordered.Length && ordered.SequenceEqual(ordered.OrderBy(n => n, StringComparer.Ordinal))
                && r.files.All(e => Names.Contains(e.name) && Hex(e.sha256) && e.bytes >= 0 && e.bytes <= 128L*1024*1024), "ファイル一覧が不正です");
            string text = "tdj-shared-assets/1\n" + string.Join("\n", r.files.Select(e => e.name + " " + e.sha256));
            Check(Hash(Encoding.UTF8.GetBytes(text)) == r.bundleHash, "参照IDが一致しません");
            var entry = r.files.SingleOrDefault(e => e.name == name);
            if (optional && entry == null) return null;
            Check(entry != null && !File.Exists(local), "共通参照が無いか、ローカルの同名ファイルと競合しています");
            var parent = Directory.GetParent(Path.GetFullPath(directory));
            foreach (var root in new[] { parent?.FullName, parent?.Parent?.FullName })
            {
                if (root == null) continue;
                string candidate = Path.Combine(root, "_shared", r.bundleHash, name);
                string recipe = candidate + ".recipe.json";
                Check(!(File.Exists(candidate) && File.Exists(recipe)), "旧素材とレシピが競合しています");
                if (File.Exists(recipe))
                {
                    var raw = Encoding.UTF8.GetBytes(ReadText(recipe));
                    Check(raw.LongLength == entry.bytes && Hash(raw) == entry.sha256, name + " の素材版が違います");
                    return recipe;
                }
                if (!File.Exists(candidate)) continue;
                Check(new FileInfo(candidate).Length == entry.bytes && Hash(File.ReadAllBytes(candidate)) == entry.sha256, name + " の内容が参照と一致しません");
                return candidate;
            }
            throw new FileNotFoundException("共通資産がありません。receive-room.pyで共通ZIPと一緒に受付してください: " + r.bundleHash + "/" + name);
        }
    }
}
