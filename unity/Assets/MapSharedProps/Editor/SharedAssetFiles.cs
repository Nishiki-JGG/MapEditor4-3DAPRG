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
                if (!File.Exists(candidate)) continue;
                Check(new FileInfo(candidate).Length == entry.bytes && Hash(File.ReadAllBytes(candidate)) == entry.sha256, name + " の内容が参照と一致しません");
                return candidate;
            }
            throw new FileNotFoundException("共通資産がありません。receive-room.pyで共通ZIPと一緒に受付してください: " + r.bundleHash + "/" + name);
        }
    }
}
