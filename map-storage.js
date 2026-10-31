(function(root) {
  'use strict';
  const sharedNames = new Set(['shared_props.json', 'shared_ground.json', 'pine_wind.json', 'cliff_sources.json']);
  const enc = new TextEncoder();
  const bytes = d => typeof d === 'string' ? enc.encode(d) : d;
  function partition(input, sha) {
    const local = [], shared = [];
    for (const f of input) {
      if (f.name === 'manifest.json') continue;
      if (sharedNames.has(f.name)) shared.push(f);
      else if (f.name === 'small_props.json') {
        const d = JSON.parse(typeof f.data === 'string' ? f.data : new TextDecoder().decode(f.data));
        // Tint and terrain-fitted parts belong to this room, never to the common library.
        const { instances, grounded, ...library } = d;
        shared.push({name:'small_props_library.json', data:JSON.stringify(library)});
        local.push({name:f.name, data:JSON.stringify({version:d.version, units:d.units, axes:d.axes,
          library:'small_props_library.json', instances, grounded})});
      } else local.push(f);
    }
    shared.sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const files = shared.map(f => ({name:f.name, bytes:bytes(f.data).length, sha256:sha(bytes(f.data))}));
    const bundleHash = sha(enc.encode(['tdj-shared-assets/1', ...files.map(f => `${f.name} ${f.sha256}`)].join('\n')));
    const descriptor = {format:'tdj-shared-assets', schemaVersion:1, bundleHash, files};
    const ref = {name:'shared_assets.json', data:JSON.stringify(descriptor)};
    if (shared.length) local.push(ref);
    return {files:local, sharedFiles:shared.length ? [...shared, ref] : [], bundleHash,
      sharedName:`tdj-shared-${bundleHash}.zip`};
  }
  function manifest(files, previous, sha) {
    const listing = files.map(f => ({name:f.name, bytes:bytes(f.data).length, sha256:sha(bytes(f.data))}));
    return {...previous, schemaVersion:4, files:listing,
      contentHash:sha(enc.encode([previous.exporterVersion, ...listing.map(f => `${f.name} ${f.sha256}`)].join('\n')))};
  }
  const api = {partition, manifest};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TDMapStorage = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
