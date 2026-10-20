using System.Collections.Generic;
using UnityEngine;

namespace MapWater {
/// <summary>書き出しの滝1つ分（地図の原点からの座標。Unityの軸）。</summary>
[System.Serializable]
public struct MapWaterFallInfo {
 public string id;
 public Vector3 plunge;      // 着水点（地図の原点からの座標、y=水位）
 public Vector2 upstream;    // 水源の向き（xz、単位ベクトル）
 public float width, height; // 滝の幅、落差(m)
}

/// <summary>
/// 滝ごとの波紋と泡を、128²の窓を1枚のアトラスに並べて計算する（CAV-002 の OpusWaterRippleSim を一般化）。
/// ・時刻は controller から渡し、1/60秒の固定刻みで追いつく。時刻が戻れば0から計算し直す＝同じ時刻は同じ絵。
/// ・時刻が大きく飛んだ時は、最後の「catchUpSeconds」秒だけを計算して追いつく（ゲームで Time.time が大きくても最初のフレームが止まらない）。
/// ・水深は地図全体の符号つき水深(depthTex)から読む。範囲の外・陸では波と泡を止める。
/// </summary>
public sealed class MapWaterRippleSim {
 public const int MaxFalls = 8, TilesPerRow = 4, Tile = 128;
 public float waveSpeed = 1.15f, damping = 0.008f, spongeTexels = 14f, churn = 0.009f, slugStrength = 0.022f, slugInterval = 0.9f;
 public float foamPerStep = 0.018f, foamHalfLife = 2.2f, outflowSpeed = 0.7f,   // 8回目：1.5→2.2秒、0.55→0.7 m/s（泡の尾が池の面に広がるように）
  outflowFalloff = 1.6f, swirl = 0.18f;
 public float windowSize = 16f, windowShiftDownstream = 4f, stepRate = 60f, catchUpSeconds = 8f;
 public int maxStepsPerFrame = 480;

 readonly ComputeShader cs;
 readonly Texture depthTex;
 readonly Vector4 mapRect;               // origin xz, 1/size xz（ワールド）
 readonly List<MapWaterFallInfo> falls;
 readonly Vector3 origin;
 RenderTexture a, b, view;
 ComputeBuffer[] impulseBuffers = new ComputeBuffer[MaxFalls], foamBuffers = new ComputeBuffer[MaxFalls];   // 滝ごとに別（同じ刻みの中で書き換えが混ざらない）
 int kUpdate, kClear, step = -1;
 readonly List<Vector4> impulses = new List<Vector4>(32), foams = new List<Vector4>(16);
 readonly Vector4[] rects = new Vector4[MaxFalls], contacts = new Vector4[MaxFalls];
 readonly Vector2[] winMin = new Vector2[MaxFalls], c0 = new Vector2[MaxFalls], c1 = new Vector2[MaxFalls];
 int atlasW, atlasH;
 public bool Ready => a != null;
 public int StepCount => step;

 static readonly int SrcId = Shader.PropertyToID("_Src"), DstId = Shader.PropertyToID("_Dst"), OutId = Shader.PropertyToID("_Out"),
  DepthId = Shader.PropertyToID("_DepthTex"), MapRectId = Shader.PropertyToID("_MapRect"), WindowId = Shader.PropertyToID("_Window"),
  TileId = Shader.PropertyToID("_TileOrigin"), AtlasSizeId = Shader.PropertyToID("_AtlasSize"), SimId = Shader.PropertyToID("_SimParams"),
  FoamId = Shader.PropertyToID("_FoamParams"), CellId = Shader.PropertyToID("_CellSize"), ContactId = Shader.PropertyToID("_Contact"),
  ImpulsesId = Shader.PropertyToID("_Impulses"), ImpulseCountId = Shader.PropertyToID("_ImpulseCount"), FoamSourcesId = Shader.PropertyToID("_FoamSources"),
  FoamCountId = Shader.PropertyToID("_FoamSourceCount"),
  GTexId = Shader.PropertyToID("_MWRippleTex"), GAtlasId = Shader.PropertyToID("_MWAtlas"), GTilesId = Shader.PropertyToID("_MWAtlasTiles"),
  GRectId = Shader.PropertyToID("_MWFallRect"), GContactId = Shader.PropertyToID("_MWFallContact");

