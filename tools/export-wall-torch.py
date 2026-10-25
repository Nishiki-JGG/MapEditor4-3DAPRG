"""元のRoomTorchを変更せず、Web用の頂点・法線・設定と来歴を抽出する。"""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path


def mesh(path):
    text = path.read_text(encoding="utf-8-sig")
    count = int(re.search(r"m_VertexCount: (\d+)", text)[1])
    raw = bytes.fromhex(re.search(r"_typelessdata: (\w+)", text)[1])
    # この原本の2メッシュはposition/normalのfloat32、stream 0、stride 24。
    channels = re.findall(r"- stream: (\d+)\s+offset: (\d+)\s+format: (\d+)\s+dimension: (\d+)", text)
    assert channels[:2] == [("0", "0", "0", "3"), ("0", "12", "0", "3")]
    assert all(int(c[3]) == 0 for c in channels[2:]) and len(raw) == count * 24
    assert "m_IndexFormat: 0" in text
    indices = list(struct.unpack("<" + "H" * (len(re.search(r"m_IndexBuffer: (\w+)", text)[1]) // 4), bytes.fromhex(re.search(r"m_IndexBuffer: (\w+)", text)[1])))
    values = [struct.unpack_from("<6f", raw, i * 24) for i in range(count)]
    # Unity左手系 -> Three右手系。Z反転と三角形の巻き順を一緒に変換する。
    return {"positions": [v for row in values for v in (row[0], row[1], -row[2])],
            "normals": [v for row in values for v in (row[3], row[4], -row[5])],
            "triangles": [v for i in range(0, len(indices), 3) for v in (indices[i], indices[i + 2], indices[i + 1])]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="元ゲームのAssets/TotsuDanShell/Prototype")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    files = ["Art/DungeonPresentation/Torch.asset", "Art/DungeonPresentation/Flame.asset",
             "Art/DungeonPresentation/Blackened iron.mat", "Art/DungeonPresentation/Torch glow.mat",
             "Resources/DiscoveryPresentation/RoomTorch.prefab", "Resources/DiscoveryPresentation/RoomTorch.prefab.meta",
             "Resources/DiscoveryPresentation/TorchSmoke.mat", "Resources/DiscoveryPresentation/TorchSpark.mat",
             "Runtime/DiscoveryRoomTorchPresentation.cs"]
    source = [{"path": "Assets/TotsuDanShell/Prototype/" + name,
               "sha256": hashlib.sha256((args.source / name).read_bytes()).hexdigest()}
              for name in files]
    prefab = (args.source / files[4]).read_text(encoding="utf8")
    script = (args.source / files[-1]).read_text(encoding="utf8")
    assert 'StableVfxId = "vfx.environment.torch.fire"' in script
    for value in ["baseIntensity: 3", "flickerSpeed: 1.7", "flickerAmount: 0.14", "m_LocalPosition: {x: 0, y: 0.26, z: 0}"]:
        assert value in prefab, value
    data = {"version": 1, "assetKey": "tdj/wall_torch", "vfxId": "vfx.environment.torch.fire",
            "resourcePath": "DiscoveryPresentation/RoomTorch",
            "prefabGuid": re.search(r"guid: (\w+)", (args.source / files[5]).read_text())[1],
            "axes": "Three X/Y/-Z from Unity X/Y/Z; original root pivot, metres",
            "defaultMountHeight": 1.45, "flameOrigin": [0, .26, 0],
            "fixture": mesh(args.source / files[0]), "flame": mesh(args.source / files[1]),
            "fixtureMaterial": {"color": [.075, .065, .05], "metalness": .55, "roughness": .8},
            # 原本はEmission値を保存しているがキーワードが無効。値だけを見て発光を足さない。
            "flameMaterial": {"color": [1, .55, .1], "emissive": [1.7, .65, .09],
                              "emissionEnabled": "_EMISSION" in (args.source / files[3]).read_text(encoding="utf8").split("m_InvalidKeywords:")[0]},
            "light": {"color": [1, .57, .21], "intensity": 3, "range": 8},
            "flicker": {"speed": 1.7, "amount": .14},
            "sparks": {"rate": 8, "lifetime": [.55, .95], "speed": [.25, .62], "size": [.014, .034], "max": 18,
                       "materialColor": [1, .34, .055, .92], "colorMin": [1, .22, .03, .9], "colorMax": [1, .72, .18, 1],
                       "shapeOrigin": [0, .06, 0], "radius": .06, "angle": 14, "noise": .06},
            "smoke": {"rate": 3, "lifetime": [1.2, 1.8], "speed": [.11, .24], "size": [.075, .17], "max": 12,
                      "materialColor": [.23, .2, .18, .28], "colorMin": [.24, .21, .18, .22], "colorMax": [.12, .11, .1, .09],
                      "shapeOrigin": [0, .09, 0], "radius": .08, "angle": 11, "noise": .08, "sizeOverLife": [.55, 1.25]},
            "sources": source}
    target = root / "props/wall-torch-source.js"
    target.write_text("// 元のRoomTorchから tools/export-wall-torch.py で抽出。原本は変更しない。\nwindow.TDWallTorchSource = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf8")
    print(json.dumps({"file": str(target), "fixtureTriangles": len(data["fixture"]["triangles"]) // 3,
                      "flameTriangles": len(data["flame"]["triangles"]) // 3, "prefabGuid": data["prefabGuid"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
