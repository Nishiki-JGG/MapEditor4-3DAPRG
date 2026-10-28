# Selected validation evidence

The adopted product source was validated at local source revision `0b7830ff39aa87e186e67ab6e33f6c52a621e213`. This is a provenance identifier, not a required public checkout. `product-sha256.json` lists the product files included here. Publication changes to test/authoring paths and documentation do not change those runtime bytes, except one descriptive recipe-location comment in `chest-part-data.js`.

- `unity-editor-checks.json`: 243 successful checks, 43 current and frozen-old Reader Prefabs; Unity 6000.5.9f1 / URP 17.5 / Windows DX12. Includes shared texture memory observations, saved scene reload and shader checks.
- `unity-optional-royal-fallback.json`: actual missing-royal JSON import generated 43 Prefabs; gold legacy shader, royal keyword disabled, Collider retained.
- `unity-gold-near.png`, `unity-seven-reloaded.png`: representative offscreen Editor images of the formal importer result. Studio conditions use dedicated lighting, shared artistic reflection and ACES, not a claim that every target map will look identical.
- `map-context-checks.json`: bounded records from isolated existing grassland and cave generation, seed 71421. Baked Reflection Probe and receiver evidence. Actual game source/scene/settings files were read-only and unchanged. Game assets and private workstation locations are not included.
- `web-checks.json`: compact results from the self-contained publication-candidate Web suite. Full local screenshots/logs are retained outside the public tree.

Editor results are carried forward by exact product-byte parity, not described as newly rerun on a renamed commit. No final Player build/runtime result exists. The reflection setup belongs to review scenes; the importer does not install it into a target scene. See `docs/CHEST_RELEASE.md` for reproduction and limits.
