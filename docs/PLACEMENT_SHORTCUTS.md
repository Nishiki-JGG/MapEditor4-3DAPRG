# Placement shortcuts

In Edit mode with the Place tool selected:

- Ctrl + wheel up increases placement size; down decreases it. Only a wheel event on the canvas is consumed. The existing size range is0.4–2.5 in0.05 increments, obtained directly from the range control rather than duplicated bounds.
- Q decreases orientation by15 degrees; E increases it by15 degrees. Orientation wraps over0–345 degrees, using the existing slider's step and range.
- R retains the existing45-degree shortcut. Slider inputs and these shortcuts use the same placement state and refresh the preview.

Text inputs, selects, textareas and editable content retain Q/E typing. Modified keys and composition do not rotate the placed object. Q/E retains camera rotation in other tools and Walk mode. A Q held while switching to Place does not continue to turn the edit camera. Ordinary wheel camera zoom and Shift + wheel brush-size adjustment remain unchanged. Ctrl + wheel outside the canvas, outside Edit/Place, or during map preparation is not consumed by the new shortcut.

The existing random-placement checkbox remains available. With randomness disabled, preview size/orientation and actual placement match exactly. With randomness enabled, its existing small scale variation and next-item orientation update remain intentional. Placed-object storage and export formats do not change.

## Validation

`node tests/placement-shortcuts.cjs` uses an isolated headless browser and local server. Set `PLACEMENT_REVIEW_OUTPUT` to choose its evidence folder; optional `PLACEMENT_REVIEW_URL` runs the same check against an explicitly approved deployed page. It checks26 event/scope cases, including no ground hit, type/mode switches, repeat input, bounds, wrapping, editable focus, ordinary zoom and walking controls. Browser-protocol wheel/key/click events additionally verify unchanged viewport zoom, normal preview and actual placement equality. A nine-part grounded preview matches the placed matrices, and saved placements restore exactly. Console and WebGL checks pass.

The initial test-server404 failure was corrected in the harness only. No user-visible browser or input focus is operated. Unity product files and assets were not changed; no new Unity/Player validation is claimed for this Web-only input change.
