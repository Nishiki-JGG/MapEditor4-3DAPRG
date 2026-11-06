# Low stone edge connectors

Two independent types: `edge_corner` (L corner) and `edge_end` (closing cap), each with plain stone, worn, and carved finishes. Existing walls/corners/ends and saved placements are unchanged.

The corner has sockets at local (0.5,0) and (0,0.5); the end has one socket at (0,0), with a 0.25 m closure beyond it. Both use the straight edge width 0.5 m and editable height 0.1–1 m. Plan dimensions are fixed; rotation uses 90 degree steps. Joining is placement-time only. A 0.5 m grid fits these sockets. No automatic perimeter or beam/bridge support is provided.

Carved top borders turn at corners and close at caps; side engraving reuses the existing edge band. Original stone UVs and the shared maps/material are retained. New pieces use the existing weathered stone generation and conservative obstacle boxes; they do not create a walkable raised floor. Supported placement uses an existing platform, including height edits and delete validation.

New kinds require the updated `RuinsStructureImporter`. The version remains the existing required `ruinsStructuresV1` contract; the prior JS validator rejects unknown kinds and the prior Unity whitelist rejects unknown kinds. An old binary was not executed.

Validation and exact counts are recorded in the accompanying trim35 local evidence; GPU/mobile/Player performance is not measured. No publication or original-game integration is included.

## Final validation notes (candidate36)

Low-height parts now use bounded wear fading toward sockets, rather than the large losses used by full-height walls. Candidate35 was rejected visually for thin raised collars. The old generator produced the same platform bearing geometry under the same support footprints; changing the test arrangement intentionally changes that platform support surface. Physics probes were regenerated from the final arrangement rather than reusing older placement samples.

The representative U-shaped frame adds two corners, two caps, and two existing straight edges while shortening/repositioning one existing edge. All 61 pre-existing kind/finish mesh cases remain exact. Grid/join checks include a 4-corner loop, 24 rotated/height cases, and 10,584 collision comparisons. Actual headless pointer placement, supported height editing, parent-delete rejection and Undo pass. Native endpoint checks use 36 rays across six joints. The floor border is a low obstacle, not a safety railing; jump/step behavior in an original game's controller is outside this dedicated validation.

The kit does not yet provide a horizontal stone beam, automatic full-perimeter generation, diagonal connectors, or variable trim width. Reuse a rotated L corner for either turning direction; a separate duplicate inner/outer SKU is unnecessary for this symmetric low edge profile.
