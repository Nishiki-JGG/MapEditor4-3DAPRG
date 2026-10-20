using System.Collections.Generic;
using UnityEngine;

namespace MapWater.EditorTools {
// 滝の板と着水の飛沫のメッシュ（物体空間：原点＝着水点、+Z＝水源の向き、着水線は X 軸ぞい）。
// CAV-002 の make_meshes.py の飛沫（水滴18・霧20・白い欠片 6個×4組・芯3）を、滝の幅に合わせて作る。乱数は滝の id から決める（同じ書き出しなら同じ形）。
public static class MapWaterMeshes {
 static int Seed(string id) { unchecked { int h = 1210; foreach (char c in id ?? "") h = h * 31 + c; return h; } }

 public static Mesh FallSheet(MapWaterFallInfo f, string id) {
  const int cols = 13, rows = 28;
  float H = f.height, W = f.width;
  var verts = new List<Vector3>(); var uvs = new List<Vector2>(); var tris = new List<int>();
  for (int r = 0; r < rows; r++) {
   float t = r / (float)(rows - 1);                 // 0 = 上(落ち口)、1 = 下(着水点)
   float y = H * (1 - t), grow = Mathf.Min(1f, (H * t) / 2.2f);
   for (int c = 0; c < cols; c++) {
    float u = c / (float)(cols - 1);
    float bulge = 0.24f * Mathf.Pow(Mathf.Sin(Mathf.PI * u), 0.8f) - 0.05f;   // 中央ほど手前（-Z＝下流側）へ張り出し、端は少し奥へ巻く
    verts.Add(new Vector3((u - 0.5f) * W, y, -bulge * grow)); uvs.Add(new Vector2(u, -2 + 4 * t));
   }
  }
  for (int r = 0; r < rows - 1; r++) for (int c = 0; c < cols - 1; c++) {
   int a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
   tris.AddRange(new[] { a, d, b, b, d, e });
  }
  var m = new Mesh { name = "Fall_" + id }; m.SetVertices(verts); m.SetUVs(0, uvs); m.SetTriangles(tris, 0); m.RecalculateNormals();
  m.bounds = new Bounds(new Vector3(0, H * 0.5f, -0.2f), new Vector3(W + 1f, H + 1f, 1.5f)); return m;
 }

 public static Mesh Stream(MapWaterFallInfo f, float[] src, float[] pos, System.Func<float, float, float> height, float top) {
  Vector2 s = new Vector2(src[0], src[1]), e = new Vector2(pos[0], pos[2]) + f.upstream * 0.8f; float L = (s - e).magnitude; if (L < 1f) return null;
  Vector2 d = (e - s) / L, perp = new Vector2(-d.y, d.x); int M = Mathf.Max(4, Mathf.CeilToInt(L / 0.35f));
  var P = new List<Vector3>(); var UV = new List<Vector2>(); var UV1 = new List<Vector2>(); var tris = new List<int>();
  for (int i = 0; i <= M; i++) {
   float t = i / (float)M; Vector2 c = Vector2.Lerp(s, e, t); float y = Mathf.Max(height(c.x, c.y) + 0.1f, top + 0.04f);
   float w = f.width * 0.85f * (0.5f + 0.5f * Mathf.SmoothStep(0, 1, Mathf.Clamp01(t / 0.3f))) * 0.5f;
   P.Add(new Vector3(c.x - perp.x * w, y, c.y - perp.y * w)); P.Add(new Vector3(c.x + perp.x * w, y, c.y + perp.y * w));
   UV.Add(new Vector2(0, t)); UV.Add(new Vector2(1, t)); UV1.Add(new Vector2(t * L, 0)); UV1.Add(new Vector2(t * L, 0));
   if (i < M) { int a = i * 2; tris.AddRange(new[] { a, a + 2, a + 1, a + 1, a + 2, a + 3 }); }
  }
  var m = new Mesh { name = "Stream_" + f.id, indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 }; m.SetVertices(P); m.SetUVs(0, UV); m.SetUVs(1, UV1); m.SetTriangles(tris, 0); m.RecalculateBounds(); return m;
 }

