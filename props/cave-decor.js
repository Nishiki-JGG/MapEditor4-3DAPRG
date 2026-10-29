// Original authored cave decorations; registered last to preserve legacy indices.
(() => {
  const pack = window.TDCaveDecorData, data = window.TDSharedData;
  for (const a of pack.assets) {
    if (data.assets.some(x => x.id === a.id)) throw Error('Duplicate cave decoration: '+a.id);
    data.assets.push(a);
  }
  data.textures.push(...pack.textures);
  for (const d of pack.definitions) TDProps.add({
    id:d.id, name:d.name, caveDecor:true, mount:d.mount, sourceMinY:d.minY,
    manualOnly:d.mount!=='floor', r:d.id==='cnd020'?.20:0, offs:d.id==='cnd020'?[-.7,-.35,0,.35,.7]:undefined,
    min:Math.max(.4,d.radius), sc:[.8,1.2], slope:.9, vis:d.radius, height:d.height,
    tags:['cave','forest','jungle','swamp'], anyGround:true, touch:d.moving,
    sway:0, material:'shared', sharedAsset:d.id,
    build(){return TDSharedProps.geometry(d.id);}
  });
  window.TDCaveDecor = {
    ids:pack.definitions.map(d=>d.id),
    // Keep the authored wall/ceiling pivot. Lift its lowest point onto the selected surface.
    baseY(type,ground,scale,offset=0){return ground-type.sourceMinY*scale+offset;}
  };
})();
