# Silver sparkle and prismatic release

The confirmed round silver chest keeps the removed thin black straps and dark-silver outer hoops. Nine white-silver HDR motes and two unshadowed cluster lights are added. At the same phase the light intensity and peak mote colour are 60% of gold; this is a parameter ratio, not a claim of 60% perceived brightness after tone mapping. Gold retains its eighteen motes, warm lights, ruby and material. Rainbow uses the new royal-based crown, cut crystals, thirty-six motes, stronger body emission and three coloured cluster lights.

Gold and silver share a nearest-four-chest budget of eight active lights. Rainbow has a separate nearest-two budget of six. No per-particle shadow lights or scene-wide exposure changes are added. Mesh, maps and materials are shared between instances. Silver adds nine quads, no raster textures and no body geometry.

`chestSurfacesV1.silverSparklesV1` is optional and independent of the existing effect V1/V2 blocks. Missing or invalid silver data warns and leaves silver without new FX while gold and rainbow still import. Legacy root, Collider, ID, placement and old effect arrays are unchanged. Existing Unity prefabs must be exported and imported again to receive the new presentation. The separate replacement silver structure is not included.

## Verified

Web checks seven-type save/reload, exact legacy/gold/rainbow payload parity before and after the silver extension, GL errors, category uniqueness and the 1/5/0 placement light budget. Set CHEST_REVIEW_OUT and run `node tests/chest-silver-sparkles.cjs`; exports appear under its output/export folder. Its baseline is the rainbow integration commit b69a175.

For Editor regression, copy that export to Input95 in the dedicated review project, run `python tests/prepare-silver-cases.py <review-project>` and use `tests/unity/Silver95Checks.cs` in its Editor folder. It requires the previously verified Imported92 silver baseline. Run Silver95Checks.Run in background batchmode. Normal, absent and invalid silver options each generated 43 prefabs; exact round-silver mesh/Collider, gold eighteen motes, rainbow presentation and the shared light budget passed. Use fresh output folders for separate cases. Unity 6000.5.9f1 / URP 17.5 rendered the actual imported results in retained grassland and cave generation (seed 71421), plus close/opposite-light views, at four animation times. Original game scene files were not changed. Player execution, native GPU timings and a complete gameplay session were not tested.

## Other changes and delivery

The stable `shells` entry moves from the building/tools palette into the sea-life category. Its ID, beach tag, geometry and editing behavior remain unchanged. The other individual shells were already in that category.

The previous public release already contains grave soil removal and stone contour improvements. An isolated browser loaded all four grave scripts with hashes identical to the source and showed no brown soil after save/reload. The low dressed-stone footing is intentional. The user's specific display mismatch remains unexplained; old Unity prefabs require reimport. No historical geometry patch is reapplied. The obsolete soil comment is corrected.

Changed entry scripts carry content-hash query versions. `release.json` lists those script hashes for checking the delivered page. This is cache versioning, not evidence that the user's cache caused the reported mismatch. Publication is verified separately against the remote commit and Pages deployment; local test success alone does not establish delivery.
