// 凸ダン本体の壁掛け松明。既存の地面置きtorchとは別の固定ID。
(() => {
  'use strict';
  const S = TDWallTorchSource, lerp = (a, b, t) => a + (b - a) * t;
  // Unityに保存されたColorを、Threeの線形描画色へ一度だけ変換する。
  const sourceColor = rgb => new THREE.Color(...rgb.slice(0, 3)).convertSRGBToLinear();
  function geometry(data, color = [1, 1, 1]) {
    const g = new THREE.BufferGeometry(), n = data.positions.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => color).flat(), 3));
    g.setIndex(data.triangles); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }
  const fixtureMaterial = new THREE.MeshStandardMaterial({ color: sourceColor(S.fixtureMaterial.color),
    metalness: S.fixtureMaterial.metalness, roughness: S.fixtureMaterial.roughness });
  const previewData = { positions: S.fixture.positions.concat(S.flame.positions.map((v, i) => v + S.flameOrigin[i % 3])),
    normals: S.fixture.normals.concat(S.flame.normals), triangles: S.fixture.triangles.concat(S.flame.triangles.map(i => i + S.fixture.positions.length / 3)) };
  const previewGeometry = geometry(previewData);
  const colors = previewGeometry.attributes.color;
  for (let i = 0; i < colors.count; i++) colors.setXYZ(i, ...sourceColor(i < S.fixture.positions.length / 3 ? S.fixtureMaterial.color : S.flameMaterial.color).toArray());
  TDProps.add({ id: 'wall_torch', name: '壁掛け松明（凸ダン）', r: 0, min: 2, sc: [1, 1], slope: 10,
    vis: .22, height: .45, anyGround: true, tags: ['cave', 'castle', 'ruins'], roomTorch: true,
    // 原本rootの支点は柄の中央。既存の接地処理で床から1.45mに支える。
    groundSink: -S.defaultMountHeight, material: 'wallTorch', light: [0xff9136, 3, .26],
    build: () => geometry(S.fixture) });

  function stableSeed(seed, key) {
    let h = Math.imul(2166136261 ^ seed, 16777619) >>> 0;
    for (let i = 0; i < key.length; i++) { const c = key.charCodeAt(i); h = Math.imul(h ^ (c & 255), 16777619) >>> 0; h = Math.imul(h ^ (c >>> 8), 16777619) >>> 0; }
    return h;
  }
  const random = (seed, n) => { let x = (seed ^ Math.imul(n + 1, 1597334677)) >>> 0; x = Math.imul(x ^ (x >>> 16), 2246822507); x = Math.imul(x ^ (x >>> 13), 3266489909); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  const smooth = t => t * t * (3 - 2 * t);
  // Unityと同じ「連続ノイズ78%＋sin22%」。乱数実装の違いは見た目で照合する。
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
    const sample = (a, b) => random(Math.imul(a, 374761393) ^ Math.imul(b, 668265263), 0);
    return lerp(lerp(sample(ix, iy), sample(ix + 1, iy), u), lerp(sample(ix, iy + 1), sample(ix + 1, iy + 1), u), v);
  }
  function flicker(time, phase) {
    const t = time * S.flicker.speed;
    return noise(t + phase * 19.19, phase * 7.37 + .31) * .78 + (Math.sin((t + phase * 3.1) * 4.3) * .5 + .5) * .22;
  }
  function makeParticles(config, additive, capacity) {
    config = { ...config, materialLinear: sourceColor(config.materialColor).toArray(), colorMinLinear: sourceColor(config.colorMin).toArray(), colorMaxLinear: sourceColor(config.colorMax).toArray() };
    const g = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['color', 3], ['opacity', 1], ['size', 1]])
      g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(capacity * size), size).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexColors: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { pixelHeight: { value: 720 } },
      vertexShader: `attribute float opacity; attribute float size; varying vec3 vColor; varying float vOpacity;
        uniform float pixelHeight; void main(){vColor=color;vOpacity=opacity;vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*pixelHeight*projectionMatrix[1][1]/(-2.*mv.z),1.,96.);}`,
      fragmentShader: `varying vec3 vColor;varying float vOpacity;void main(){vec2 p=gl_PointCoord*2.-1.;
        float d=dot(p,p);float edge=pow(max(0.,1.-d),2.);
        edge*=.8+.2*sin(p.x*9.+sin(p.y*8.));gl_FragColor=vec4(vColor,vOpacity*edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
    const object = new THREE.Points(g, material); object.frustumCulled = false; object.renderOrder = additive ? 3 : 2;
    return { object, config, count: 0 };
  }
  function create(scene) {
    const group = new THREE.Group(); group.name = '凸ダン壁掛け松明 VFX'; scene.add(group);
    // 3枚の交差面。透明な縁と流れる密度を持つ炎を全灯具で共有する。
    const flameGeo = new THREE.PlaneGeometry(1,1,4,8), flameMat = new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{fireTime:{value:0}},vertexShader:`attribute float firePhase;uniform float fireTime;varying vec2 vUv;varying float vPhase;void main(){vUv=uv;vPhase=firePhase;vec3 p=position;p.x+=sin(uv.y*7.-fireTime*3.+firePhase)*uv.y*uv.y*.075;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,fragmentShader:`uniform float fireTime;varying vec2 vUv;varying float vPhase;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){float t=fireTime*1.7+vPhase;vec2 p=vec2(vUv.x*2.-1.,vUv.y);float n=noise(vec2(p.x*3.+vPhase,p.y*5.-t*2.))*.65+noise(vec2(p.x*7.-t*.3,p.y*11.-t*3.))*.35;
      float spine=sin(p.y*8.-t*2.)*.11*p.y;float w=pow(max(0.,1.-p.y),.7)*(.60+.24*n);float d=abs(p.x-spine)/max(.02,w);float a=(1.-smoothstep(.55,1.,d))*smoothstep(0.,.045,p.y)*(1.-smoothstep(.76,1.,p.y))*(.38+.28*n);
      float heat=clamp(1.25-p.y*1.3-d*.6+n*.16,0.,1.);vec3 c=mix(vec3(.65,.035,.002),vec3(1.,.35,.018),smoothstep(.05,.65,heat));c=mix(c,vec3(1.3,.95,.40),smoothstep(.6,1.,heat));gl_FragColor=vec4(c,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    let records = [], flame = null, sparks = null, smoke = null, capacity = 0, pool = null, lightTimer = 0;
    const m = new THREE.Matrix4(), local = new THREE.Matrix4(), pos = new THREE.Vector3(), scale = new THREE.Vector3(), q = new THREE.Quaternion();
    const metrics = { count: 0, activeEmitters: 0, sparks: 0, smoke: 0, lights: 0, updateMs: 0 };
    function reserve(n) {
      if (n <= capacity) return;
      capacity = Math.max(16, 2 ** Math.ceil(Math.log2(n)));
      if (flame) { group.remove(flame); flame.dispose(); for (const p of [sparks, smoke]) { group.remove(p.object); p.object.geometry.dispose(); p.object.material.dispose(); } }
      flameGeo.setAttribute('firePhase',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),1));
      flame = new THREE.InstancedMesh(flameGeo, flameMat, capacity*3); flame.frustumCulled = false; flame.count = 0; flame.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(flame);
      sparks = makeParticles(S.sparks, true, capacity * 40); smoke = makeParticles(S.smoke, false, capacity * 20);
      group.add(smoke.object, sparks.object);
    }
    function sync(props, types, baseY, roomId) {
      const old = new Map(records.map(r => [r.id, r]));
      records = props.filter(p => types[p[0]].roomTorch||types[p[0]].fireEffect).map(p => {
        const id = p[8], key = roomId + '#' + id, seed = stableSeed(0, key), phase = (seed & 0xffffff) / 16777215;
        const r = old.get(id) || { fade: 0 }; Object.assign(r, { p, id, seed, phase, y: baseY(p), type: types[p[0]] });
        r.fire=r.type.fireEffect||{origin:[0,.20,0],width:.22,height:.43,power:3,range:8,radius:.04};
        r.matrix = new THREE.Matrix4().compose(new THREE.Vector3(p[1], r.y, p[2]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p[3] - (r.type.yawOffset || 0) * Math.PI / 180), new THREE.Vector3(p[4], p[4] * (p[6] ?? 1), p[4])); return r;
      });
      reserve(records.length); metrics.count = records.length;
      if (flame) flame.count = records.length*3;
      if (!records.length) {
        if (sparks) { sparks.object.geometry.setDrawRange(0, 0); smoke.object.geometry.setDrawRange(0, 0); }
        if (pool) for (const l of pool) { l.distance = 10; l.decay = 1.7; delete l.userData.torchSlot; }
        metrics.activeEmitters = metrics.sparks = metrics.smoke = metrics.lights = 0;
        metrics.updateMs = 0;
      }
      lightTimer = 0;
    }
    function particles(batch, r, time, visibility) {
      const base=batch.config,custom=r.type.fireEffect,isSmoke=batch===smoke;
      const c = custom?{...base,rate:isSmoke?custom.smokeRate:custom.sparkRate,max:isSmoke?20:40,radius:custom.radius,lifetime:isSmoke?[1.3,2.2]:[.7,1.5],speed:isSmoke?[.22,.42]:[.65,1.35],size:isSmoke?[.20,.36]:[.009,.021],sizeOverLife:isSmoke?[.7,2]:null}:base;
      const a = batch.object.geometry.attributes, t = time + r.phase * 13.73, last = Math.floor(t * c.rate);
      for (let i = 0; i < c.max; i++) {
        const birth = last - i, age = t - birth / c.rate;
        if (age > c.lifetime[1]) break;
        const seed = (r.seed ^ Math.imul(birth, 2654435761) ^ (batch === smoke ? 0x9e3779b9 : 0)) >>> 0;
        const life = lerp(...c.lifetime, random(seed, 0)); if (age < 0 || age >= life) continue;
        const angle = random(seed, 1) * Math.PI * 2, radius = Math.sqrt(random(seed, 2)) * c.radius;
        const speed = lerp(...c.speed, random(seed, 3)), spread = Math.tan(c.angle * Math.PI / 180) * age * speed;
        // Coneの原本shape rotationは0。Unityの+Z放出をThreeの-Zへ変換する。
        if(custom)pos.set(Math.cos(angle)*(radius+spread)+Math.sin(age*2+r.phase*8)*.08*age,custom.origin[1]+(isSmoke?custom.height*.65:0)+age*speed,Math.sin(angle)*(radius+spread)+age*age*.025).applyMatrix4(r.matrix);
        else pos.set(Math.cos(angle) * (radius + spread) + Math.sin(age * 4 + seed % 19) * c.noise * age,
          S.flameOrigin[1] + c.shapeOrigin[1] + Math.sin(angle) * (radius + spread) + Math.cos(age * 3 + seed % 23) * c.noise * age,
          -age * speed).applyMatrix4(r.matrix);
        const index = batch.count++; a.position.setXYZ(index, pos.x, pos.y, pos.z);
        const blend = random(seed, 4), col = c.materialColor, linear = c.materialLinear;
        a.color.setXYZ(index, linear[0] * lerp(c.colorMinLinear[0], c.colorMaxLinear[0], blend), linear[1] * lerp(c.colorMinLinear[1], c.colorMaxLinear[1], blend), linear[2] * lerp(c.colorMinLinear[2], c.colorMaxLinear[2], blend));
        if(custom){const age01=age/life;a.color.setXYZ(index,isSmoke?.11:lerp(1,.8,age01),isSmoke?.10:lerp(.40,.12,age01),isSmoke?.09:lerp(.035,.01,age01));}
        const fade = smooth(Math.min(1, age / .08)) * smooth(Math.min(1, (life - age) / .2));
        a.opacity.setX(index, (custom&&isSmoke?.14:col[3]*lerp(c.colorMin[3],c.colorMax[3],blend)) * fade * visibility);
        a.size.setX(index, lerp(...c.size, random(seed, 5)) * (c.sizeOverLife ? lerp(...c.sizeOverLife, smooth(age / life)) : 1) * r.p[4]);
      }
    }
    function update(time, dt, camera, center, pixelHeight) {
      if (!records.length) return;
      const start = performance.now(); sparks.count = smoke.count = 0; metrics.activeEmitters = 0;
      for (let i = 0; i < records.length; i++) {
        const r = records[i], f = flicker(time, r.phase);
        for(let layer=0;layer<3;layer++){const h=r.fire.height*lerp(.92,1.08,f)*(1-layer*.04),w=r.fire.width;scale.set(w,h,1);pos.set(r.fire.origin[0]+Math.sin(layer*2.4+r.phase*6)*w*.10,r.fire.origin[1]+h*.5,r.fire.origin[2]+Math.cos(layer*2.4)*w*.10);q.setFromAxisAngle(new THREE.Vector3(0,1,0),layer*Math.PI/3+r.phase*2);local.compose(pos,q,scale);m.multiplyMatrices(r.matrix,local);flame.setMatrixAt(i*3+layer,m);flameGeo.attributes.firePhase.setX(i*3+layer,r.phase*17+layer*1.7);}
        const distance = Math.hypot(r.p[1] - center.x, r.p[2] - center.z), target = 1 - smooth(Math.max(0, Math.min(1, (distance - 18) / 14)));
        r.fade = lerp(r.fade, target, 1 - Math.exp(-Math.max(0, dt) * 5));
        if (r.fade > .001) { metrics.activeEmitters++; particles(sparks, r, time, r.fade); particles(smoke, r, time, r.fade); }
      }
      flame.instanceMatrix.needsUpdate = true;
      flameGeo.attributes.firePhase.needsUpdate=true;flameMat.uniforms.fireTime.value=time;
      for (const p of [sparks, smoke]) { const g = p.object.geometry; g.setDrawRange(0, p.count); p.object.material.uniforms.pixelHeight.value = pixelHeight; for (const a of Object.values(g.attributes)) a.needsUpdate = true; }
      metrics.sparks = sparks.count; metrics.smoke = smoke.count; metrics.updateMs = performance.now() - start;
    }
    function updateLights(lights, props, types, tunnelLamps, center, time, dt, dim, groundHeight) {
      pool = lights;
      if ((lightTimer -= dt) <= 0) {
        lightTimer = .2; const candidates = [];
        for (const p of props) {
          const t = types[p[0]], L = t.light; if (!L) continue;
          const d = Math.hypot(p[1] - center.x, p[2] - center.z); if (d >= 40) continue;
          const torch = t.roomTorch||t.fireEffect, r = torch ? records.find(r => r.p === p) : null;
          candidates.push({ id: p[8], d, x: p[1], y: r ? r.y + (r.fire.origin[1]+r.fire.height*.4) * p[4] * (p[6] ?? 1) : groundHeight(p[1], p[2]) + L[2] * p[4], z: p[2],
            p, L, r, color: torch ? sourceColor(S.light.color) : new THREE.Color(L[0]), range: r?r.fire.range:10,
            base: r?r.fire.power:L[1] * p[4] });
        }
        for (let i = 0; i < tunnelLamps.length; i++) { const p = tunnelLamps[i], d = Math.hypot(p.x - center.x, p.z - center.z); if (d < 40) candidates.push({ id: 'tunnel-' + i, ...p, d, base: 2.4, range: 10, color: new THREE.Color(p.color) }); }
        const current = new Set(lights.map(l => l.userData.torchSlot?.target?.id));
        candidates.sort((a, b) => (a.d - (current.has(a.id) ? 1.5 : 0)) - (b.d - (current.has(b.id) ? 1.5 : 0)));
        const selected = candidates.slice(0, lights.length), unused = new Map(selected.map(c => [c.id, c]));
        for (const l of lights) { const s = l.userData.torchSlot || (l.userData.torchSlot = { gain: 0, target: null, next: null });
          if (s.target && unused.has(s.target.id)) { s.next = unused.get(s.target.id); unused.delete(s.target.id); } else s.next = null; }
        for (const l of lights) { const s = l.userData.torchSlot; if (!s.next) { s.next = unused.values().next().value || null; if (s.next) unused.delete(s.next.id); } }
      }
      metrics.lights = 0;
      for (let i = 0; i < lights.length; i++) {
        const l = lights[i], s = l.userData.torchSlot;
        if (!s) continue;
        if (s.target?.id !== s.next?.id && s.gain > .002) s.gain *= Math.exp(-Math.max(0, dt) * 14);
        else { s.target = s.next; s.gain = lerp(s.gain, s.target ? 1 : 0, 1 - Math.exp(-Math.max(0, dt) * 7)); }
        const c = s.target; if (!c) { l.intensity = 0; continue; }
        // 通常の灯具の高さは呼出側が供給する。固定支点の松明だけ原本の高さを使用。
        l.position.set(c.x, c.y, c.z); l.color.copy(c.color); l.distance = c.range; l.decay = c.r ? 2 : 1.7;
        const f = c.r ? 1 - S.flicker.amount + 2 * S.flicker.amount * flicker(time, c.r.phase) : .85 + .15 * Math.sin(time * 9 + i * 2.1);
        l.intensity = c.base * f * s.gain * (1 - .5 * dim); l.userData.base = c.base;
        if (l.intensity > .001) metrics.lights++;
      }
    }
    return { sync, update, updateLights, metrics, group, get records() { return records; } };
  }
  function exportData(props, types, roomId, U, baseY) {
    const selected = props.filter(p => types[p[0]].roomTorch);
    if (!selected.length) return null;
    for (const p of selected) if (types[p[0]].assetKey !== S.assetKey) throw Error('壁掛け松明のassetKeyが原本の対応と違います');
    return { format: 'tdj-room-torches', version: 1, assetKey: S.assetKey, vfxId: S.vfxId, resourcePath: S.resourcePath,
      prefabGuid: S.prefabGuid, sourcePrefabSha256: S.sources.find(s => s.path.endsWith('RoomTorch.prefab')).sha256,
      roomId, seed: 0, instances: selected.map(p => ({ instanceId: p[8], seedKey: roomId + '#' + p[8],
        position: [U.x(p[1]), U.y(baseY(p)), U.z(p[2])], yaw: U.yaw(p[3]) + (types[p[0]].yawOffset || 0),
        scale: [p[4], p[4] * (p[6] ?? 1), p[4]] })) };
  }
  window.TDWallTorch = { source: S, fixtureMaterial, previewGeometry, create, stableSeed, flicker, exportData };
})();
