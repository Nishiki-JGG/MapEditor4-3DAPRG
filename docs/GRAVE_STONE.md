# Worn grave stone

The gravestone keeps its arched slab and dressed-stone footing; the cross keeps its outline and lean. No soil skirt, brown mound, glow or additional cemetery decoration is added. Both stable IDs, placement metadata, height/radius and collision proxies remain unchanged.

The two previously almost coplanar inscription marks become three shallow bevelled cuts within an arched recess. The cross has a narrower recessed cross and small worn arrises. These are real geometry with darker recess material, not a painted directional shadow. Subtle, local outline wear stays within the old envelope. The original slab helper remains intact for the unrelated stele. A shared 128px stone image balances low-contrast mineral variation and sparse fine pores; it adds no map or shader slot. UVs and the existing grave-stone-grain-v1 contract remain unchanged.

Gravestone triangles rise from 192 to 284; cross triangles from 140 to 188. The single stone PNG decreases from 22,382 to 21,026 bytes. Both still share one material/texture. No extra renderer or light is required.

Web tests verified save/reload, finite geometry, metadata and Collider parity. All unrelated small-prop payloads match the baseline exactly, including the chest presentation. The grounded sidecar remains absent when no grounded objects are placed; the shoreline source is unchanged. Unity 6000.5.9f1 / URP17.5 generated all 43 Prefabs for old, new and missing-surface cases, with two grave placements in each. Collider vertices/indices match exactly; every unrelated mesh reuses the same cache object. The installed Reader source is byte-identical to baseline 5b4dbd9: the new geometry uses the existing schema, without requiring a Reader update.

Same-camera/light pixels were reviewed in Web close/normal views, isolated Unity close/opposite-light renders and the existing grassland generator at seed 71421 and its normal camera. Carving is clearer without changing the silhouette into a decorative monument. Fine grain naturally disappears at gameplay distance. Source game scenes were not saved. Player, complete gameplay and Native GPU timing remain untested. This is a stylized stone finish, not a scanned material.

For reproduction set GRAVE_REVIEW_PROJECT to a dedicated Unity review project and run `node tests/grave-stone.cjs`. Run `python tests/prepare-grave-cases.py <review-project>` and then Grave97Checks.Run in background Editor batchmode. It requires the existing importer/shaders and fresh Imported97 output folders. No Player executable is involved. See tests/GRAVE_STONE_RESULT.json for measured checks.

Water changes are outside this revision and remain unchanged. Gold, silver, rainbow, shoreline improvements, the sea-life category and soil-free graves are preserved.
