# Grounded shell-cluster local lighting

The formal exporter writes nine fitted shell/starfish parts and their world poses in `grounded_props.json`, matched to `props.csv`. `MapSharedPropsBuilder` calls `GroundedPropsV1.Build`, which combines the parts into one renderer per placed cluster. This is a separate material path from `SmallPropsV1` and its 44 Prefabs.

In the previous importer, a formally generated cluster produced byte-identical images with a nearby point light OFF and ON, despite successful rendering. Its shared material did not enable the additional-light calculation. The correction only enables `SMALL_PROP_LOCAL_LIGHTS` when the supplied shader is `MapSharedProps/Lit`. The already validated URP light loop is reused; no shader, lighting setup, material colour, texture, mesh, UV, placement, Collider or schema changed. Nature and other material paths are not opted in.

## Installation

Update `Runtime/SharedPropLit.shader` to the version with the local-light keyword and update `Editor/GroundedPropsV1.cs`. Reimport into a fresh output folder. Previously generated `grounded-shells` materials do not acquire this keyword automatically. Updating the published Web page alone cannot update an existing Unity project. Source game scenes are not modified by this change.

## Validation

Unity6000.5.9f1 / URP17.5: formal before/after imports preserve vertex/index data, normals, colours, UVs, tint and source pose. Exported part world positions match within 0.00002m. The cluster remains1216 triangles, one renderer, no Collider, with the same shared128px texture. Repeat import reuses that texture.

Forward and Forward+ each exercise nine conditions: all-off, ambient-only, main-only, near/far point, spot inside/outside, point shadow and spot shadow. Local light responds and attenuates with distance; blockers remove point/spot illumination. Main-only, ambient-only, all-off and spot-outside images are exactly unchanged. Optional surface absent/invalidUV/invalidPNG keep the white fallback and the lighting opt-in. A missing sidecar returns0 placements. The pre-surface Reader source also imports the current geometry, using its expected white fallback; no old binary was run.

The first fallback assertion was too strict about Unity's built-in white texture identity. Asset serialization can represent it as null, with this shader's default white sampler. The test was corrected to accept null-or-white, matching the existing contract; product fallback code was unchanged. Failure evidence was retained.

Actual generated cave seed71421,648 cells,21 authored torches supplies identical normal-distance and close A/B views near an existing torch, about2.24m away. Shell ridges and starfish lobes receive the warm light while underside/groove darkness remains. No light, exposure, source scene or camera framing changes were used for the comparison. The cave tests real map illumination; it is not presented as a natural coastal habitat. Local images are retained with hashes, not uploaded.

Web code was unchanged. The ordinary Web output, save/reload, normalized Map/Set Collider state and local light response passed. The44 separate small-prop Prefabs and their product code/assets are unchanged. New GPU, Player, mobile, vertex-light-mode and full gameplay checks were not run; no performance guarantee is implied.

## Reproduction

Set `GROUNDED_LIGHT_REVIEW_PROJECT` to the existing dedicated review project. Run `node tests/grounded-local-light.cjs` to create the small grounded export fixture, then `python tests/prepare-grounded-local-light.py`. Run `Grounded119Baseline.Run` and `Grounded119Checks.Run` using background Editor batchmode with graphics. Test output folders must be fresh. The existing PC_RPAsset/PC_Renderer assets, ColliderSnapshot109 helper and Imported117 reference Prefabs are required. `Grounded119Review.Compare` captures formal before/after Prefabs in an existing isolated scene. Game-specific generation code is intentionally not redistributed.
