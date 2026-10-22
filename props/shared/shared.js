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
  if(a.motionWeights)g.setAttribute('plantWeight',new THREE.Float32BufferAttribute(a.motionWeights,2));if(a.glow)g.setAttribute('sharedGlow',new THREE.Float32BufferAttribute(a.glow,1));
  if(a.rootWood)g.setAttribute('rootWood',new THREE.Float32BufferAttribute(a.rootWood,1));
  if(a.rootWeights)g.setAttribute('rootWeight',new THREE.Float32BufferAttribute(a.rootWeights,1));
  g.computeBoundingBox(); g.computeBoundingSphere();if(a.wind||id==='pine'){const pad=(a.wind||TDPineWind.spec).maxDisplacementMetres+(a.contact?.maxDisplacementMetres||0);g.boundingBox.min.x-=pad;g.boundingBox.min.z-=pad;g.boundingBox.max.x+=pad;g.boundingBox.max.z+=pad;g.boundingSphere.radius+=pad;}
  return g;
}
// 薄い葉の表裏を同じ上側の法線で照らす。樹皮・枝・根は既存の照明を保つ。
function leafLighting(m, a) {
  if (!a.rootWood || !a.rootWood.some(w => w < .5)) return;
  const compile = m.onBeforeCompile, key = m.customProgramCacheKey.bind(m);
  const declaration = m.userData.rootSurfaceSpec ? '' : 'attribute float rootWood;';
  m.userData.sharedLeafLighting = 1;
  m.onBeforeCompile = sh => {
    compile(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + declaration + '\nvarying float vSharedLeaf;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSharedLeaf = 1. - rootWood;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSharedLeaf;')
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
// SHARED_LEAF_LIGHT_BEGIN
if (vSharedLeaf > .5) {
  vec3 leafNormal = normal * faceDirection;
  normal = dot(leafNormal, viewMatrix[1].xyz) < 0. ? -leafNormal : leafNormal;
}
// SHARED_LEAF_LIGHT_END`);
  };
  m.customProgramCacheKey = () => key() + '/shared-leaf-light/1';
}
function material(id, ghost = false) {
  if (ghost) {
    if (!ghosts.has(id)) { const m = material(id).clone(); m.transparent = true; m.opacity = .28; m.depthWrite = false; if (m.alphaTest) m.alphaTest *= .25; if(id==='pine'||asset(id).wind) TDPineWind.attach(m,asset(id).wind||null,!!asset(id).motionWeights,!!asset(id).rootGrounding); if(window.TDRootSurface)TDRootSurface.attach(m,asset(id).rootSurface); leafLighting(m,asset(id)); ghosts.set(id, m); }
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
  if(id==='pine'||asset(id).wind) TDPineWind.attach(m,asset(id).wind||null,!!asset(id).motionWeights,!!asset(id).rootGrounding);
  if(window.TDRootSurface)TDRootSurface.attach(m,a.rootSurface);
  leafLighting(m,a);
  if(a.glow){const compile=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m);m.onBeforeCompile=sh=>{compile(sh);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float sharedGlow;varying vec2 vSharedGlow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSharedGlow=vec2(sharedGlow,position.y);');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSharedGlow;uniform vec4 uPineWind;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vSharedGlow.x*(.85+.15*sin(uPineWind.w*9.+vSharedGlow.y*13.));');};m.customProgramCacheKey=()=>key()+'/shared-glow/1';}
  m.name = data.libraryVersion + '/' + id; materials.set(id, m); return m;
}
window.TDSharedProps = {asset, geometry, material, data, exportJson: () => JSON.stringify(data)};
})();
