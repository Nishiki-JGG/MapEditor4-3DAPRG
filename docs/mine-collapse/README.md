# Collapsed rock wall: accepted release

Independent review of candidate f560355: 91/100 (appearance 26/30, material 17/20, structure/placement 19/20, Web/formal Unity 20/20, cost 9/10), with no identified P1/P2 in the reviewed scope.

## Use

Select the collapsed wall in the mine props category. This is a manually placed remnant wall with matching fallen rock, not an automatic destruction system. Place its rear into a compatible rock wall, align the base to the floor, and rotate it to leave the intended passage clear. Its footprint is about 2.32 by 2.28 metres and height 1.78 metres; narrow supported mine corridors require deliberate placement. It does not automatically conform to slopes or remove existing walls. Shape collision follows the existing catalogue setting; custom radius/non-solid settings retain the visible asset. Existing object IDs and fixed samples are unchanged.

The asset has 162 triangles and eight closed volumes. Matching major fracture planes connect the standing remnant and low fallen block. Rock050-derived colour, normal and packed maps provide the rock surface. License, original/derived hashes and reproduction are documented in ROCK050.md and rock050-provenance.json. The bundled asset requires no external texture service. The loader awaits a bounded decode before exporting and falls back atomically to valid procedural maps on failure.

## Unity import

Export the current map and use the supplied MapSharedProps importer in a Unity 6 URP project. Import into a new output directory when comparing with old Prefabs. The optional mineCollapseV1 block creates a standard URP/Lit Prefab with sRGB colour and linear normal/packed data. Packed channels are R metallic, G occlusion, A smoothness. Existing fallback validation isolates absent/invalid optional data from older assets. Illumination and reflection depend on the destination scene; no production game scene is modified by this release.

## Validation and provenance

Candidate162 was tested with the real Web loader and formal Unity 6000.5.9f1 / URP17.5 background Editor: 51 small Prefabs, previous 50 meshes/actual Colliders preserved, saved/destroyed/reinstantiated materials and transforms, product mine tunnel and generated cave seed71421. Existing 20 cave-decoration integration and 11 invalid/missing/custom optional cases reuse unchanged-reader evidence from144; the full combined71 generation was not repeated in162. Evidence summaries are integration162.json, contract144-persisted.json and formal-library144.json. Their historical pending-review status refers to the time they were captured; independent acceptance followed.

The publication integrates only accepted files onto main d9ed98e, retaining its demand-based prop allocation, cliff/water work, guides and expanded Ctrl-wheel input. Final Web checks are recorded in publication163.json. The final export's three PNG hashes match the formally imported162 maps exactly. Native product source, accepted geometry and map data are unchanged; the existing Editor evidence is reused rather than labelled a new Editor run. Fixed sample entries and complete bundles remain byte-identical to that latest main; generation count0. Trial histories and full-resolution review images remain local.

Reproduce portable checks with node tests/mine-collapse-material.test.cjs, tests/mine-collapse-fracture.cjs, tests/mine-collapse-material-browser.cjs, tests/mine-collapse-material-cache.cjs and tests/mine-collapse-placement.cjs. The full tests/mine-collapse.cjs harness also needs MINE_COLLAPSE_PROJECT pointing to the existing isolated fixture (Input139 baseline); MINE_COLLAPSE_OUTPUT chooses the local evidence directory. Unity helpers need the isolated review fixture and its existing support classes, not a user's live scene. Use only an authorized background Editor; Player is outside the validated scope.

## Limits

Near texture softness, visible UV transitions, some weathered grain on fresh break faces and conspicuous sharp face divisions remain deductions. Wall/floor embedding is manual. Native9/225 instances share one mesh, one material and three textures (mesh73512B; textures4022549B). These CPU submission tests do not establish GPU or full-frame performance. Mobile, Player, old Reader binary and a complete game session were not executed. The retained source-flow/backward-data checks are not presented as old binary execution.
