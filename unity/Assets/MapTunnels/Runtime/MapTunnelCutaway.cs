using System.Collections.Generic;
using UnityEngine;

namespace MapTunnels {
/// <summary>
/// トンネルの屋根の透かし（エディターと同じ規則）。主人公がトンネルの床の上にいて、頭の上に地面があるとき、
/// 大域の _MapCutA（足元 xyz・半径）と _MapCutB（カメラ）をシェーダーへ渡す。MapTunnels/Tunnel の網はこれで屋根を描かない。
/// 地形（Terrain）の材質にも同じ判定を入れると、地面も同じように抜ける（Unity の標準の Terrain の材質には入っていない）。
/// segments：トンネルの中心線（地図の原点からの座標、y = 床）。MapTunnelBuilder が meta.json から入れる。
/// </summary>
public sealed class MapTunnelCutaway : MonoBehaviour {
 [System.Serializable] public struct Segment { public Vector3 a, b; public float halfWidth, height; }
 public List<Segment> segments = new List<Segment>();
 public Transform hero; public Camera viewCamera; public Terrain terrain;
 public float radius = 7f;
 static readonly int CutA = Shader.PropertyToID("_MapCutA"), CutB = Shader.PropertyToID("_MapCutB");
 void LateUpdate() {
  var cam = viewCamera != null ? viewCamera : Camera.main;
  bool on = false; Vector3 h = hero != null ? hero.position : Vector3.zero;
  if (hero != null) {
   Vector3 o = transform.position, p = h - o;
   foreach (var s in segments) {
    Vector2 a = new Vector2(s.a.x, s.a.z), b = new Vector2(s.b.x, s.b.z), q = new Vector2(p.x, p.z), ab = b - a;
    float t = Mathf.Clamp01(Vector2.Dot(q - a, ab) / Mathf.Max(ab.sqrMagnitude, 1e-6f)), floor = Mathf.Lerp(s.a.y, s.b.y, t);
    if ((a + ab * t - q).magnitude > s.halfWidth || p.y > floor + s.height - .3f) continue;
    float ground = terrain != null ? terrain.SampleHeight(h) + terrain.transform.position.y - o.y : float.MaxValue;
    if (ground > p.y + 1.6f) { on = true; break; }
   }
  }
  Shader.SetGlobalVector(CutA, new Vector4(h.x, h.y, h.z, on ? radius : 0f));
  if (cam != null) Shader.SetGlobalVector(CutB, cam.transform.position);
 }
 void OnDisable() { Shader.SetGlobalVector(CutA, Vector4.zero); }
}
}
