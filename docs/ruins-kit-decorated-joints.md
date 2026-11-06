# Decorated connection pieces and stairs — local candidate29

Five additional choices in the optional decorated-parts group: inner corner, outer corner, T-junction, end cap and stairs. Existing stone/worn parts and all nine earlier carved choices remain unchanged. No map is automatically converted.

Narrow connection pieces carry the same two worn recessed stone bands as the adjacent wall. They do not carry an oversized wall medallion. Stairs use worn riser panels, a rising side band and two tread-side borders; the centre and worn nosing remain readable. These are normal-derived shallow stone engravings, not raised geometry or physical holes. Use the usual grid and part-snap controls; select an upper platform before placing stairs.

Existing dimensions, sockets, weathered mesh, collision and support rules are retained. Inner and outer corners retain the pre-existing footprint/geometry convention; this batch does not invent a second incompatible corner standard. Precision contact faces remain geometrically exact. High stairs do not tag the hidden rear support face as a riser. No automatic neighbour following or stacking was added.

The shared carved material uses the existing three512px maps. No extra materials, textures, triangles or renderers are needed for changing a supported plain part to its carved variant. Shader branches and arithmetic increase; GPU/mobile performance is not measured.

Validation covers old meshes, old carved variants, four rotations of each new part, closed-loop and T-snap tests, floor/collision comparisons, UI selection, save/Undo/reload, formal Unity import, actual Collider mesh, CharacterController stair ascent/descent, Prefab/Scene material reload and Forward/Forward+ lighting. Exact executed results and images are retained in the task workspace. The previous JavaScript source rejects these carved kind combinations; an old Unity binary was not executed. Update exporter, importer and shader together.

Independent column bases/shafts/capitals and their restricted typed stack are now available separately; see ruins-kit-column-parts.md. Still absent: automatic pier-to-wall connections and sculptural deep relief. Decorated raised floors and low edges are now separate optional choices; see ruins-kit-platform-ornaments.md. No original-game integration, Player build or public deployment is performed.