 public MapWaterRippleSim(ComputeShader compute, Texture depth, Vector3 mapOrigin, Vector2 mapSize, List<MapWaterFallInfo> fallList) {
  cs = compute; depthTex = depth; origin = mapOrigin; falls = fallList;
  mapRect = new Vector4(mapOrigin.x, mapOrigin.z, 1f / mapSize.x, 1f / mapSize.y);
 }

 public bool Create() {
  if (cs == null || !SystemInfo.supportsComputeShaders || falls == null || falls.Count == 0) return false;
  int count = Mathf.Min(falls.Count, MaxFalls), rows = (count + TilesPerRow - 1) / TilesPerRow;
  atlasW = TilesPerRow * Tile; atlasH = rows * Tile;
  kUpdate = cs.FindKernel("UpdateRipple"); kClear = cs.FindKernel("ClearRipple");
  a = NewRT("MapWaterRippleA"); b = NewRT("MapWaterRippleB"); view = NewRT("MapWaterRippleView");
  for (int q = 0; q < count; q++) { impulseBuffers[q] = new ComputeBuffer(32, 16); foamBuffers[q] = new ComputeBuffer(16, 16); }
  for (int q = 0; q < count; q++) {
   var f = falls[q];
   Vector2 up = f.upstream.sqrMagnitude > 1e-6f ? f.upstream.normalized : Vector2.up, down = -up, tan = new Vector2(-up.y, up.x);
   Vector2 p = new Vector2(origin.x + f.plunge.x, origin.z + f.plunge.z);
   winMin[q] = p + down * windowShiftDownstream - Vector2.one * (windowSize * 0.5f);
   float half = Mathf.Max(f.width * 0.5f, 0.8f);
   Vector2 e0 = p - tan * half, e1 = p + tan * half;
   c0[q] = (e0 - winMin[q]) / windowSize; c1[q] = (e1 - winMin[q]) / windowSize;
   rects[q] = new Vector4(winMin[q].x, winMin[q].y, 1f / windowSize, q);
   contacts[q] = new Vector4(e0.x, e0.y, e1.x, e1.y);
  }
  step = -1; return true;
 }

 RenderTexture NewRT(string name) {
  var rt = new RenderTexture(atlasW, atlasH, 0, RenderTextureFormat.ARGBHalf, RenderTextureReadWrite.Linear) {
   name = name, enableRandomWrite = true, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, useMipMap = false };
  rt.Create(); return rt;
 }

 public void Release() {
  Shader.SetGlobalVector(GAtlasId, Vector4.zero);
  if (a != null) a.Release(); if (b != null) b.Release(); if (view != null) view.Release();
  for (int q = 0; q < MaxFalls; q++) { impulseBuffers[q]?.Release(); foamBuffers[q]?.Release(); impulseBuffers[q] = foamBuffers[q] = null; }
  a = b = view = null;
 }

 /// <summary>時刻(秒)までシミュレーションを進め、水面shaderが読むグローバル値を設定する。</summary>
 public void Advance(float timeSeconds) {
  if (a == null) return;
  float t = Mathf.Max(0, timeSeconds);
  int target = Mathf.FloorToInt(t * stepRate + 1e-4f);
  if (step < 0 || target < step) Reset();
  if (target - step > (int)(catchUpSeconds * stepRate) + maxStepsPerFrame) { Reset(); step = Mathf.Max(0, target - (int)(catchUpSeconds * stepRate)); }
  int budget = maxStepsPerFrame;
  while (step < target && budget-- > 0) Step();
  int count = Mathf.Min(falls.Count, MaxFalls);
  Shader.SetGlobalTexture(GTexId, view);
  Shader.SetGlobalVector(GAtlasId, new Vector4(count, 1f / atlasW, 1f / atlasH, Tile));
  Shader.SetGlobalVector(GTilesId, new Vector4(TilesPerRow, 0, 0, 0));
  Shader.SetGlobalVectorArray(GRectId, rects); Shader.SetGlobalVectorArray(GContactId, contacts);
 }

 void Reset() {
  int gx = Mathf.CeilToInt(atlasW / 8f), gy = Mathf.CeilToInt(atlasH / 8f);
  foreach (var rt in new[] { a, b }) { cs.SetTexture(kClear, DstId, rt); cs.SetTexture(kClear, OutId, view); cs.Dispatch(kClear, gx, gy, 1); }
  step = 0;
 }

