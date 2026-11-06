# Ruins kit: thin stone paving (local candidate 23)

`paving` and `paving_broken` complement the existing raised platform and edge pieces. They do not replace terrain painting, old platforms, generic props or saved maps. A complete modular pillar already includes its base/capital; separately stackable column components remain future work.

Each paving module is 2 x 2 m and 0.12 m high. Length, width and height controls are locked. Four edge-center sockets use the existing grid/part-snap controls and 90-degree rotation. Paving sockets only match paving, never wall sockets. Different rotations can vary the visible pattern. There is no automatic trimming against walls, terrain reshaping, slope fitting or arbitrary resizing.

The intact module has four unequal worked slabs with worn upper edges and occasional corner loss. The broken module adds a split slab and missing outer corner. Broad worked surfaces remain. Both reuse the existing aged limestone atlas, materials and normal/roughness maps. Default counts are 180 and 237 triangles. Repeated identical modules share mesh/material references; performance on GPU/mobile/Player has not been measured.

Paving may be placed on a flat ground surface or supported by an existing platform. It does not support another structural layer or establish new pillar/wall stacking. Dependent platform validation and atomic deletion/height edits remain in force. The existing soil remains visible in joints/missing corners. No hidden surface fills those holes.

Web floor heights derive from the visible triangles. As with stairs/platforms, low paving is handled by floor/step movement rather than treated as a full-height wall at narrow joints. The authoring validator rejects an agent maxStep smaller than the fixed 0.12 m thickness. Native Unity uses the same exported triangles for MeshCollider and tests actual CharacterController crossing with 0.3 m step offset. This is single-layer ground decoration, not a ceiling/bridge implementation.

Save IDs are new kinds under ruinsStructuresV1. Update the local module/app and importer together, export again and import to a new output directory. Previous source whitelists reject unknown kinds; old binary Readers have not been executed. Original game and public deployment are outside this batch.

Limits: module repetition remains possible over a large uninterrupted floor; rotation and the damaged variant help but do not create an unlimited atlas. Localized fracture facets are visible very close up. Floor variants are intentionally shallow and do not form deep pits. Pillar-to-wall auto-join, independent stacked capitals/bases and automatic tile clipping remain unimplemented.
