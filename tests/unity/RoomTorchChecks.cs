// 隔離プロジェクト専用。元ゲーム・元Prefabは変更しない。
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using MapSharedProps;
using MapSharedProps.EditorTools;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using Debug = UnityEngine.Debug;

[InitializeOnLoad]
public static class RoomTorchChecks
{
    const string StageKey = "RoomTorchChecks.Stage";
    [Serializable] public class Row { public int count, activeLights, shadowedLights, activeEmitters, particles, drawCalls; public double cpuMedianMs, cpuP95Ms, frameMedianMs, frameP95Ms; public bool initialized, serializedRoundtrip; }
    [Serializable] public class Report { public bool pass; public string unity, gpu, graphicsApi, error; public int unexpectedErrors; public List<string> checks = new List<string>(), logs = new List<string>(), baselineLogs = new List<string>(); public List<Row> performance = new List<Row>(); }
    static Report report;
    static int phase, frame;
    static bool running;
    static readonly int[] Counts = { 1, 10, 50 };
    static List<double> intervals = new List<double>(), cpu = new List<double>();
    static double previous, warmupUntil;
    static Camera camera;
    static GameObject original;
    static RoomTorchBudget current;
    static string Output => Environment.GetEnvironmentVariable("TORCH_EVIDENCE");
    static string Input => Path.Combine(Output, "unity-input");

    static RoomTorchChecks()
    {
        EditorApplication.playModeStateChanged += state =>
        {
            if (state == PlayModeStateChange.EnteredPlayMode && SessionState.GetInt(StageKey, 0) == 1) Begin();
            if (state == PlayModeStateChange.EnteredEditMode && SessionState.GetInt(StageKey, 0) == 2) EditorApplication.Exit(SessionState.GetInt("RoomTorchChecks.Exit", 1));
        };
        EditorApplication.delayCall += () => { if (EditorApplication.isPlaying && SessionState.GetInt(StageKey, 0) == 1) Begin(); };
    }

    static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    static MonoBehaviour Presentation(GameObject go) => go.GetComponents<MonoBehaviour>().First(c => c != null && c.GetType().Name == "DiscoveryRoomTorchPresentation");
    static void Save() => File.WriteAllText(Path.Combine(Output, "unity.json"), JsonUtility.ToJson(report, true));
    static void Log(string condition, string trace, LogType type)
    {
        if (type != LogType.Error && type != LogType.Exception && type != LogType.Assert) return;
        report.logs.Add(type + ": " + condition);
        // 前回ログ833行のEditor検索DB例外は機能と独立。記録を残し、追加の例外と区別する。
        if (condition.Contains("ArgumentOutOfRangeException") && trace.Contains("UnityEditor.Search.SearchDatabase") && !trace.Contains("RoomTorch") && !trace.Contains("MapSharedProps")) report.baselineLogs.Add(condition + "\n" + trace);
        else report.unexpectedErrors++;
        Save();
    }

