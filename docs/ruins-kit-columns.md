# Ruins kit: weathered column variants (local candidate 18)

Two additional structure kinds complement, rather than replace, existing generic column and archgate props:

- `pier`: square column with integrated base/capital. Default height 3 m, 746 triangles.
- `pier_broken`: standing broken shaft/base, no intact capital. Default height 1.8 m, 372 triangles.

Both occupy a 1 x 1 m base, permit height 1.2 to 4 m, and use the shared aged limestone material/three 512 px maps. Footprint/free scaling is deliberately unavailable. Horizontal grid snap and 90-degree rotation are supported; there are no side-join or stacking sockets. These are freestanding columns, not structural supports that automatically move adjacent walls or beams. The exact exposed convex pieces drive both Web collision/surface queries and exported Unity MeshColliders. Independent base/shaft/capital pieces now provide a separate typed stack; see ruins-kit-column-parts.md. These old integrated piers still have no stacking or side-join sockets. Existing generic arches remain unchanged.

Exposed old edges have varying wear width and occasional impact chips. Remaining worked planes are broad; the broken crown has distinct sharp fracture planes. Texture patches stay within valid stones, avoiding false mortar across each shaft block. Identical columns share Web geometry regardless of saved ID; Unity reuses mesh/material references. The patch selection remains deterministic. Existing wall stones now select different atlas patches; this reduces immediate repeated motifs but does not remove the underlying finite atlas or repetition of identical modules.

Update the local ruins module/app and RuinsStructureImporter together. Save files keep the existing ruins v1 typed structure contract. The prior importer whitelist rejects unknown column kinds; do not use old readers to import these additions. This is source-flow evidence, not an old binary compatibility claim. Export again and import into a new output folder in the dedicated project; do not overwrite an existing user's Scene/Prefab. No original-game host integration or public deployment was performed.

Regression evidence is in the local continued-review report. Tests include formal archive reload/Undo/cancel/walking, default and boundary heights, exact mesh winding, Web/native surface probes, Prefab/Scene reload, material channels, and reference sharing for 9 and 225 identical instances. Reference sharing is not a GPU/mobile performance measurement. Native batchmode renders do not establish Player or original-game correctness.
