# Round silver trim correction

The existing round silver chest retains its shape, blue stone, lock and ornament. The two thin dark straps are removed from both visual mesh layers and the intrinsic atlas. The two outer broad hoops and their front/back continuations use dark silver. The unpublished replacement silver structure is not included.

The visual root loses 296 triangles and the ornament loses 392. Exported legacy root, collision mesh, identifiers and placement remain unchanged. Old readers retain their original root fallback. Gold, rainbow and other asset/effect descriptors are unchanged. The silver atlas was authored using the same recipe with removed ink triangles omitted; resolution and texture count are unchanged.

Validation: set CHEST_REVIEW_OUT and run tests/chest-silver-trim.cjs. It compares current output against e7baefa, checks seven saved chest types, absent optional maps and identical unrelated descriptors. Unity 6000.5.9f1 / URP 17.5 generated 43 prefabs, preserved the cached silver collider and gold's two lights. Dedicated background Editor renders checked close view and existing seeded grass/cave layouts. Source game scenes were not saved. No Player build or executable was run.

Local review only; publication is pending. The separate rainbow presentation is now integrated as an unpublished optional extension; see CHEST_PRISMATIC_PRESENTATION.md.
