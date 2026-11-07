using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;

namespace MapSharedProps.EditorTools {
// v1の固定造形を連結成分ごとに分割する。三角形や頂点を削らず、古い出力も開閉可能。
// 中央に接する石板は左右別に溶接する。新しい形状規格には別の分割契約が必要。
internal static class BossDoorArticulation {
    static int Find(int[] parents, int i) {
        while (parents[i] != i) { parents[i] = parents[parents[i]]; i = parents[i]; }
        return i;
    }
    static void Join(int[] parents, int a, int b) { parents[Find(parents, a)] = Find(parents, b); }
    public static void Build(GameObject root, SmallPropsV1.Asset asset, Mesh source, Material material) {
        var vertices = source.vertices;
        var triangles = source.triangles;
        var parents = new int[vertices.Length];
        for (int i = 0; i < parents.Length; i++) parents[i] = i;
        var welded = new Dictionary<(Vector3, bool), int>();
        for (int i = 0; i < triangles.Length; i += 3) {
            bool right = vertices[triangles[i]].x + vertices[triangles[i + 1]].x + vertices[triangles[i + 2]].x >= 0;
            for (int k = 0; k < 3; k++) {
                int v = triangles[i + k];
                var key = (vertices[v], right);
                if (welded.TryGetValue(key, out int other)) Join(parents, v, other);
                else welded.Add(key, v);
            }
            Join(parents, triangles[i], triangles[i + 1]);
            Join(parents, triangles[i], triangles[i + 2]);
        }
        var bounds = new Dictionary<int, Bounds>();
        for (int i = 0; i < vertices.Length; i++) {
            int group = Find(parents, i);
            if (bounds.TryGetValue(group, out var b)) { b.Encapsulate(vertices[i]); bounds[group] = b; }
            else bounds.Add(group, new Bounds(vertices[i], Vector3.zero));
        }
        bool stone = asset.id == "boss_stone_door";
        float hinge = stone ? 1.90f : 2.13f;
        var members = new int[vertices.Length];
        for (int i = 0; i < vertices.Length; i++) {
            var b = bounds[Find(parents, i)];
            bool leaf = Mathf.Abs(b.center.x) < (stone ? 2.05f : 2.3f) && b.center.y > .25f && b.max.y < (stone ? 5.25f : 5.8f);
            if (leaf && b.min.x < -.001f && b.max.x > .001f) throw new InvalidDataException("Boss door leaf crosses the hinge seam");
            members[i] = leaf ? (b.center.x < 0 ? 1 : 2) : 0;
        }
        var pivots = new Transform[3];
        var normals = source.normals; var colors = source.colors; var uv = source.uv;
        for (int part = 0; part < 3; part++) {
            var origin = part == 0 ? Vector3.zero : new Vector3(part == 1 ? -hinge : hinge, 0, 0);
            var p = new List<Vector3>(); var n = new List<Vector3>(); var c = new List<Color>(); var u = new List<Vector2>(); var ix = new List<int>();
            var remap = new Dictionary<int, int>();
            for (int i = 0; i < triangles.Length; i += 3) {
                if (members[triangles[i]] != part) continue;
                for (int k = 0; k < 3; k++) {
                    int old = triangles[i + k];
                    if (members[old] != part) throw new InvalidDataException("Boss door triangle split");
                    if (!remap.TryGetValue(old, out int index)) {
                        index = p.Count; remap.Add(old, index);
                        p.Add(vertices[old] - origin); n.Add(normals[old]); c.Add(colors[old]); u.Add(uv[old]);
                    }
                    ix.Add(index);
                }
            }
            if (ix.Count == 0) throw new InvalidDataException("Missing boss door part");
            var mesh = new Mesh { name = asset.id + "-" + part, indexFormat = IndexFormat.UInt32 };
            mesh.SetVertices(p); mesh.SetNormals(n); mesh.SetColors(c); mesh.SetUVs(0, u); mesh.SetTriangles(ix, 0); mesh.RecalculateBounds();
            mesh = SharedImportCache.StoreMesh(mesh, "boss-door-articulation/1/" + part + "\n" + JsonUtility.ToJson(asset));
            var obj = new GameObject(new[] { "Frame", "LeftLeaf", "RightLeaf" }[part]);
            obj.transform.SetParent(root.transform, false); obj.transform.localPosition = origin;
            obj.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = obj.AddComponent<MeshRenderer>(); renderer.sharedMaterial = material;
            renderer.shadowCastingMode = ShadowCastingMode.On; renderer.receiveShadows = true;
            if (asset.radius > 0) obj.AddComponent<MeshCollider>().sharedMesh = mesh;
            pivots[part] = obj.transform;
        }
        root.AddComponent<MapSharedProps.BossDoorController>().Configure(pivots[1], pivots[2]);
    }
}
}
