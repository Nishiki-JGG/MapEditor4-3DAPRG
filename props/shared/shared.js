// Small synchronous adapter: file:// remains supported. Both engines consume assets.js data.
(() => {
'use strict';
const data = window.TDSharedData, materials = new Map(), ghosts = new Map(), textures = new Map();
if (!data || data.schemaVersion !== 1) throw new Error('Shared props: unsupported data');
const asset = id => {
  const a = data.assets.find(a => a.id === id);
  if (!a) throw new Error('Shared props: missing asset ' + id);
  return a;
};
function geometry(id) {
  const a = asset(id), g = new THREE.BufferGeometry();
  // Reflection changes handedness: reflect positions/normals AND reverse each triangle.
  for (const [key, src, n] of [['position', a.positions, 3], ['normal', a.normals, 3], ['color', a.colors, 3], ['uv', a.uv, 2]]) {
    const v = Float32Array.from(src);
    if (key === 'position' || key === 'normal') for (let i = 2; i < v.length; i += 3) v[i] = -v[i];
    g.setAttribute(key, new THREE.BufferAttribute(v, n));
  }
  const indices = a.triangles.slice();
  for (let k = 0; k < indices.length; k += 3) [indices[k + 1], indices[k + 2]] = [indices[k + 2], indices[k + 1]];
  g.setIndex(indices);
  if(a.motionWeights)g.setAttribute('plantWeight',new THREE.Float32BufferAttribute(a.motionWeights,2));
  g.computeBoundingBox(); g.computeBoundingSphere();if(a.motionWeights){const pad=a.wind.maxDisplacementMetres+a.contact.maxDisplacementMetres;g.boundingBox.min.x-=pad;g.boundingBox.min.z-=pad;g.boundingBox.max.x+=pad;g.boundingBox.max.z+=pad;g.boundingSphere.radius+=pad;}
  return g;
}
function material(id, ghost = false) {
  if (ghost) {
    if (!ghosts.has(id)) { const m = material(id).clone(); m.transparent = true; m.opacity = .28; m.depthWrite = false; if (m.alphaTest) m.alphaTest *= .25; if(id==='pine'||asset(id).wind) TDPineWind.attach(m,asset(id).wind||null,!!asset(id).motionWeights); ghosts.set(id, m); }
    return ghosts.get(id);
  }
  if (materials.has(id)) return materials.get(id);
  const a = asset(id), d = a.material, tx = data.textures.find(t => t.id === d.texture);
  let map = textures.get(tx.id);
  if (!map) {
  map = new THREE.TextureLoader().load('data:image/png;base64,' + tx.png);
  map.colorSpace = THREE.SRGBColorSpace; map.flipY = true;
  map.wrapS = map.wrapT = tx.wrap === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  map.generateMipmaps = !!tx.mipmaps; map.minFilter = tx.filter === 'trilinear' ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; map.magFilter = THREE.LinearFilter;
  map.anisotropy = tx.anisotropy || 1; textures.set(tx.id,map);
  }
  const m = new THREE.MeshLambertMaterial({map, vertexColors: true, color: new THREE.Color().fromArray(d.baseColor),
    alphaTest: d.alphaCutoff, side: d.doubleSided ? THREE.DoubleSide : THREE.FrontSide});
  if(id==='pine'||asset(id).wind) TDPineWind.attach(m,asset(id).wind||null,!!asset(id).motionWeights);
  m.name = data.libraryVersion + '/' + id; materials.set(id, m); return m;
}
window.TDSharedProps = {asset, geometry, material, data, exportJson: () => JSON.stringify(data)};
})();