 void Schedule(int n, int fall) {
  impulses.Clear(); foams.Clear();
  var rng = new System.Random(n * 7919 + 121 + fall * 104729);
  float dt = 1f / stepRate, m = 1f / windowSize;
  Vector2 e0 = c0[fall], e1 = c1[fall];
  for (int i = 0; i < 4; i++) {
   var p = Vector2.Lerp(e0, e1, (float)rng.NextDouble()) + new Vector2(0, (float)(rng.NextDouble() - 0.5) * 0.18f * m);
   impulses.Add(new Vector4(p.x, p.y, -churn * (0.5f + (float)rng.NextDouble()), (0.10f + 0.10f * (float)rng.NextDouble()) * m));
  }
  int k = Mathf.FloorToInt(n * dt / slugInterval);
  for (int kk = k - 1; kk <= k; kk++) {
   if (kk < 0) continue;
   var r2 = new System.Random(kk * 104729 + 7 + fall * 7919);
   float when = (kk + 0.05f + 0.9f * (float)r2.NextDouble()) * slugInterval;
   if (when < n * dt || when >= (n + 1) * dt) continue;
   float power = 0.35f + 1.0f * (float)r2.NextDouble();
   float from = (float)r2.NextDouble() * 0.6f, to = Mathf.Min(1f, from + 0.35f + 0.65f * (float)r2.NextDouble());
   for (int i = 0; i < 4; i++) {
    var p = Vector2.Lerp(e0, e1, Mathf.Lerp(from, to, (i + 0.5f) / 4f)) + new Vector2(0, (float)(r2.NextDouble() - 0.5) * 0.2f * m);
    impulses.Add(new Vector4(p.x, p.y, -slugStrength * power, (0.22f + 0.18f * (float)r2.NextDouble()) * m));
    foams.Add(new Vector4(p.x, p.y + (float)(r2.NextDouble() - 0.6) * 0.7f * m, 0.2f * power, 0.35f * m));
   }
  }
  if (impulses.Count > 32) impulses.RemoveRange(32, impulses.Count - 32);
  for (int i = 0; i < 5 && foams.Count < 16; i++) {
   float along = -0.18f + 1.36f * (float)rng.NextDouble(), side = (float)(rng.NextDouble() - 0.55) * 1.3f;
   var p = Vector2.LerpUnclamped(e0, e1, along) + new Vector2(0, side * m);
   foams.Add(new Vector4(p.x, p.y, foamPerStep * (0.6f + 0.6f * (float)rng.NextDouble()), (0.22f + 0.22f * (float)rng.NextDouble()) * m));
  }
 }

 void Step() {
  float dt = 1f / stepRate, dx = windowSize / Tile, courant = waveSpeed * dt / dx;
  int count = Mathf.Min(falls.Count, MaxFalls);
  cs.SetVector(SimId, new Vector4(Tile, courant * courant, damping, spongeTexels));
  cs.SetVector(FoamId, new Vector4(Mathf.Pow(0.5f, dt / foamHalfLife), outflowSpeed * dt / dx, outflowFalloff / dx, swirl));
  cs.SetFloat(CellId, dx); cs.SetVector(MapRectId, mapRect); cs.SetVector(AtlasSizeId, new Vector2(atlasW, atlasH));
  cs.SetTexture(kUpdate, DepthId, depthTex); cs.SetTexture(kUpdate, SrcId, a); cs.SetTexture(kUpdate, DstId, b); cs.SetTexture(kUpdate, OutId, view);
  for (int q = 0; q < count; q++) {
   Schedule(step, q);
   impulseBuffers[q].SetData(impulses); foamBuffers[q].SetData(foams);
   cs.SetInt(ImpulseCountId, impulses.Count); cs.SetInt(FoamCountId, foams.Count);
   cs.SetBuffer(kUpdate, ImpulsesId, impulseBuffers[q]); cs.SetBuffer(kUpdate, FoamSourcesId, foamBuffers[q]);
   cs.SetInts(TileId, (q % TilesPerRow) * Tile, (q / TilesPerRow) * Tile);
   cs.SetVector(WindowId, new Vector4(winMin[q].x, winMin[q].y, windowSize, 0));
   cs.SetVector(ContactId, new Vector4(c0[q].x, c0[q].y, c1[q].x, c1[q].y));
   cs.Dispatch(kUpdate, Tile / 8, Tile / 8, 1);
  }
  var swap = a; a = b; b = swap; step++;
 }
}
}
