# Chest authoring sources

The shipped `props/chest-*-data.js` descriptors contain the authoritative reviewed PNG payloads. Normal application/export does not run the authoring scripts. No reference-image pixels or third-party game assets are included here. Procedural visual geometry is in `props/chest-royal-geometry.js` and `props/chest-worn-geometry.js`; IDs and collision geometry remain separate.

To extract the exact shipped maps without regeneration:

```sh
node tools/chest-authoring/extract-shipped.cjs <new-output-directory>
```

Authoring recipes:

| Source | Inputs and purpose |
| --- | --- |
| `relief-bake.py` | Blender Python: creates the detailed central/side/lid relief and low mesh; bakes tangent normal and AO. Set `CHEST_BAKE_OUT` to a dedicated output folder. |
| `finish-map.py` | Blender Python: uses the same relief functions to produce the reviewed intrinsic colour/roughness finish image without rebaking normal/AO. Uses `CHEST_BAKE_OUT`. |
| `silver-atlas.py`, `rainbow-atlas.py` | Python + NumPy + Pillow. Set `CHEST_EXPORT_INPUT` to exported `small_props.json`, `CHEST_AUTHOR_OUT` to a dedicated folder. The corresponding legacy root meshes/ornaments provide the part masks. Includes the reviewed outer-halo reduction. |
| `legacy-gold-atlas.py` | Python + NumPy + Pillow. Set `CHEST_AUTHOR_OUT`. Uses only the bounded legacy gold mesh and accepted packed-map seed in `inputs`. This preserves the earlier optional/fallback surface, not the new royal geometry. |
| `legacy-gold-lid-finish.py` | Set `CHEST_GOLD_ATLAS_INPUT` to the previous recipe output and `CHEST_AUTHOR_OUT` to another folder. Produces the accepted local packed-map finish and combines it with the shipped colour descriptor. |
| `worn-textures.js` | Browser authoring hook: call `ChestWornWeather.board` for each board created by the worn geometry in the established order; retrieve its colour/roughness canvases. Runtime uses the reviewed descriptor instead. |

Run Blender recipes only in a disposable background/factory-startup Blender process: they replace the in-memory scene and save a working `.blend` into the specified output folder. They do not modify product files. Do not run them in an open user scene. Full bakes and working `.blend` files are deliberately not bundled; source geometry/functions plus the accepted runtime maps are retained. No new full bake was needed for publication.

These are authoring sources, not a one-command automatic production replacement. Review generated images and mesh/UV/tangent compatibility before replacing any descriptor. Blender bake pixels may vary across versions. The extracted shipped maps are the exact source for reproducing this release. Runtime low geometry/tangent fixes in `chest-royal-geometry.js` take precedence over historical authoring low meshes. All colour/data channel contracts are described in `docs/CHEST_RELEASE.md`.

Publication validation: the generalized gold fallback, silver and rainbow recipes were executed against their source geometry; all six colour/packed maps were pixel-identical to the shipped payloads. Eleven embedded PNGs were extracted and decoded successfully. The full Blender bake was not rerun for packaging.
