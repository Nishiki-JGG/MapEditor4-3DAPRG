// 主人公の体（見た目だけ）。hero/<id>.js が TDHero.add({...}) でデータを登録し、app.js が TDHero.build(id) で three.js の形にする。
// データ：pos / nrm / uv は Float32、idx は Uint16（idx32 なら Uint32）、skinIndex / skinWeight は Uint8×4（重みは 255 で 1）を base64 にしたもの。
//   bones：骨（親が先、休み姿勢＝T 字の親からの位置と回転）。idle：立ち姿の回転（全骨）と腰の位置。
//   clips.walk / clips.run：歩き・走りの 1 周期（全骨の回転と腰の位置、その場で動く形）。speed は進む速さ（m/秒）。
//   tex は data URL（色だけ）。座標は three.js（Y が上、顔は +Z、足の裏が 0）、単位は m。歩きの判定（state.agent）・書き出しには関わらない。
(function () {
  const list = {};
  const bytes = (s) => { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; };
  window.TDHero = {
    add(d) { list[d.id] = d; },
    get(id) { return list[id] || null; },
    // { group, mats, meta, animate(dt, speed) } か、データが無ければ null。speed：今の移動の速さ（m/秒、0 なら立ち姿）
    build(id) {
      const d = list[id]; if (!d) return null;
      const group = new THREE.Group(), mats = [], loader = new THREE.TextureLoader();
      // 骨（休み姿勢）
      const bones = d.bones.map(b => { const o = new THREE.Bone(); o.name = b.name; o.position.fromArray(b.pos); o.quaternion.fromArray(b.quat); return o; });
      d.bones.forEach((b, i) => (b.parent < 0 ? group : bones[b.parent]).add(bones[i]));
      group.updateMatrixWorld(true);
      const skeleton = new THREE.Skeleton(bones);   // 休み姿勢から逆行列を作る
      for (const p of d.parts) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bytes(p.pos)), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bytes(p.nrm)), 3));
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bytes(p.uv)), 2));
        g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(bytes(p.skinIndex)), 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(bytes(p.skinWeight)), 4, true));
        g.setIndex(new THREE.BufferAttribute(p.idx32 ? new Uint32Array(bytes(p.idx)) : new Uint16Array(bytes(p.idx)), 1));
        const map = loader.load(p.tex); map.colorSpace = THREE.SRGBColorSpace;   // UV は Blender のまま（下が 0）＝ three.js の既定 flipY
        // 普段は不透明（部品どうしの描く順が乱れないように）。岩の中で透かす時だけ app.js の heroStyle が transparent にする。髪・まつ毛は透明度の画像の形で切り抜く
        const m = new THREE.MeshStandardMaterial({ map, roughness: .78, metalness: 0, alphaTest: p.alpha ? .45 : 0, side: p.alpha ? THREE.DoubleSide : THREE.FrontSide });
        const mesh = new THREE.SkinnedMesh(g, m); mesh.name = p.name; mesh.castShadow = true; mesh.frustumCulled = false;   // 動くと休み姿勢の範囲から出るので、画面外の判定はしない
        mesh.bind(skeleton, new THREE.Matrix4());
        group.add(mesh); mats.push(m);
      }
      // 動き：立ち姿（1 コマ）、歩き・走り（1 周期を繰り返す）。速さが歩きと走りの真ん中より遅ければ歩き、速ければ走り。
      // 再生の速さは移動の速さ÷クリップの進む速さ（足が地面を滑らないように）。切り替えは重みを 0.1 秒ほどで移す
      const B = d.bones.length, tracks = (quat, hips, times) => {
        const n = times.length, t = [];
        for (let i = 0; i < B; i++) { const v = new Float32Array(n * 4); for (let f = 0; f < n; f++) v.set(quat.slice((f * B + i) * 4, (f * B + i) * 4 + 4), f * 4); t.push(new THREE.QuaternionKeyframeTrack(d.bones[i].name + '.quaternion', times, v)); }
        t.push(new THREE.VectorKeyframeTrack(d.bones[0].name + '.position', times, hips)); return t;
      };
      const mixer = new THREE.AnimationMixer(group), actions = {}, weights = { idle: 1 };
      actions.idle = mixer.clipAction(new THREE.AnimationClip('idle', 1, tracks(d.idle.quat, d.idle.hips, [0])));
      for (const [name, c] of Object.entries(d.clips)) {
        const times = Array.from({ length: c.frames }, (_, f) => f / c.fps);
        actions[name] = mixer.clipAction(new THREE.AnimationClip(name, c.duration, tracks(c.quat, c.hips, times))); weights[name] = 0;
      }
      for (const a of Object.values(actions)) a.play();
      // 歩き↔走りの境目に戻りの幅：歩きから走りへは runUp を超えた時、走りから歩きへは runDown を下回った時（境目の前後で速さが揺れても毎コマ入れ替わらない）
      const mid = d.clips.run ? (d.clips.walk.speed + d.clips.run.speed) / 2 : Infinity, runUp = mid + .16, runDown = mid - .14;
      // 走りの再生の倍率の上限：Shift（8m/秒）で足が滑らない倍率（1.88 倍、約 322 歩/分）は回転が速すぎて早送りに見えるので 1.5 倍で止め、
      // それより速い分は足が少し滑るのを許す（動きの判定 REVIEW_VISUAL_03_run の第一案）。Infinity にすると上限なし
      const api = { runMaxRate: 1.5 };
      let gait = 'walk';
      const sync = (from, to) => {   // 切り替える時、新しいクリップの再生位置を今の足の位相にそろえる（左足が一番前に出る位置 leftFront を合わせる）
        const a0 = actions[from], c0 = d.clips[from], c1 = d.clips[to];
        const p = ((a0.time / c0.duration - c0.leftFront + c1.leftFront) % 1 + 1) % 1; actions[to].time = p * c1.duration;
      };
      const animate = (dt, speed) => {
        let target = 'idle';
        if (speed > .05) {
          const next = gait === 'run' ? (speed < runDown ? 'walk' : 'run') : (speed > runUp && d.clips.run ? 'run' : 'walk');
          if (next !== gait && weights[gait] > .02) sync(gait, next);
          gait = target = next;
          actions[target].timeScale = target === 'run' ? Math.min(speed / d.clips.run.speed, api.runMaxRate) : speed / d.clips.walk.speed;
        }
        // 止まる・動き出すは 0.1 秒ほど、歩き↔走りは 0.2 秒ほどで重みを移す（速く混ぜ替えると、切り替えのコマで足先が急に動いた：PLAN_03 の 1 回目）
        const k = Math.min(1, dt * (target === 'idle' || weights.idle > .5 ? 10 : 5));
        for (const n in weights) { weights[n] += ((n === target ? 1 : 0) - weights[n]) * k; actions[n].setEffectiveWeight(weights[n]); }
        mixer.update(dt);
      };
      animate(0, 0);
      const { parts, bones: _b, idle: _i, clips: _c, ...meta } = d;
      meta.clips = Object.fromEntries(Object.entries(d.clips).map(([n, c]) => [n, { source: c.source, speed: c.speed, duration: c.duration }])); meta.runUp = runUp; meta.runDown = runDown;
      Object.assign(api, { group, mats, meta, skeleton, mixer, animate, weights, actions });
      Object.defineProperty(api, 'gait', { get: () => gait });   // （Object.assign だと値が写されて固まる）
      return api;
    },
  };
})();
