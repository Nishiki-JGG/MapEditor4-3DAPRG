# Independent column base, shaft and capital

Local extension; existing integrated piers and saved placements remain unchanged.

| Part | Actual dimensions | Default triangles |
|---|---|---|
| `column_base` | 1 m square footprint, 0.34 m high | 168 |
| `column_shaft` | 0.62 m square shaft; 1 m placement module; height 1.2–4 m (default 2.28) | 388 |
| `column_capital` | 1 m maximum width, 0.38 m high | 190 |

Each is selectable plain, worn or carved; all share the existing three 512 px maps. The decorated base/capital use a worn diamond frieze, bands and top-perimeter framing outside the central bearing square. The shaft has a framed panel and central diamond. Old worked edges retain selective wear; protected support planes remain exact. These pieces reuse the established integrated-pier stone geometry so the kit stays consistent.

Place a base on flat ground or a supported platform. With **part join ON**, hover near its centre to fit a shaft, then fit a capital to the shaft. Join radius is 0.55 m; only base→shaft→capital is valid. Grid ON additionally requires the parent centre on the fixed 0.5 m grid. The typed centre join takes priority over horizontal wall sockets and is shown in the placement reason. No join to integrated old piers or to walls is added. With join OFF each piece is a separate ground/platform object (a detached capital may be placed as an architectural remnant).

`mountId` is the authoring relation; child X/Z and bottom Y derive from the parent's resolved centre and top. Moving the base moves its fitted stack; changing shaft height lifts the capital. Child rotation remains independent in 90-degree steps. The entire proposed model is validated before commit; an obstacle, invalid support, occupied mount, off-grid join or bounds conflict cannot leave a partial move. A support with mounted children cannot be deleted until its children are removed or relocated. Undo/redo restores the whole authoring model. No general-purpose stacking, platform-on-column, beam support or automatic wall following is implemented.

The assembled default is 3 m high and 746 triangles across three renderers, versus the existing integrated pier's one renderer. Use integrated piers for repeated complete identical columns; use the split set when independent finish/height/placement is needed. Repeated equal pieces share mesh/material references. There is no new texture or material, but separate parts increase draw candidates. GPU/mobile timing is unmeasured.

Export bakes the resolved placements and meshes into the existing `ruinsStructuresV1` contract, retaining authoring for Web saves. The old JavaScript reader rejects the new kinds; the prior Unity importer whitelist rejects them instead of silently omitting them. Old binaries are not run. Update module/app/Importer/shader together and export to a new import destination. No original-game or public deployment is included.

Validation results are kept in the task evidence. Do not equate technical tests with independent art acceptance.
