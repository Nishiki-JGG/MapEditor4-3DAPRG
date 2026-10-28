# Prismatic chest presentation

The rainbow chest uses the accepted royal chest structure with a central cut crystal, four smaller crystals and raised crown supports. Rainbow panels, platinum framing and relief remain distinct. Thirty-six HDR motes and three moving, unshadowed point lights per nearby chest produce the requested stronger-than-gold radiance. The shared rainbow light pool serves the nearest two chests, fades over 14–20 metres, and never enables more than six lights. Gold and silver share a separate eight-light maximum.

## Data and compatibility

`props/chest-sanctum-data.js` is the authoritative authored mesh source (four groups, 10,323 vertices / 5,148 triangles). The crown is actual geometry; crystal depth is an opaque, view-dependent internal-cut approximation, not physical transmission/refraction. Existing gold relief normal/AO maps are reused; no new raster maps are introduced.

Web exports the optional `chestSurfacesV1.sanctumV1` descriptor. Positions, normals, tangents and winding are converted from Web Z to Unity Z, including tangent handedness. Native validates identity, budgets, finite values and indices before applying the optional presentation. Legacy root, ID, placement, Collider and all other descriptors remain identical. Old readers ignore the extension and retain the old rainbow appearance. Missing or invalid optional data produces a warning and the old appearance, without stopping the other 42 prefabs. Missing relief maps use flat relief shading.

The normal/AO maps share the gold import cache; normal is linear and the native converted mask uses G for occlusion. AO affects indirect lighting, not crystal emission. The standard URP PBR path supplies direct and probe reflection. A scene's reflection probes/lighting remain necessary; the importer does not modify scene environment or add a global exposure effect. Web uses a single shared artist reflection map when no scene environment exists. Web and Unity are visually related, not pixel-identical renderers.

## Validation and reproduction

Set `CHEST_REVIEW_OUT` and run `node tests/chest-sanctum.cjs`. It serves the previous silver-fix commit and the current tree, checks seven chest save/reload, missing/corrupt optional data, identical legacy payloads, shader/GL errors, repeated 1/5/0 chest placement, bounded lights and 24 GPU timer samples per representative count. Export files are written to the output's `export` directory.

For the retained Editor regression harness, copy that export to the dedicated review project's `Input94`, run `python tests/prepare-sanctum-cases.py <review-project>`, and place `tests/unity/Sanctum94Checks.cs` in its Editor folder. The harness uses the previously validated `Assets/Imported89` legacy baseline and `Assets/Imported92` silver baseline; it does not provision or alter a user's game project. Run `Sanctum94Checks.Run` in background Editor batchmode. The retained result covers normal plus four invalid/missing cases, each generating 43 prefabs, shared texture references, unchanged collision/silver, gold's two lights and rainbow pool cleanup. Use fresh dedicated output folders when replaying multiple independent cases in one Editor session.

Unity 6000.5.9f1 / URP 17.5 compiled and rendered the formal imported prefab. Close/opposite light and the existing seeded grass/cave generator environments were captured at identical cameras, including four timestamps. Original scenes were not saved. The crystal gained deep violet and bright facets without reducing body emission. Some platinum surfaces remain deliberately bright; this is a stylized magical chest, not photoreal refraction.

See `tests/CHEST_SANCTUM_RESULT.json` for measured results. GPU timing is Web-only: 1/5 chests measured 2.28/2.83 ms median over 24 samples, versus 4.07/3.14 ms for the older model. This short sample does not establish a general speed improvement. CPU submission was 3.90/5.20 ms versus 3.30/2.60 ms. Renderer texture count stayed constant when increasing from one to five chests. Native GPU timing, Player builds and complete game sessions remain untested.

This presentation is included in the silver/prismatic release. Gold and ruby remain unchanged. See CHEST_SILVER_SPARKLES.md for the later silver FX extension and delivery checks. The separate redesigned silver candidate is not included.
