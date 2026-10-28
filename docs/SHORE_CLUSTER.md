# Rounded shoreline cluster

The existing `shells` placement is still one starfish and four pale shells. Rectangular arms become a continuous rounded five-arm body; crude half-spheres become ribbed fan valves with a hinge recess and closed, thick edges. A single authored 128x128 opaque atlas adds organic granules and concentric growth marks. It is generated deterministically from the source recipe, without external imagery or a new shader. The other individual scallop/cowrie/shell-fragment entries are unchanged.

ID, asset key, category, beach tag, placement settings and nonblocking collision remain unchanged. The nine stable part IDs are preserved. The starfish now fits one combined support plane so adjacent arms cannot split on uneven terrain; the four shells still fit independently. This rule is opted into by this geometry only. Overall scale/use is retained; sculpted bounds change from approximately 0.647x0.0325x0.421m to 0.599x0.030x0.433m. No placement coordinates or saved instance IDs are migrated.

## Texture and reader contract

The optional asset `surface` and per-part `uv` extend grounded_props.json version 1. They do not change required fields. The current Reader validates the atlas identity, encoding, 128px header/decode, UV range and budget. Missing/invalid texture information falls back to vertex colours while retaining geometry and placement. A frozen pre-change Reader imported the new payload and ignored these optional fields successfully. Web uses image-oriented UVs; Unity flips V. Normal directions and Z/winding conversion follow the existing grounded export.

Normal, ghost and placement-preview paths use the same opted-in shared material. Native combines the nine parts into one renderer per placed cluster, with no runtime component and no Collider. The new surface reuses the immutable image cache.

## Measurements and review

One cluster is 1,216 triangles, up from 220; the first 1,968-triangle trial was reduced before adoption. The generated PNG is 20,180 bytes. Unity reported 157,192 bytes for the texture object and its runtime storage (not a GPU-only measurement). No normal map or additional light is introduced. The bounded Web check used 1/50/0/50 clusters: the 1 and 50 cases both used 13 total scene draw calls, with one cluster material/map and a constant 31 total scene textures. Fifty clusters submitted 70,418 scene triangles. CPU submission medians were about 1.9-2.0ms on the test machine; these are short samples, not GPU timings or a mobile performance guarantee.

Web checks save/reload, nine part IDs, Collider parity, unchanged unrelated small-prop payload, positive signed volume, valid UVs and support penetration no more than the intentional 1mm sink. Starfish part matrices now agree exactly on the rough-ground fixture. Unity 6000.5.9f1 / URP17.5 checked old/new, absent map, invalid UV, invalid PNG and frozen old Reader imports. World placement matched export within 0.02mm. The same texture was reused on another import.

Actual pixels were reviewed in the editor's coast tool, dedicated Unity close/opposite light, and the existing grassland generator at seed 71421 with its normal camera. An inward-facing rim found in the first Unity render was corrected before adoption. The distant cluster remains a small background prop; fine granules naturally disappear at that distance. It is a stylized asset, not a species-specific anatomical model. Original game scenes were not saved. Player builds, complete gameplay and native GPU timings remain untested.

## Reproduction

Set SHORE_REVIEW_OUT and SHORE_REVIEW_PROJECT (a dedicated review project), then run `node tests/shore-cluster.cjs`. It serves baseline ba3c929 and the current tree and writes Input96-before/after under the review project. Run `node tests/shore-cluster-load.cjs` for the bounded placement check. Copy tests/unity/Shore96Checks.cs to the dedicated project's Editor folder and run `python tests/prepare-shore-cases.py <review-project>`. The test freezes the earlier Reader from Git. Use fresh generated test output folders when replaying its Editor imports, then execute Shore96Checks.Run in background Editor batchmode. No Player executable is needed.

Silver/gold/rainbow presentations, grave stone footing with no soil skirt, and the sea-life palette classification remain intact. See release.json for the delivered script hashes; deployment is checked separately from these local tests.

Integration note: main advanced to 2b35af4 during publication preparation. Its water-boundary and continuous-wave changes were retained in a normal merge. Only the app script-version line conflicted; both the new water version and current content hash are preserved. The shoreline material changes do not alter that water algorithm.

After this merge, the bounded water-side/wave regression and shoreline save/export/GL checks passed again. The shared water HLSL sync check passed. Native shoreline code and assets are byte-identical to the Editor-tested revision, so those imports were not duplicated.
