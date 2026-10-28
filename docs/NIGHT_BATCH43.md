# Batch 43 — gold lid seams and Unity material identity

Baseline: `31d36a19fed45062098d1a41db9c25b5f28b7a3d`.

The two black gold-chest lid strips now render at 3 mm instead of 15 mm. The red gem, black recesses, gold borders, other chest variants and silhouette are retained. The source mesh, vertex attributes, saved data and collider mesh are unchanged; the gold presentation vertex transform is also applied to its shadow passes. This is a composition improvement, **not completion of the requested texture quality work**.

## Actual-image finding

The first Unity run passed 651 checks but its actual gold image barely changed. A targeted inspection found that gold and silver reliefs shared the same material cache key. Whichever was built first supplied `_ChestVariant`; gold's relief had variant 4 (silver). Root gold had the correct 5. The cache key now includes the canonical chest identity whenever optional surface data is enabled. This also restores gold's intended existing roughness variant; it adds one material, not a new shader, texture, renderer or mesh. Legacy reliefs without optional surface data retain their former path. Three new checks verify each relief's actual variant.

Native and Windows Player images now show the thin strips. Initial incomplete/ineffective runs remain in ignored output directories; only `batch43-verified` is used for adoption evidence.

## Validation

- Web catalog contract against the baseline: 135 unaffected render signatures; all 136 geometry/UV/metadata signatures exact. Old load/save, undo/redo, placement and walking/collider checks passed. Draws and triangle count unchanged (8 / 27,063 in the contract fixture).
- Surface contract: all 43 exported Native asset and presentation payloads exact; both texture PNG payloads unchanged. The shader presentation change does not modify exported geometry.
- Prepared parity: fixed sample keys and contents unchanged; fixed rock regeneration 0; water sources unchanged.
- Web focused images: 15 views and four packed-channel ablations. Motion evidence samples 36 fixed-time camera positions per side, from a close orbit through zoom-out to a distant orbit; no shader/GL errors or draw/triangle/texture-count changes. Inspected close/mid/far frames show no broken strips. The 12 fps comparison movie is sampled motion evidence, not an exhaustive real-time flicker test.
- Unity Native: 654 checks passed, including silver/gold/rainbow relief variant checks. Windows Player: 291 checks passed. Editor lineup, Player lineup and Player reload image are pixel-identical.
- Memory: 74 meshes / 17,653,612 bytes retained with exact collision references. Current importer uses 23 materials; the preceding adopted importer used 22. Both 512-square textures remain shared. The paired report uses the current importer on both sides, so its 23/23 result must not be mistaken for zero material increase over the old importer.
- Image audit against batch38's adopted images: 80 Native and 24 Player PNGs exact. Gold and mixed gold lineups change as intended. Silver/rainbow differences are sparse edge/rounding changes (close-view maximum 2 channel levels); they are not claimed bit-identical. The full bounded differences are retained in `batch43-verified/image-audit.json`.
- Custom compatibility: 154 checks passed after the material-key fix in `batch43-compatibility-resumed`. The earlier interrupted process left no result; its unused stale lock was cleared only after verifying no Unity process and obtaining an exclusive file handle. Native/Player were not rerun for that interruption.

## Local evidence

Under ignored `output/playwright/night-props/`: `batch43-regression`, `batch43-focus`, `batch43-motion`, `batch43-verified`, and `batch43-compatibility-resumed`.

No lighting, texture authoring, scene-wide reflection, main-branch or publication-setting change is included. Batch44 colour-map experiments remain separate and unadopted.

Windows Player had zero runtime warnings/errors; the build retains seven existing Core RP StripperTests warnings. Other GPUs, IL2CPP, mobile, Built-in/HDRP and a full game session remain unverified.
