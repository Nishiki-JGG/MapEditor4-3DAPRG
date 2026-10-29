# Rock050 derivative provenance and reproduction

Created using Rock050 from ambientCG.com, licensed under Creative Commons CC0 1.0 Universal.

- Official asset: https://ambientcg.com/view?id=Rock050
- License: https://docs.ambientcg.com/license/ and https://creativecommons.org/publicdomain/zero/1.0/
- Official low-resolution source: https://ambientcg.com/get?file=Rock050_1K-JPG.zip
- Technique described by source: surface photogrammetry. Geological species and physical tile dimensions unspecified.2.4m here is an authoring assumption.

The official license permits modification and redistribution, including raw files in games. Download and extracted-map SHA256 values, official redirect URL and license-page evidence hash are in rock050-provenance.json. The complete9.29MB ZIP remains local and is not duplicated in this repository. No outside photograph was used as a texture.

## Derived maps

props/mine-collapse-pbr.js contains a deterministic gzip/base64 payload of three512x256RGBA maps in colour/normal/packed order. This is a redistributable runtime asset, not a network URL. Raw decoded length is1,572,864B; compressed bytes722,098; script962,970B.

The left atlas half is weathered external rock. The right half is a restrained fresh-break interpretation of the same source: lichen colour is desaturated, dark weathered fissures softened by24percent low-frequency source colour, linear colour lifted6percent, normal XY amplitude multiplied0.70, sourceAO remapped0.65+0.35AO, roughness0.15+0.85roughness. External roughness is0.10+0.90roughness. These are artistic edits, not measured geological properties. No fixed lighting/highlight or AO is multiplied into albedo.

Colour is sRGB-decoded before filtering and encoded afterwards. Source NormalGL is filtered as linear signed vectors and renormalized. Packed data are R0metal/Gao/B0/Asmoothness. Runtime Web rearranges packed channels for Three's standard material. Existing Native importer uses standardURP/Lit, linear packed data, normal-map import with the existing V/green paired conversion, and recomputed tangents. No new green flip or shader was added.

The generator requires existing Python with NumPy/Pillow. Obtain only the official1K-JPG archive and extract Color, NormalGL, Roughness and AmbientOcclusion into an input folder. Run:

```sh
python tools/build-mine-collapse-pbr.py --source INPUT_FOLDER --output OUTPUT_FOLDER
```

It verifies all four original hashes before processing, writes the runtime script plus inspectable PNG maps, and makes no network request. Copy the generated script to props/mine-collapse-pbr.js only when intentionally updating this asset, then update its cache revision and run the material tests. No special software installation or asset purchase is required.

## Loading and fallback

The script is loaded locally before mine-collapse.js. Browser DecompressionStream decodes once with fixed header, input and expanded-output bounds. Replacement is atomic after successful full decode and channel checks. Existing shared texture buffers are updated in place, including preview clones. Export awaits prepare() and writes exactly the ready buffers; missing, unsupported or invalid data retains the procedural fallback and exports valid fallback maps. No CDN or remote dependency. Native remains independent of browser decompression because export contains the normal PNG schema.

The three GPU textures and atlas resolution are unchanged. The new compressed asset and bounded transient decoding buffers are additional CPU/download costs; unchanged GPU memory is not a claim that every browser heap byte is unchanged. Canvas PNG serialization retains the previously recorded small AO quantization loss; Native uses those actual exported PNGs.
