// 骨・石像の静的メッシュ用部品。材質や毎フレームの処理は追加しない。
window.TDSmallParts = (() => {
  const mesh = (p, ix) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.flat(), 3));
    g.setIndex(ix); g.computeVertexNormals(); return g;
  };
  const tube = (points, radii, sides = 5, oval = 1) => {
    const v = points.map(p => new THREE.Vector3(...p)), p = [], ix = [];
    v.forEach((c, k) => {
      const t = v[Math.min(k + 1, v.length - 1)].clone().sub(v[Math.max(0, k - 1)]).normalize();
      const ref = Math.abs(t.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const u = new THREE.Vector3().crossVectors(t, ref).normalize(), w = new THREE.Vector3().crossVectors(t, u);
      for (let j = 0; j < sides; j++) {
        const a = j / sides * Math.PI * 2;
        p.push(c.clone().addScaledVector(u, Math.cos(a) * radii[k]).addScaledVector(w, Math.sin(a) * radii[k] * oval).toArray());
      }
      if (k) for (let j = 0; j < sides; j++) {
        const a = (k - 1) * sides + j, b = (k - 1) * sides + (j + 1) % sides, c0 = k * sides + j, d = k * sides + (j + 1) % sides;
        ix.push(a, b, c0, b, d, c0);
      }
    });
    for (const end of [0, v.length - 1]) {
      const center = p.length; p.push(v[end].toArray());
      for (let j = 0; j < sides; j++) end ? ix.push(center, end * sides + j, end * sides + (j + 1) % sides) : ix.push(center, (j + 1) % sides, j);
    }
    return mesh(p, ix);
  };
  const rings = (levels, sides = 8) => {
    const p = [], ix = [];
    levels.forEach(([y, rx, rz, fold = 0], k) => {
      for (let j = 0; j < sides; j++) {
        const a = j / sides * Math.PI * 2, f = 1 + Math.cos(a * 3 + .4) * fold;
        p.push([Math.cos(a) * rx * f, y, Math.sin(a) * rz * f]);
      }
      if (k) for (let j = 0; j < sides; j++) {
        const a = (k - 1) * sides + j, b = (k - 1) * sides + (j + 1) % sides, c = k * sides + j, d = k * sides + (j + 1) % sides;
        ix.push(a, c, b, b, c, d);
      }
    });
    for (const end of [0, levels.length - 1]) {
      const n = p.length; p.push([0, levels[end][0], 0]);
      for (let j = 0; j < sides; j++) end ? ix.push(n, end * sides + (j + 1) % sides, end * sides + j) : ix.push(n, j, (j + 1) % sides);
    }
    return mesh(p, ix);
  };
  const skull = (parent, scale = 1) => {
    const { col, BONE_C } = TDGeo, parts = [];
    const m = parent.clone().multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
    const add = (g, cfn = BONE_C) => parts.push({ g, m, cfn, j: .015 });
    const outline = [[-.082,.09],[-.103,.035],[-.084,-.035],[-.057,-.085],[.057,-.085],[.084,-.035],[.103,.035],[.082,.09],[.077,.145],[.035,.17],[-.035,.17],[-.077,.145]];
    const shell = [], shellIx = [], n = outline.length;
    for (const [sx,sy,oy,z] of [[1,1,0,.101],[1.08,.88,.035,-.005],[.70,.66,.055,-.070]])
      for (const [x,y] of outline) shell.push([x*sx,y*sy+oy,z]);
    for(let k=0;k<2;k++)for(let j=0;j<n;j++) { const a=k*n+j,b=k*n+(j+1)%n,c=(k+1)*n+j,d=(k+1)*n+(j+1)%n; shellIx.push(a,c,b,b,c,d); }
    shell.push([0,.055,-.09]);
    for(let j=0;j<n;j++)shellIx.push(3*n,2*n+(j+1)%n,2*n+j);
    add(mesh(shell,shellIx));
    const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(...p)));
    const holes = [[[-.074,.025],[-.064,.064],[-.025,.061],[-.018,.024],[-.038,.002],[-.066,.003]],[[.018,.024],[.025,.061],[.064,.064],[.074,.025],[.066,.003],[.038,.002]],[[-.015,-.042],[0,.002],[.015,-.042]]];
    holes.forEach(h => shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(...p)))));
    add(new THREE.ShapeGeometry(shape).translate(0, 0, .101));
    holes.forEach(h => {
      const p = [...h.map(([x,y]) => [x,y,.101]), ...h.map(([x,y]) => [x*.90,y*.90,.035])], ix = [], n = h.length;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; ix.push(i,n+i,j,j,n+i,n+j); }
      add(mesh(p, ix));
      const inner = new THREE.ShapeGeometry(new THREE.Shape(h.map(([x,y]) => new THREE.Vector2(x*.9,y*.9)))).translate(0,0,.027);
      parts.push({ g: inner, m, c: col(0x746b53) });
    });
    add(tube([[-.078,-.025,.02],[-.073,-.09,.06],[-.043,-.12,.105],[.043,-.12,.105],[.073,-.09,.06],[.078,-.025,.02]],[.013,.016,.017,.017,.016,.013],4));
    add(mesh([[-.053,-.065,.105],[.053,-.065,.105],[-.053,-.083,.11],[.053,-.083,.11],[-.043,-.106,.11],[.043,-.106,.11]],[0,2,1,1,2,3,2,4,3,3,4,5]));
    return parts;
  };
  const longBone = (a, b, r = .027) => {
    const p = [], radii = [], start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    [0,.12,.32,.67,.88,1].forEach((t,k) => { const v = start.clone().lerp(end,t); v.y += Math.sin(t*Math.PI)*.018; p.push(v.toArray()); radii.push(r*[.85,1.7,.83,.77,1.6,.85][k]); });
    return tube(p,radii,5);
  };
  return { mesh, tube, rings, skull, longBone };
})();
