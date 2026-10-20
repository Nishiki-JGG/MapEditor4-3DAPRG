// 主人公の体（見た目だけ）。hero/<id>.js が TDHero.add({...}) でデータを登録し、app.js が TDHero.build(id) で three.js の形にする。
// データ：pos / nrm / uv は Float32、idx は Uint16（idx32 なら Uint32）を base64 にしたもの。tex は data URL（色だけ）。
// 座標は three.js（Y が上、顔は +Z、足の裏が 0）、単位は m。歩きの判定（state.agent）・書き出しには関わらない。
(function () {
  const list = {};
  const bytes = (s) => { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; };
  window.TDHero = {
    add(d) { list[d.id] = d; },
    get(id) { return list[id] || null; },
    // { group, mats, meta } か、データが無ければ null
    build(id) {
      const d = list[id]; if (!d) return null;
      const group = new THREE.Group(), mats = [], loader = new THREE.TextureLoader();
      for (const p of d.parts) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bytes(p.pos)), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bytes(p.nrm)), 3));
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bytes(p.uv)), 2));
        g.setIndex(new THREE.BufferAttribute(p.idx32 ? new Uint32Array(bytes(p.idx)) : new Uint16Array(bytes(p.idx)), 1));
        g.computeBoundingSphere();
        const map = loader.load(p.tex); map.colorSpace = THREE.SRGBColorSpace;   // UV は Blender のまま（下が 0）＝ three.js の既定 flipY
        // 普段は不透明（部品どうしの描く順が乱れないように）。岩の中で透かす時だけ app.js の heroStyle が transparent にする。髪・まつ毛は透明度の画像の形で切り抜く
        const m = new THREE.MeshStandardMaterial({ map, roughness: .78, metalness: 0, alphaTest: p.alpha ? .45 : 0, side: p.alpha ? THREE.DoubleSide : THREE.FrontSide });
        const mesh = new THREE.Mesh(g, m); mesh.name = p.name; mesh.castShadow = true;
        group.add(mesh); mats.push(m);
      }
      const { parts, ...meta } = d;
      return { group, mats, meta };
    },
  };
})();
