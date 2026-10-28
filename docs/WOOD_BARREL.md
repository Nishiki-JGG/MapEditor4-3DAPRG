# Coopered small barrel

Supply crate and barrel were compared under the same cameras. The crate already reads as boards, braces and nails, so it is retained. Only smallbarrel changes. The former lid had large exposed gaps and the body read as one textured cylinder with thin dark bands.

The barrel now has twelve solid 25mm staves with narrow joints and softened outer edges, a recessed circular five-board head, closed iron hoops with a small bevel and four small fasteners. Its top remains below the same 0.72m metadata height, its maximum radius remains below the unchanged 0.29m collision radius, and its lowest support is still 2mm. ID, asset key, placement settings, scale range, root and collision proxy are unchanged. No gameplay opening or storage behavior is added.

The existing shared wood atlas is reused byte-for-byte. Each stave samples a smaller region at an appropriate board-width scale; head grain follows each board, and repeated dark knot sampling is limited. Iron samples the existing white texel and uses its own vertex colour. This is a texture-coordinate/geometry improvement, not a new material/shader or new high-resolution texture. The retained style is faceted wood and matte iron, not photoreal scanning.

The first 2,180-triangle trial was reduced to 1,460 triangles (previously 300), primarily by removing unnecessary hoop/base tessellation. There are no additional textures, materials, renderers or lights per placement. Native confirms the exact same 1024x512 atlas object before/after; new texture bytes are zero.

Web save/reload, finite geometry, Collider parity and every non-barrel small-prop payload passed. Unity 6000.5.9f1 / URP17.5 generated all 43 Prefabs for both old and new exports, with two placements each. Crate/barrel Collider vertices and indices match; all 42 non-barrel meshes reuse the same cache objects. The Reader source is byte-identical to baseline 2db01c1, so the exported mesh needs no schema extension or Reader upgrade. Actual pixels were reviewed at close and normal Web distance, Unity close/opposite light, and the existing grassland generator with seed 71421 and its normal camera. Fine grain naturally disappears in the distant map view.

Set WOOD_REVIEW_PROJECT to a dedicated review project. Run `node tests/wood-barrel.cjs before` and then `node tests/wood-barrel.cjs after`. Copy tests/unity/Wood98Checks.cs into that project's Editor directory and execute Wood98Checks.Run in background Editor batchmode, with the existing importer/shaders and fresh Imported98 output folders. No Player is needed. See tests/WOOD_BARREL_RESULT.json for results. Player, complete gameplay and Native GPU timings remain untested. Original game scenes were not saved.

Water, chests, grave markers, shoreline cluster and palette classification remain unchanged.