 public static Mesh Splash(MapWaterFallInfo f, string id) {
  var rng = new System.Random(Seed(id));
  float R() => (float)rng.NextDouble();
  float U(float a, float b) => a + (b - a) * R();
  float s = Mathf.Clamp(f.width / 2.05f, 0.6f, 2.5f), sz = Mathf.Sqrt(s);
  const float WY = -0.02f;
  var P = new List<Vector3>(); var N = new List<Vector3>(); var UV0 = new List<Vector2>(); var UV1 = new List<Vector4>(); var tris = new List<int>();
  void Add(Vector3 p, Vector3 vel, float phase, float life, float size, float kind) {
   int b = P.Count; var corners = new[] { new Vector2(-.5f, -.5f), new Vector2(.5f, -.5f), new Vector2(.5f, .5f), new Vector2(-.5f, .5f) };
   foreach (var c in corners) { P.Add(p); N.Add(vel); UV0.Add(c); UV1.Add(new Vector4(phase, life, size, kind)); }
   tris.AddRange(new[] { b, b + 1, b + 2, b, b + 2, b + 3 });
  }
  for (int k = 0; k < 18; k++) {           // 水滴の筋：着水線の両端の外まで全方向（奥＝崖＝+Z は手前へ寄せる）
   float x = U(-1.2f, 1.2f) * s, z = U(-0.08f, 0.08f), ang = U(-Mathf.PI, Mathf.PI);
   if (Mathf.Sin(ang) > 0.3f && R() < 0.6f) ang = -ang;
   float sp = U(0.35f, 1.1f), up = U(1.9f, 3.3f);
   Add(new Vector3(x, WY, z), new Vector3(Mathf.Cos(ang) * sp, up, Mathf.Sin(ang) * sp), R(), U(0.55f, 0.85f), U(0.035f, 0.06f) * sz, 0);
  }
  for (int k = 0; k < 26; k++) {           // 霧（20→26：滝の幅に対して着水の迫力が弱いという判定への対応）：大きく薄く、ゆっくり上がってまわりへ広がる
   float x = U(-1.35f, 1.35f) * s, z = U(-0.28f, 0.09f), ang = U(-Mathf.PI, 0.2f), sp = U(0.15f, 0.5f);
   Add(new Vector3(x, WY + 0.05f, z), new Vector3(Mathf.Cos(ang) * sp * 2.2f, U(0.08f, 0.25f), Mathf.Sin(ang) * sp * 2.2f), R(), U(2.2f, 3.4f), U(1.2f, 2.0f) * sz, 1);   // 横へ広がり、あまり上がらない（綿の玉・ドームにならないように）
  }
  for (int g = 0; g < 4; g++) {            // 白い欠片：6個ずつ4組の「はじけ」。同じ組は同時に出て輪のように外へ広がる
   float life = 0.95f, phase = g / 4f + U(-0.03f, 0.03f), bas = U(0, Mathf.PI / 6);
   for (int j = 0; j < 6; j++) {
    float x = U(-0.95f, 0.95f) * s, z = U(-0.04f, 0.05f) - 0.04f, ang = -Mathf.PI + bas + j * (Mathf.PI / 5) + U(-0.15f, 0.15f), sp = U(2.4f, 3.6f), up = U(0.9f, 1.4f);
    Add(new Vector3(x, WY, z), new Vector3(Mathf.Cos(ang) * sp, up, Mathf.Sin(ang) * sp), phase + U(-0.01f, 0.01f), life, U(0.20f, 0.32f) * sz, 2);
   }
  }
  for (int k = 0; k < 3; k++) {            // 着水点の明るい芯
   float x = (k - 1) * 0.75f * s + U(-0.1f, 0.1f);
   Add(new Vector3(x, WY + 0.02f, -0.08f), new Vector3(R() * 0.1f - 0.05f, 0.35f, -0.08f), R(), U(0.9f, 1.2f), U(0.35f, 0.45f) * sz, 2);
  }
  var m = new Mesh { name = "Splash_" + id, indexFormat = UnityEngine.Rendering.IndexFormat.UInt16 };
  m.SetVertices(P); m.SetNormals(N); m.SetUVs(0, UV0); m.SetUVs(1, UV1); m.SetTriangles(tris, 0);
  m.bounds = new Bounds(new Vector3(0, 1.0f, -1.5f * s), new Vector3(8 * s, 5f, 8 * s)); return m;
 }
}
}
