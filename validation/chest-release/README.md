# Selected validation evidence

The adopted product source was validated at local source revision `0b7830ff39aa87e186e67ab6e33f6c52a621e213`. This is a provenance identifier, not a required public checkout. `product-sha256.json` lists the product files included here. The baseline publication candidate retained those runtime bytes except one descriptive recipe-location comment in `chest-part-data.js`. The later gold FX-only change is separately checked in `fx-review-checks.json`; the current hash manifest includes that change.

- `unity-editor-checks.json`: 243 successful checks, 43 current and frozen-old Reader Prefabs; Unity 6000.5.9f1 / URP 17.5 / Windows DX12. Includes shared texture memory observations, saved scene reload and shader checks.
- `unity-optional-royal-fallback.json`: actual missing-royal JSON import generated 43 Prefabs; gold legacy shader, royal keyword disabled, Collider retained.
- `unity-gold-near.png`, `unity-seven-reloaded.png`: representative offscreen Editor images of the formal importer result. Studio conditions use dedicated lighting, shared artistic reflection and ACES, not a claim that every target map will look identical.
- `map-context-checks.json`: bounded records from isolated existing grassland and cave generation, seed 71421. Baked Reflection Probe and receiver evidence. Actual game source/scene/settings files were read-only and unchanged. Game assets and private workstation locations are not included.
- `web-checks.json`: compact results from the self-contained publication-candidate Web suite. Full local screenshots/logs are retained outside the public tree.

Editor results are carried forward by exact product-byte parity, not described as newly rerun on a renamed commit. No final Player build/runtime result exists. The reflection setup belongs to review scenes; the importer does not install it into a target scene. See `docs/CHEST_RELEASE.md` for reproduction and limits.

Gold FX follow-up: `cave-fx-time-comparison.png` and `grassland-fx-time-comparison.png` show four fixed animation times before/after. Crops are enlarged 2x with nearest-neighbour sampling. The full original captures remain in local evidence and Library. Same existing map generation, camera, lighting and baked probes; no new environment. The field whole-frame difference is not a particle metric because the retained environment has temporal variation.

Optional FX correction: `optional-fx-fallback.json` records five actual 43-Prefab imports. Invalid decoded V2 is warned and discarded while valid V1 continues. This supersedes the earlier whole-import exception behavior; merely rejecting an over-limit block is not counted as fallback proof. Rendering of a valid V2 payload is unchanged.
