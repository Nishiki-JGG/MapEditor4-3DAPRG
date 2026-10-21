// 干し草（haystack）
TDProps.add({
  id: 'haystack', name: '干し草',
  r: .7, min: 2, sc: [.8, 1.2], slope: .5, vis: .8,
  tags: ['grassland'], height: 1.69, material: 'cards2',
  build() {
    const { rng, col, mixc, mat4, displace, makeGeo, ATLAS2 } = TDGeo;
    // a stack of straw (atlas 2) with a bound waist and loose wisps sticking out around the edges
    const R = rng(99), parts = [], hay = (y, ny, Rr, pr) => mixc(col(0xf0e4cc), col(0xffffff), Math.min(1, y * .4 + Rr() * .2));
    parts.push({ g: displace(new THREE.CylinderGeometry(.75, .8, .9, 14, 3), .07, 3), m: mat4(0, .45, 0, 1, 1, 1), cfn: hay, uvr: ATLAS2.uvr('straw'), j: .05 });
    parts.push({ g: displace(new THREE.ConeGeometry(.82, .85, 14, 3), .07, 5), m: mat4(0, 1.32, 0, 1, 1, 1), cfn: hay, uvr: ATLAS2.uvr('straw'), j: .05 });
    parts.push({ g: new THREE.TorusGeometry(.79, .035, 4, 18), m: mat4(0, .62, 0, 1, 1, 1, 0, Math.PI / 2), c: col(0x6a5030), j: .05 });
    parts.push({ g: displace(new THREE.CylinderGeometry(.84, .9, .12, 14, 1, true), .2, 7), m: mat4(0, .06, 0, 1, 1, 1), cfn: hay, uvr: ATLAS2.uvr('straw'), j: .06 });   // straw spilt at the foot
    return makeGeo(parts, 99, { ao: .5, uv: ATLAS2.white });
  },
});
