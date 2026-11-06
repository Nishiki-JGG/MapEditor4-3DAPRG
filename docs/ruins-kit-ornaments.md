# Optional carved ruins parts — local candidate 28

The type menu has a separate **装飾された遺跡部材** group. It selects the existing structural kind plus `finish: "carved"`; plain stone/worn parts remain available and saved maps are not rewritten.

Initial four families, nine choices (extended to nineteen by decorated connections/stairs, independent column parts and platform/edge variants; see ruins-kit-decorated-joints.md and ruins-kit-column-parts.md):

- Walls: intact, damaged, ruined. Twin frieze grooves, occasional diamond/ring motif and a low border.
- Piers: complete and remnant. Framed shaft, diamond panel, base/capital bands.
- Arches: complete and broken. Paired arch-ring grooves and a small crown motif; opening stays clear.
- Paving: intact and fractured. A border and central diamond/ring inset, cut off by existing missing corners and splits.

These are shallow shader reliefs, not deep modeled sculpture. Existing physical weathering and broken silhouettes remain. The intentional worked-plane areas receive ornament; irregular break faces retain plain stone. Relief is worn selectively and receives the same grime/lighting as the stone. It does not emit light. The flat-ground paving from candidate23 remains 2 x 2 x 0.12 m with four edge sockets.

## Contract

The optional carved finish is valid for those nine kinds plus corner_in, corner_out, tee, end, stairs, column_base, column_shaft, column_capital, platform and edge and the existing aged-v3 surface. An unsupported finish/kind/surface is rejected before import. Older source Readers reject this unknown finish; old binaries are not validated. Update the app/module/surface shader and Unity importer/shader together, export anew and use a new import destination. No original-game or deployment work is included.

Carving uses a reserved UV range (`u=-128+panelX`, `v=64*family+16+panelY`) only on carved-part worked faces. Both Web and Unity interpret that range. It leaves geometry, normals, sockets, footprints, floor queries and Collider triangles equal to the corresponding plain `stone` variant. It does not add physical holes or raised collision detail. Only the part currently selected for editing changes; no adjacent parts automatically change or follow.

One additional shared material/keyword variant is used, reusing the same three 512px limestone maps. No new texture image or relief geometry is allocated. The shader samples a block interior for ornament panels so the texture does not paint extra mortar seams across a physical slab. The decorative scalar pattern and gradient are evaluated once per fragment and reused for albedo/normal shading; this still adds pixel-shader arithmetic. GPU/mobile performance is not measured.

## Scope and limits

- Native Forward and Forward+ are validated. Player/original game, mobile and other rendering paths are not performance-certified.
- Carved panels are shallow, not a sculpted narrative or figurative decoration set. The geometric motif family repeats over long assemblies.
- Old piers retain integrated bases/capitals. Independent base/shaft/capital pieces have a restricted typed stack; automatic pier-to-wall joining is still absent.
- Decorated corners/T/end/stairs are now available; separate statues, automatic floor trimming and deep modeled carving are absent.
- The existing 90-degree/grid/socket rules, clear arch passage, fixed paving dimensions, save/Undo and support constraints remain.

Tests and final image evidence are recorded in `ornament-final-report.json` in the task workspace. Earlier candidate24 shader compile failure was rejected and fixed; do not use those pink renders as final evidence.


## Wall readability revision 28

Wall ornament now uses broad recessed framing and a roughly 1.14 x 0.78 m lozenge centred on each segment (repeating at two metres on long walls). Profile-derived normals use a 45 mm virtual depth instead of 8 mm; the physical mesh is unchanged. The broad bevel and selectively worn field retain a large-scale highlight/shadow pattern. Broken wall geometry still truncates the design where masonry is absent. No change to plain finishes, pier/arch/paving motifs or collision.

Evidence includes an isolated intact wall, candidate26 versus28, identical camera/light and actual saved meshes; the floor has no decorative tile in this comparison. Full-room framing and opposite light are retained. A very distant whole-kit view still cannot resolve every motif. Normal relief does not create parallax, silhouette displacement or a real carved hole.
