using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace MapSharedProps.EditorTools
{
    // Webの代替メッシュを新Prefabにせず、元の完成済みPrefabをそのまま配置する。
    public static class RoomTorchBuilder
    {
        public const string PrefabGuid = "076bf4c551dc4254e85f0316aba457c6";
        public const string VfxId = "vfx.environment.torch.fire";
        [Serializable] public sealed class Instance { public string instanceId, seedKey; public float[] position, scale; public float yaw; }
        [Serializable] public sealed class Data { public string format, assetKey, vfxId, resourcePath, prefabGuid, roomId, sourcePrefabSha256; public int version, seed; public Instance[] instances; }
        private static void Require(bool value, string message) { if (!value) throw new InvalidDataException("壁掛け松明: " + message); }
        private static bool Finite(float value) => !float.IsNaN(value) && !float.IsInfinity(value);
        private static void Vector(float[] value, bool positive)
        {
            Require(value != null && value.Length == 3, "座標または倍率が3要素ではありません");
            foreach (float item in value) Require(Finite(item) && (!positive || item > 0f), "座標または倍率が不正です");
        }

        public static RoomTorchBudget Build(string directory, Transform parent)
        {
            string file = Path.Combine(directory, "room_torches.json"); if (!File.Exists(file)) return null;
            var data = JsonUtility.FromJson<Data>(File.ReadAllText(file));
            Require(data != null && data.format == "tdj-room-torches" && data.version == 1, "形式または版が違います");
            Require(data.assetKey == "tdj/wall_torch" && data.vfxId == VfxId && data.prefabGuid == PrefabGuid && data.resourcePath == "DiscoveryPresentation/RoomTorch", "原本の対応が違います");
            Require(!string.IsNullOrWhiteSpace(data.roomId) && data.instances != null && data.instances.Length > 0, "部屋IDまたは配置がありません");
            string prefabPath = AssetDatabase.GUIDToAssetPath(PrefabGuid);
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
            Require(prefab != null, "元ゲームのRoomTorch.prefabがありません。元Prefab・依存資産・元スクリプトを先に読み込んでください");
            // 誤った元Prefabを黙って採用しない。原本更新時にはWeb抽出と契約を更新する。
            using (var sha = System.Security.Cryptography.SHA256.Create())
            {
                string hash = BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(prefabPath))).Replace("-", "").ToLowerInvariant();
                Require(hash == data.sourcePrefabSha256, "元Prefabの版がWeb抽出時と違います");
            }
            var ids = new HashSet<string>();
            var csv = new Dictionary<string, string[]>();
            foreach (string line in File.ReadAllLines(Path.Combine(directory, "props.csv")))
            {
                string[] row = line.Split(','); if (row.Length == 11 && row[1] == "wall_torch") { Require(!csv.ContainsKey(row[0]), "CSVの個体IDが重複しています"); csv.Add(row[0], row); }
            }
            Require(csv.Count == data.instances.Length, "CSVとVFXの配置数が違います");
            foreach (var item in data.instances)
            {
                Require(item != null && !string.IsNullOrWhiteSpace(item.instanceId) && ids.Add(item.instanceId), "個体IDが欠落または重複しています");
                Require(item.seedKey == data.roomId + "#" + item.instanceId && Finite(item.yaw), "乱数キーまたは角度が不正です");
                Vector(item.position, false); Vector(item.scale, true);
                Require(csv.TryGetValue(item.instanceId, out var row) && row[2] == data.assetKey, "CSVの資産対応が違います");
                float Number(int index) => float.Parse(row[index], CultureInfo.InvariantCulture);
                for (int i = 0; i < 3; i++) Require(Mathf.Abs(item.position[i] - Number(3 + i)) < .0011f, "CSVとVFXの位置が違います");
                Require(Mathf.Abs(item.scale[0] - Number(7)) < .0011f && Mathf.Abs(item.scale[1] - Number(8)) < .0011f && Mathf.Abs(item.scale[2] - Number(7)) < .0011f, "CSVとVFXの倍率が違います");
            }
            var root = new GameObject("壁掛け松明"); root.transform.SetParent(parent, false);
            try
            {
                var fixtures = new List<RoomTorchInstance>();
                foreach (var item in data.instances)
                {
                    var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab, root.transform); go.name = item.instanceId;
                    go.transform.localPosition = new Vector3(item.position[0], item.position[1], item.position[2]);
                    go.transform.localRotation = Quaternion.Euler(0f, item.yaw, 0f); go.transform.localScale = new Vector3(item.scale[0], item.scale[1], item.scale[2]);
                    MonoBehaviour original = null;
                    foreach (var component in go.GetComponents<MonoBehaviour>()) if (component != null && component.GetType().FullName == "TotsuDan.Prototype.Discovery.DiscoveryRoomTorchPresentation") original = component;
                    Require(original != null, "元の松明コンポーネントがありません");
                    var instance = go.AddComponent<RoomTorchInstance>(); instance.Configure(original, data.seed, item.seedKey);
                    // 原本は非アクティブのテンプレート。ゲーム本体の配置経路と同じく、初期化してから有効化。
                    go.SetActive(true); fixtures.Add(instance);
                }
                var budget = root.AddComponent<RoomTorchBudget>(); budget.Configure(fixtures.ToArray()); return budget;
            }
            catch { UnityEngine.Object.DestroyImmediate(root); throw; }
        }

        [MenuItem("Tools/Map Shared Props/壁掛け松明を取り込む")]
        private static void Import()
        {
            string folder = EditorUtility.OpenFolderPanel("Unity用に書き出したマップを選択", "", ""); if (string.IsNullOrEmpty(folder)) return;
            try { var result = Build(folder, null); if (result == null) throw new InvalidDataException("壁掛け松明の配置がありません"); Undo.RegisterCreatedObjectUndo(result.gameObject, "壁掛け松明の取り込み"); Selection.activeGameObject = result.gameObject; }
            catch (Exception error) { Debug.LogException(error); }
        }
    }
}
