# Optional decorated raised floor and low edge

Two selectable decorated variants extend the existing `platform` and `edge` kinds. The plain/worn versions and old placements remain unchanged. Damaged decorated walls already exist, so this increment fills the previously undecorated raised-floor perimeter instead of duplicating them.

The platform has worn recessed lozenges within the upper masonry courses on its vertical worked faces. Its top, worn silhouette, bearing patches, terrain coverage and walk surface are unchanged. The lower facade stays quieter masonry. The low edge has a recessed side band and paired worn top borders. Broken/recessed surfaces retain the existing irregular stone. This is shallow normal-derived relief, not additional physical holes or raised molding.

Select **装飾：高床・垂直側面** or **装飾：床縁** in the decorated parts group. A platform uses the existing flat-ground/rectangular footprint contract. Select a platform as support to put the edge on its top, keeping the full 0.5m-wide edge inside the support boundary. Existing endpoint/grid snapping joins adjacent equal-height edges; the system does not automatically surround a platform or create corner trim. Existing support height following, stairs clearance, atomic failure, save and Undo rules apply.

No geometry, Collider, texture image, material count or renderer is added when changing the same object from plain to decorated. Equal decorated instances share meshes/materials. Extra shader arithmetic remains unmeasured on GPU/mobile. The upper masonry insets use the existing stone UV patches so lower masonry and bevel textures remain unchanged. The low edge has a two-metre bay rhythm; very short pieces can carry only the border. Tall platforms confine ornament to upper courses rather than stretching a medallion over the entire height.

Update Web module/app/surface shader and Unity importer/shader together. Formal export keeps `ruinsStructuresV1` and the explicit `carved` finish. The previous source rejects the newly supported finish/kind combination; an old Unity binary is not executed. Import to a new destination. No original-game integration or public deployment is part of this work.
