// Rail-only, metre-based placement. No scene mutation until the whole stroke commits.
const TDMineRailDrag = (() => {
  const LIMIT = 64, EPS = .002;
  const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
  const forward = a => ({x:Math.sin(a),z:Math.cos(a)});
  const pose = p => ({x:p[1],z:p[2],rot:p[3],scale:p[4],y:p[7]});
  let portCache;
  function ports(placed,types,heightAt) {
    if(portCache&&portCache.placed===placed&&portCache.types===types&&portCache.heightAt===heightAt&&portCache.revision===TDMineRails.revision)return portCache.ends;
    const out=[];
    for(const p of placed){const def=TDMineRails.definitions.find(d=>d.id===types[p[0]]?.id);if(!def)continue;
      const q=pose(p);q.y??=heightAt(q.x,q.z);
      for(const e of TDMineRails.worldEnds(def,q))out.push({x:e.p[0],y:e.p[1],z:e.p[2],dx:e.d[0],dz:e.d[2],scale:p[4],owner:p,stretched:Math.abs((p[6]??1)-1)>1e-6,occupied:false});
    }
    for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){const a=out[i],b=out[j];if(a.owner!==b.owner&&dist(a,b)<EPS&&Math.abs(a.y-b.y)<EPS){a.occupied=b.occupied=true;}}
    portCache={placed,types,heightAt,revision:TDMineRails.revision,ends:out};return out;
  }
  function begin(x,z,rot,scale,placed,types,heightAt) {
    const ends=ports(placed,types,heightAt),near=ends.filter(e=>dist(e,{x,z})<.4*scale).sort((a,b)=>dist(a,{x,z})-dist(b,{x,z}))[0];
    let reason='';
    if(near){if(near.occupied)reason='使用済みの接続点です';else if(near.stretched||Math.abs(near.scale-scale)>1e-6)reason='接続先とサイズが異なります';else if(Math.abs(near.y-heightAt(x,z))>.06*scale)reason='接続先と高さが異なります';}
    const start=near&&!reason?{x:near.x,y:near.y,z:near.z,rot:Math.atan2(near.dx,near.dz)}:{x,y:heightAt(x,z),z,rot};
    return {start,scale,ends,pieces:[],valid:false,reason,startReason:reason,snapped:!!near&&!reason};
  }
  // Left turns traverse the existing right-turn mesh backwards: no mirror/negative scale.
  function next(n,turn,s) {
    const f=forward(n.rot),r={x:f.z,z:-f.x};
    const end={x:n.x+2*s*(f.x+turn*r.x),z:n.z+2*s*(f.z+turn*r.z),y:n.y,rot:n.rot+turn*Math.PI/2};
    const p=turn<0?{x:end.x,z:end.z,y:n.y,rot:n.rot+Math.PI/2,scale:s}:{x:n.x,z:n.z,y:n.y,rot:n.rot,scale:s};
    return {...p,id:turn?'mine_rail_curve':'mine_rail_straight',start:n,end,turn};
  }
  function samples(p) {
    const d=TDMineRails.definitions.find(d=>d.id===p.id),count=d.curve?20:14,c=Math.cos(p.rot),s=Math.sin(p.rot),out=[];
    for(let i=0;i<=count;i++){const a=Math.PI*.5*i/count,x=d.curve?2-2*Math.cos(a):0,z=d.curve?2*Math.sin(a):2*i/count;out.push({x:p.x+(x*c+z*s)*p.scale,z:p.z+(-x*s+z*c)*p.scale,y:p.y});}return out;
  }
  function conflicts(a,b) {
    if(dist(a,b)>4.5*(a.scale+b.scale))return false;
    if(Math.abs(a.y-b.y)>.2*Math.max(a.scale,b.scale))return false;
    const da=TDMineRails.definitions.find(d=>d.id===a.id),db=TDMineRails.definitions.find(d=>d.id===b.id);
    const ea=TDMineRails.worldEnds(da,a),eb=TDMineRails.worldEnds(db,b),joints=[];
    if(Math.abs(a.scale-b.scale)<1e-6)for(const x of ea)for(const y of eb)if(Math.hypot(...x.p.map((v,i)=>v-y.p[i]))<EPS&&x.d[0]*y.d[0]+x.d[2]*y.d[2]<-.999)joints.push({x:x.p[0],z:x.p[2]});
    const aa=samples(a),bb=samples(b),width=.62*(a.scale+b.scale);
    for(const x of aa)for(const y of bb)if(dist(x,y)<width&&!joints.some(j=>dist(x,j)<1.3*a.scale&&dist(y,j)<1.3*b.scale))return true;
    return false;
  }
  function validate(stroke,placed,types,heightAt,inside) {
    if(stroke.startReason)return stroke.startReason;
    const existing=placed.filter(p=>types[p[0]]?.mineRail).map(p=>({...pose(p),y:p[7]??heightAt(p[1],p[2]),id:types[p[0]].id}));
    for(let i=0;i<stroke.pieces.length;i++){
      const p=stroke.pieces[i],def=TDMineRails.definitions.find(d=>d.id===p.id);
      if(!samples(p).every(q=>inside(q.x,q.z,.62*p.scale)))return 'マップの端を越えています';
      if(!TDMineRails.fitsGround(def,p,heightAt))return '平らな床・同じ高さが必要です';
      if([...existing,...stroke.pieces.slice(0,i)].some(q=>conflicts(p,q)))return '線路が重なるため接続できません';
    }
    const end=stroke.pieces.at(-1)?.end;
    if(end)for(const e of stroke.ends)if(dist(e,end)<.45*stroke.scale){
      const f=forward(end.rot);
      if(e.occupied||e.stretched||Math.abs(e.scale-stroke.scale)>1e-6||Math.abs(e.y-end.y)>EPS||dist(e,end)>EPS||f.x*e.dx+f.z*e.dz>-.999)return '接続先の端点・向き・高さ・サイズが合いません';
    }
    return '';
  }
  function update(stroke,target,placed,types,heightAt,inside=()=>true) {
    if(!target){stroke.valid=false;stroke.reason='床の上へ戻すか Esc で取り消してください';return stroke;}
    const s=stroke.scale;
    // Returning to an earlier port retracts the preview. Otherwise only the last
    // two pieces may change, so a deliberate path is retained while its tail bends.
    let path=stroke.pieces.slice(),nodes=[stroke.start,...path.map(p=>p.end)];
    const closeLoop=path.length>=3&&!stroke.snapped&&dist(stroke.start,target)<.5*s&&((dist(path.at(-1).end,stroke.start)<EPS&&Math.cos(path.at(-1).end.rot-stroke.start.rot)>.999)||[0,1,-1].some(t=>{const e=next(path.at(-1).end,t,s).end;return dist(e,stroke.start)<EPS&&Math.cos(e.rot-stroke.start.rot)>.999;}));
    if(!closeLoop)for(let i=0;i<nodes.length-1;i++)if(dist(nodes[i],target)<.5*s){path=path.slice(0,i);break;}
    let best=path,bestD=dist(path.at(-1)?.end||stroke.start,target);
    for(let cut=0;cut<=Math.min(2,path.length);cut++){
      let trial=path.slice(0,path.length-cut),n=trial.at(-1)?.end||stroke.start,d=dist(n,target);
      while(trial.length<LIMIT){const opts=[0,1,-1].map(t=>next(n,t,s)).sort((a,b)=>dist(a.end,target)-dist(b.end,target));const q=opts[0],nd=dist(q.end,target);
        if(nd>=d-1e-5)break;trial.push(q);n=q.end;d=nd;
      }
      if(d<bestD-1e-5){best=trial;bestD=d;}
    }
    stroke.pieces=best;
    stroke.reason=validate(stroke,placed,types,heightAt,inside);
    if(!stroke.reason){if(!best.length)stroke.reason='進行方向へドラッグしてください';else if(bestD>1.02*s)stroke.reason=best.length===LIMIT?'一筆は64部品までです':'2m刻み・半径2mの90°曲線へ合わせてください';}
    // A nearby existing port is an explicit connection request, never silently
    // leave a gap by accepting the usual free-end length snapping tolerance.
    const requested=stroke.ends.find(e=>dist(e,target)<.4*s);
    if(!stroke.reason&&requested&&dist(best.at(-1).end,requested)>EPS)stroke.reason='接続先へ届きません（規格・方向を確認）';
    stroke.valid=!stroke.reason;
    return stroke;
  }
  function placements(stroke,types){return stroke.pieces.map(p=>[types.findIndex(t=>t.id===p.id),p.x,p.z,p.rot,p.scale,0,1,p.y]);}
  return {begin,update,validate,placements,conflicts,LIMIT};
})();