    public static void Run()
    {
        try
        {
            Require(!string.IsNullOrEmpty(Output), "TORCH_EVIDENCEが必要です"); Directory.CreateDirectory(Output);
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            QualitySettings.vSyncCount = 0; Application.targetFrameRate = -1;
            QualitySettings.activeColorSpace.ToString();
            RenderSettings.ambientMode = AmbientMode.Flat; RenderSettings.ambientLight = new Color(.08f, .08f, .08f);
            var surface = new Material(Shader.Find("Universal Render Pipeline/Lit")); surface.color = new Color(.17f, .18f, .2f); surface.SetFloat("_Smoothness", .1f);
            void Box(string name, Vector3 p, Vector3 scale) { var go = GameObject.CreatePrimitive(PrimitiveType.Cube); go.name = name; go.transform.position = p; go.transform.localScale = scale; go.GetComponent<Renderer>().sharedMaterial = surface; }
            Box("確認用の床", new Vector3(0, -.1f, 0), new Vector3(40, .2f, 40));
            Box("確認用の壁", new Vector3(0, 1.15f, .14f), new Vector3(2, 2.3f, .12f));
            var sun = new GameObject("確認用の補助光").AddComponent<Light>(); sun.type = LightType.Directional; sun.intensity = .3f; sun.transform.rotation = Quaternion.Euler(50, -30, 0); sun.shadows = LightShadows.None;
            var camera = new GameObject("Validation camera").AddComponent<Camera>(); camera.tag = "MainCamera"; camera.fieldOfView = 38; camera.nearClipPlane = .1f; camera.farClipPlane = 200; camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = new Color(.025f, .028f, .035f);
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(AssetDatabase.GUIDToAssetPath(RoomTorchBuilder.PrefabGuid)); Require(prefab != null, "元Prefabを解決できません");
            var reference = (GameObject)PrefabUtility.InstantiatePrefab(prefab); reference.name = "Original reference"; reference.transform.position = Vector3.up * 1.45f; reference.SetActive(false);
            var parent = new GameObject("Imported parent"); parent.transform.position = new Vector3(-12, 0, -12);
            var imported = RoomTorchBuilder.Build(Input, parent.transform); Require(imported != null && imported.Fixtures.Length == 1, "Web書出しの取り込み失敗");
            Directory.CreateDirectory("Assets/Generated");
            PrefabUtility.SaveAsPrefabAsset(imported.gameObject, "Assets/Generated/ImportedRoom.prefab");
            UnityEngine.Object.DestroyImmediate(imported.gameObject);
            var reloaded = (GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Generated/ImportedRoom.prefab"), parent.transform); reloaded.name = "Reloaded room";
            var adapter = reloaded.GetComponentInChildren<RoomTorchInstance>(); Require(adapter != null && adapter.SeedKey == JsonUtility.FromJson<RoomTorchBuilder.Data>(File.ReadAllText(Path.Combine(Input, "room_torches.json"))).instances[0].seedKey, "初期化キーの保存失敗");
            EditorSceneManager.SaveScene(scene, "Assets/Validation.unity");
            SessionState.SetInt(StageKey, 1); EditorApplication.isPlaying = true;
        }
        catch (Exception error) { Debug.LogException(error); EditorApplication.Exit(1); }
    }

    static void Begin()
    {
        if (running) return; running = true;
        report = new Report { unity = Application.unityVersion, gpu = SystemInfo.graphicsDeviceName, graphicsApi = SystemInfo.graphicsDeviceType.ToString() };
        Application.logMessageReceived += Log;
        try
        {
            camera = GameObject.Find("Validation camera").GetComponent<Camera>();
            original = SceneManager.GetActiveScene().GetRootGameObjects().First(o => o.name == "Original reference");
            current = UnityEngine.Object.FindFirstObjectByType<RoomTorchBudget>(); Require(current != null, "再読込した部屋がありません"); current.SetFocus(camera.transform);
            var adapter = current.Fixtures[0]; var presentation = Presentation(adapter.gameObject);
            Require((bool)presentation.GetType().GetProperty("Initialized").GetValue(presentation), "PlayModeで初期化されませんでした");
            Require(adapter.SourceLight != null && adapter.Particles.Length == 2 && adapter.GetComponentsInChildren<Renderer>().All(r => r.sharedMaterial != null && r.sharedMaterial.shader.isSupported), "原本VFX参照が不足しています");
            Require(adapter.GetComponentsInChildren<MeshFilter>().Select(m => m.sharedMesh.vertexCount).OrderBy(n => n).SequenceEqual(new[] { 24, 96 }), "原本モデルが変わっています");
            Require(adapter.GetComponentsInChildren<Collider>().Length == 0, "不要なColliderが付いています");
            var source = Presentation(original); source.GetType().GetMethod("Initialize").Invoke(source, new object[] { adapter.Seed, adapter.SeedKey }); original.SetActive(true);
            Require((float)source.GetType().GetProperty("Phase01").GetValue(source) == (float)presentation.GetType().GetProperty("Phase01").GetValue(presentation), "元Prefabと復元Prefabの位相が違います"); original.SetActive(false);
            adapter.SetParticleVisibility(.2f); adapter.gameObject.SetActive(false); adapter.gameObject.SetActive(true);
            Require(Mathf.Abs(adapter.Particles.First(p => p.name == "Smoke").emission.rateOverTimeMultiplier - 3f) < .0001f, "再有効化で煙の発生数が減りました");
            report.checks.Add("Web書出し→元GUIDのPrefab配置→部屋Prefab保存/再読込→PlayModeの初期化/粒子2種/モデル/参照/Collider確認");
            report.checks.Add("距離で粒子を減らした後の再有効化で煙の発生数が復元");
            report.checks.Add("同じseed/keyで原本と復元Prefabの位相一致");
            current.SetFocus(camera.transform); SetCamera(false, false); phase = frame = 0; previous = EditorApplication.timeSinceStartup; warmupUntil = previous + 2;
            EditorApplication.update += Step;
        }
        catch (Exception error) { Finish(error); }
    }

    static void SetCamera(bool overhead, bool multiple)
    {
        Vector3 target = multiple ? new Vector3(0, 1.2f, -2) : new Vector3(0, 1.5f, 0);
        float yaw = .6f, pitch = overhead ? 1.25f : .35f, distance = multiple ? 16 : overhead ? 5 : 2.4f;
        camera.transform.position = target + new Vector3(Mathf.Sin(yaw) * Mathf.Cos(pitch), Mathf.Sin(pitch), -Mathf.Cos(yaw) * Mathf.Cos(pitch)) * distance;
        camera.transform.LookAt(target); camera.aspect = 1280f / 720;
    }

    static void Capture(string name)
    {
        var target = new RenderTexture(1280, 720, 24, RenderTextureFormat.ARGB32); target.Create();
        var request = new RenderPipeline.StandardRequest { destination = target };
        RenderPipeline.SubmitRenderRequest(camera, request);
        var old = RenderTexture.active; RenderTexture.active = target;
        var image = new Texture2D(1280, 720, TextureFormat.RGB24, false); image.ReadPixels(new Rect(0, 0, 1280, 720), 0, 0); image.Apply();
        File.WriteAllBytes(Path.Combine(Output, name + ".png"), image.EncodeToPNG()); RenderTexture.active = old;
        UnityEngine.Object.DestroyImmediate(image); target.Release(); UnityEngine.Object.DestroyImmediate(target);
    }

    static void LoadCount(int count)
    {
        var template = JsonUtility.FromJson<RoomTorchBuilder.Data>(File.ReadAllText(Path.Combine(Input, "room_torches.json")));
        var sample = template.instances[0]; template.instances = new RoomTorchBuilder.Instance[count];
        string folder = Path.Combine(Output, "unity-" + count); Directory.CreateDirectory(folder);
        var rows = new List<string> { "instanceId,type,assetKey,x,y,z,rotY_deg,scale,scaleY,auto,cliffStyle" };
        for (int i = 0; i < count; i++)
        {
            string id = "unity-" + i; var position = new[] { 12 + (i % 10 - 4.5f) * 1.4f, 1.45f, 12 + (i / 10) * 1.6f };
            template.instances[i] = new RoomTorchBuilder.Instance { instanceId = id, seedKey = template.roomId + "#" + id, position = position, yaw = 0, scale = new[] { 1f, 1f, 1f } };
            rows.Add(string.Join(",", new[] { id, "wall_torch", template.assetKey, position[0].ToString(System.Globalization.CultureInfo.InvariantCulture), "1.45", position[2].ToString(System.Globalization.CultureInfo.InvariantCulture), "0", "1", "1", "0", "" }));
        }
        File.WriteAllText(Path.Combine(folder, "room_torches.json"), JsonUtility.ToJson(template)); File.WriteAllLines(Path.Combine(folder, "props.csv"), rows);
        UnityEngine.Object.DestroyImmediate(current.gameObject); current = RoomTorchBuilder.Build(folder, GameObject.Find("Imported parent").transform); current.SetFocus(camera.transform);
        SetCamera(false, true);
    }

    static double Percentile(List<double> list, double percentile) { var a = list.OrderBy(x => x).ToArray(); return a.Length == 0 ? 0 : a[Math.Min(a.Length - 1, (int)(a.Length * percentile))]; }
    static void Step()
    {
        try
        {
            double now = EditorApplication.timeSinceStartup;
            // バッチの45フレームは煙の寿命より短いため、実時間で定常状態を待つ。
            if (now < warmupUntil) { previous = now; return; }
            if (frame > 0) intervals.Add((now - previous) * 1000); previous = now; frame++;
            var watch = Stopwatch.StartNew();
            CaptureFrame(); cpu.Add(watch.Elapsed.TotalMilliseconds);
            if (frame < 120) return;
            var fixtures = current.Fixtures;
            Require(current.ActiveLights <= 6, "6灯の上限を超えました");
            int shadowed = fixtures.Count(f => f.SourceLight.enabled && f.SourceLight.shadows != LightShadows.None); Require(shadowed <= 2, "影付き2灯の上限を超えました");
            report.performance.Add(new Row { count = Counts[phase], activeLights = current.ActiveLights, shadowedLights = shadowed, activeEmitters = current.ActiveEmitters,
                particles = fixtures.Sum(f => f.Particles.Sum(p => p.particleCount)), drawCalls = UnityStats.drawCalls, initialized = true, serializedRoundtrip = phase == 0,
                cpuMedianMs = Percentile(cpu, .5), cpuP95Ms = Percentile(cpu, .95), frameMedianMs = Percentile(intervals, .5), frameP95Ms = Percentile(intervals, .95) });
            if (phase == 0)
            {
                SetCamera(false, false); Capture("unity-imported-close"); SetCamera(true, false); Capture("unity-imported-overhead");
                current.gameObject.SetActive(false); original.SetActive(true);
                foreach (var particle in original.GetComponentsInChildren<ParticleSystem>()) particle.Simulate(2f, false, true, true);
                SetCamera(false, false); Capture("unity-original-close"); SetCamera(true, false); Capture("unity-original-overhead"); original.SetActive(false); current.gameObject.SetActive(true);
                report.checks.Add("近距離/見下ろしの元Prefabと復元PrefabをURPで描画");
            }
            if (phase == 2)
            {
                Capture("unity-50");
                camera.transform.position = new Vector3(100, 2, 100);
                for (int i = 0; i < 300; i++) current.Tick(1f / 60, camera.transform.position);
                Require(current.ActiveEmitters == 0 && current.ActiveLights == 0, "遠距離の停止が働きません");
                report.checks.Add("1/10/50本のPlayMode実行・6灯/影2灯上限・遠距離粒子停止");
                Finish(null); return;
            }
            phase++; LoadCount(Counts[phase]); frame = 0; warmupUntil = now + 2; cpu.Clear(); intervals.Clear(); Save();
        }
        catch (Exception error) { Finish(error); }
    }
    static void CaptureFrame()
    {
        // Camera.RenderRequestを実行し、描画のCPU送信時間を測る。GPU時間やPlayer FPSとは区別する。
        if (camera.targetTexture == null) camera.targetTexture = new RenderTexture(1280, 720, 24);
        RenderPipeline.SubmitRenderRequest(camera, new RenderPipeline.StandardRequest { destination = camera.targetTexture });
    }
    static void Finish(Exception error)
    {
        EditorApplication.update -= Step;
        report.error = error?.ToString(); report.pass = error == null && report.unexpectedErrors == 0; Save();
        Debug.Log("ROOM_TORCH_VALIDATION " + (report.pass ? "PASS" : "FAIL") + " " + report.error);
        SessionState.SetInt("RoomTorchChecks.Exit", report.pass ? 0 : 1); SessionState.SetInt(StageKey, 2); EditorApplication.isPlaying = false;
    }
}
