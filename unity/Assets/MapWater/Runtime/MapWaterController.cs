using System.Collections.Generic;
using UnityEngine;

namespace MapWater {
/// <summary>
/// 書き出しから作った水一式（水面・滝・飛沫）を動かす。置き場所：Terrain の角（書き出しの原点）に置き、回転・拡縮はしない。
/// ・時刻：useFixedTime なら fixedTime、そうでなければ Time.time*timeScale+timeOffset。
/// ・材質の値は MaterialPropertyBlock で渡す（材質の資産を書き換えない＝撮影や再生で資産のSHAが変わらない）。
/// ・波紋は MapWaterRippleSim（滝ごとの窓）。compute非対応の端末では波紋と泡の元が止まり、細波と深さの色だけになる。
/// </summary>
[DisallowMultipleComponent]
public sealed class MapWaterController : MonoBehaviour {
 public Renderer surface;
 public Renderer[] fallRenderers, splashRenderers, streamRenderers;
 public List<MapWaterFallInfo> falls = new List<MapWaterFallInfo>();
 public ComputeShader ripple;
 public Texture depthTexture;
 public Vector2 mapSize = new Vector2(64, 64);
 public bool useFixedTime;
 public float fixedTime = 4f, timeScale = 1f, timeOffset;
 public bool rippleEnabled = true;
 public float flowScale = 1f, fleckScale = 1f, foamScale = 1f;   // 確認用の対照（0 にすると、流れ・泡の小片・泡が止まる／消える）
 public bool streamVisible = true;   // 0 にすると流れで運ぶ動きが止まる（確認用の対照）

 public float Time_ { get; private set; }
 MapWaterRippleSim sim;
 MaterialPropertyBlock mpbSurface, mpbFall, mpbSplash;
 static readonly int PhaseId = Shader.PropertyToID("_Phase"), FlowMaxId = Shader.PropertyToID("_FlowMax"), FleckId = Shader.PropertyToID("_FleckStrength"), FoamId = Shader.PropertyToID("_FoamStrength"), RectId = Shader.PropertyToID("_MapRect"), HeightId = Shader.PropertyToID("_FallHeight"), WaterYId = Shader.PropertyToID("_WaterY");

 void OnEnable() {
  mpbSurface = new MaterialPropertyBlock(); mpbFall = new MaterialPropertyBlock(); mpbSplash = new MaterialPropertyBlock();
  sim = null;
  if (rippleEnabled && ripple != null && depthTexture != null && falls.Count > 0) {
   sim = new MapWaterRippleSim(ripple, depthTexture, transform.position, mapSize, falls);
   if (!sim.Create()) sim = null;
  }
  Apply(CurrentTime());
 }
 void OnDisable() {
  if (sim != null) { sim.Release(); sim = null; }
  else Shader.SetGlobalVector("_MWAtlas", Vector4.zero);
 }
 float CurrentTime() => useFixedTime ? fixedTime : UnityEngine.Time.time * timeScale + timeOffset;
 void LateUpdate() { Apply(CurrentTime()); }

 /// <summary>時刻を指定して全部を更新する（撮影用に外から呼べる）。</summary>
 public void Apply(float t) {
  Time_ = t;
  if (sim != null) sim.Advance(t);
  var origin = transform.position;
  if (surface != null) {
   surface.GetPropertyBlock(mpbSurface); mpbSurface.SetFloat(PhaseId, t);
   if (fleckScale != 1f && surface.sharedMaterial != null) mpbSurface.SetFloat(FleckId, surface.sharedMaterial.GetFloat(FleckId) * fleckScale);
   if (foamScale != 1f && surface.sharedMaterial != null) mpbSurface.SetFloat(FoamId, surface.sharedMaterial.GetFloat(FoamId) * foamScale);
   if (flowScale != 1f && surface.sharedMaterial != null) mpbSurface.SetFloat(FlowMaxId, surface.sharedMaterial.GetFloat(FlowMaxId) * flowScale);
   mpbSurface.SetVector(RectId, new Vector4(origin.x, origin.z, 1f / mapSize.x, 1f / mapSize.y)); surface.SetPropertyBlock(mpbSurface);
  }
  for (int i = 0; fallRenderers != null && i < fallRenderers.Length; i++) {
   var r = fallRenderers[i]; if (r == null) continue;
   r.GetPropertyBlock(mpbFall); mpbFall.SetFloat(PhaseId, t);
   if (i < falls.Count) mpbFall.SetFloat(HeightId, falls[i].height);
   mpbFall.SetFloat(WaterYId, r.transform.position.y); r.SetPropertyBlock(mpbFall);
  }
  for (int i = 0; streamRenderers != null && i < streamRenderers.Length; i++) {
   var r = streamRenderers[i]; if (r == null) continue; r.enabled = streamVisible;
   r.GetPropertyBlock(mpbSplash); mpbSplash.SetFloat(PhaseId, t); r.SetPropertyBlock(mpbSplash);
  }
  for (int i = 0; splashRenderers != null && i < splashRenderers.Length; i++) {
   var r = splashRenderers[i]; if (r == null) continue;
   r.GetPropertyBlock(mpbSplash); mpbSplash.SetFloat(PhaseId, t); r.SetPropertyBlock(mpbSplash);
  }
 }
}
}
