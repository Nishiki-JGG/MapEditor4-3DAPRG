/* 遺跡構造の正本と派生形状。既存地形は変更しない。 */
(function(root){
'use strict';
const VERSION=1, FEATURE='ruinsStructuresV1', EPS=1e-6, GRID=.5;
const COLUMN_PARTS=['column_base','column_shaft','column_capital'];
const TRIM_PARTS=['edge_corner','edge_end'];
const TYPES={buttress_wall:"控え壁（壁一体・片側張出し）",offering_table:"奉献台（独立した石台）",soil_bank:"土の堆積（浅い裾）",window_wall:'石窓壁（通路ではない開口）',balustrade:'透かし石欄干',wall_niche:'壁龕（片面の窪み・通行不可）',stone_beam:'柱間の石梁',edge_corner:'床縁の角',edge_end:'床縁の止め',column_base:'独立柱礎',column_shaft:'組立用柱身',column_capital:'独立柱頭',paving:'風化した敷石',paving_broken:'割れ・欠落のある敷石',arch:'風化石組みアーチ',arch_broken:'崩れた石組みアーチ',pier:'風化角柱（柱礎・柱頭付）',pier_broken:'欠損角柱（残存部）',wall:'直線壁',wall_broken:'欠損壁',wall_ruined:'崩落壁・落下石',opening_broken:'崩れた開口',corner_in:'内角',corner_out:'外角',end:'端部',opening:'開口',tee:'T字接合',platform:'高床・垂直側面',edge:'床縁',stairs:'遺跡階段'};
const clone=v=>JSON.parse(JSON.stringify(v)), empty=()=>({version:VERSION,nextId:1,items:[]});
const err=s=>{throw Error(s);}, finite=Number.isFinite;
function local(p,x,z){const c=Math.cos(p.rot),s=Math.sin(p.rot),dx=x-p.x,dz=z-p.z;return[dx*c-dz*s,dx*s+dz*c];}
function world(p,x,z){const c=Math.cos(p.rot),s=Math.sin(p.rot);return[p.x+x*c+z*s,p.z-x*s+z*c];}
function resolved(p,m){const q={...p};if(p.kind==='stone_beam'&&Array.isArray(p.beamSupports)&&p.beamSupports.length===2){const a=p.beamSupports.map(id=>m.items.find(v=>v.id===id));if(a.some(v=>!v||!['pier','column_capital'].includes(v.kind)))err('石梁の支持柱が不正です');const b=a.map(v=>resolved(v,m));q.x=(b[0].x+b[1].x)/2;q.z=(b[0].z+b[1].z)/2;q.y=b[0].y+b[0].height;}if(p.mountId){const b=m.items.find(v=>v.id===p.mountId),want=p.kind==='column_shaft'?'column_base':p.kind==='column_capital'?'column_shaft':null;if(!b||!want||b.kind!==want)err('柱の支持部材が不正です');const parent=resolved(b,m);q.x=parent.x;q.z=parent.z;q.y=parent.y+parent.height;}if(p.supportId){const b=m.items.find(v=>v.id===p.supportId);if(!b||b.kind!=='platform')err('支持する高床がありません');q.y=b.y+b.height;}
 if(p.kind==='stairs'&&p.upperId){const b=m.items.find(v=>v.id===p.upperId);if(!b||b.kind!=='platform')err('階段の上床がありません');q.height=b.y+b.height-q.y;}if(p.kind==='platform'){
  // Derived bearing patches, never persisted into authoring. They protect only
  // the hidden support/contact regions, not the whole exposed platform edge.
  q._bearing=[];
  for(const v of m.items){
   if(v.supportId===p.id){for(const box of boxes(v)){if(['offering_table','buttress_wall'].includes(v.kind)&&box[2]>EPS)continue;const a=rect(v,box),pts=[[a[0],a[4]],[a[1],a[5]]].map(t=>local(p,...t));q._bearing.push([Math.min(...pts.map(t=>t[0]))-.015,Math.max(...pts.map(t=>t[0]))+.015,Math.min(...pts.map(t=>t[1]))-.015,Math.max(...pts.map(t=>t[1]))+.015]);}}
   if(v.kind==='stairs'&&v.upperId===p.id){const a=local(p,...world(v,-v.width/2,v.length/2)),b=local(p,...world(v,v.width/2,v.length/2));q._bearing.push([Math.min(a[0],b[0])-.08,Math.max(a[0],b[0])+.08,Math.min(a[1],b[1])-.08,Math.max(a[1],b[1])+.08]);}
  }
 }return q;}
function defaults(kind,x=0,z=0,y=0){if(kind==='buttress_wall')return{kind,x,z,y,rot:0,length:2,width:1.5,height:3,finish:"carved"};if(kind==='offering_table')return{kind,x,z,y,rot:0,length:2,width:1.5,height:1.2,finish:"carved"};if(kind==='soil_bank')return{kind,x,z,y,rot:0,length:2,width:1.5,height:.16,finish:"worn"};if(kind==='balustrade')return{kind,x,z,y,rot:0,length:2,width:.5,height:1.1,finish:'stone'};if(kind==='stone_beam')return{kind,x,z,y,rot:0,length:3,width:.5,height:.5,finish:'stone'};if(TRIM_PARTS.includes(kind))return{kind,x,z,y,rot:0,length:kind==='edge_corner'?1:.5,width:.5,height:.3,finish:'stone'};if(COLUMN_PARTS.includes(kind))return{kind,x,z,y,rot:0,length:1,width:1,height:kind==='column_base'?.34:kind==='column_capital'?.38:2.28,finish:'stone'};return{kind,x,z,y,rot:0,length:kind==='arch'||kind==='arch_broken'?4:kind==='pier'||kind==='pier_broken'?1:kind==='wall_ruined'||kind==='opening_broken'||kind==='opening'?4:kind==='stairs'?3:kind==='platform'?4:2,width:kind==='paving'||kind==='paving_broken'?2:kind==='pier'||kind==='pier_broken'?1:kind==='platform'?4:kind==='stairs'?2:.5,height:kind==='paving'||kind==='paving_broken'?.12:kind==='arch'||kind==='arch_broken'?3.5:kind==='pier'?3:kind==='pier_broken'?1.8:kind==='stairs'||kind==='platform'?2.2:kind==='edge'?.3:2.2,finish:'stone'};}
// 箱の範囲 [xmin,xmax,ymin,ymax,zmin,zmax]。見た目と衝突の共通入力。
function boxes(p){if(p.kind==='buttress_wall')return buttressGeometry(p).map(g=>g.bounds);if(p.kind==='offering_table')return offeringGeometry(p).map(g=>g.bounds);if(p.kind==='soil_bank')return soilGeometry(p).map(g=>g.bounds);if(p.kind==='wall_ruined'&&p.fracture)return collapseGeometry(p).map(g=>g.bounds);if(p.kind==='window_wall'){const H=p.height;return[[-1,-.45,0,H,-.25,.25],[.45,1,0,H,-.25,.25],[-.45,.45,0,.9,-.25,.25],[-.45,.45,H-.35,H,-.25,.25]];}if(p.kind==='balustrade')return[[-1,1,0,.18,-.25,.25],[-1,1,.88,1.1,-.25,.25],[-1,-.78,.18,.88,-.25,.25],[-.39,-.21,.18,.88,-.25,.25],[.21,.39,.18,.88,-.25,.25],[.78,1,.18,.88,-.25,.25]];if(p.kind==='wall_niche'){const H=p.height;return[[-1,1,0,H,.03,.25],[-1,-.55,0,H,-.25,.03],[.55,1,0,H,-.25,.03],[-.55,.55,0,.5,-.25,.03],[-.55,.55,H-.35,H,-.25,.03]];}if(p.kind==='stone_beam')return[[-p.length/2-(p.joined?0:.28),p.length/2+(p.joined?0:.28),0,p.height,-.25,.25]];if(TRIM_PARTS.includes(p.kind))return boxes({...p,kind:p.kind==='edge_corner'?'corner_in':'end'});const L=p.length,W=p.width,H=p.height;if(COLUMN_PARTS.includes(p.kind))return columnGeometry(p).map(g=>g.bounds);
 if(p.kind==='paving'||p.kind==='paving_broken')return pavingGeometry(p).map(g=>g.bounds);
 if(p.kind==='arch'||p.kind==='arch_broken')return archGeometry(p).map(g=>g.bounds);
 if(p.kind==='pier'||p.kind==='pier_broken')return pierBlocks(p);
 if(p.kind==='wall_ruined'){
  const flip=1,stops0=[0,.10,.25,.38,.58,.78,.89,1],levels=[1,.58,.70,.26,.31,.64,1],stops=flip===1?stops0:stops0.slice().reverse().map(v=>1-v),heights=flip===1?levels:levels.slice().reverse(),body=heights.map((v,k)=>[-L/2+L*stops[k],-L/2+L*stops[k+1],0,H*v,-.25,.25]);
  return body.concat(fragmentGeometry(p).map((g,i)=>[...g.bounds,0,i]));
 }
 if(p.kind==='opening_broken'){const a=L/2;return[[-a,-1.45,0,H,-.25,.25],[-1.45,-1,0,H*.72,-.25,.25],[1,1.4,0,H*.86,-.25,.25],[1.4,a,0,H,-.25,.25]];}
 if(p.kind==='wall_broken')return [1,.48,.72,1].map((v,k)=>[-L/2+L*k/4,-L/2+L*(k+1)/4,0,H*v,-.25,.25]);
 if(p.kind==='platform')return[[-L/2,L/2,0,H,-W/2,W/2]];
 if(p.kind==='stairs'){const n=Math.ceil(H/.24),run=L/n;return Array.from({length:n},(_,k)=>[-W/2,W/2,0,H*(k+1)/n,-L/2+k*run,-L/2+(k+1)*run]);}
 if(p.kind==='opening'){const clear=2,post=(L-clear)/2;return[[-L/2,-clear/2,0,H,-.25,.25],[clear/2,L/2,0,H,-.25,.25],[-clear/2,clear/2,H-.3,H,-.25,.25]];}
 if(p.kind==='corner_in'||p.kind==='corner_out')return[[-.25,.5,0,H,-.25,.25],[-.25,.25,0,H,.25,.5]];
 if(p.kind==='tee')return[[-.5,.5,0,H,-.25,.25],[-.25,.25,0,H,.25,.5]];
 if(p.kind==='end')return[[0,.25,0,H,-.25,.25]];
 return[[-L/2,L/2,0,H,-.25,.25]];
}
function sockets(p){if(p.kind==='buttress_wall')return sockets({...p,kind:'wall',width:.5});if(p.kind==='offering_table')return[];if(p.kind==='stone_beam')return[];if(TRIM_PARTS.includes(p.kind))return sockets({...p,kind:p.kind==='edge_corner'?'corner_in':'end'});let a;
 if(p.kind==='paving'||p.kind==='paving_broken')return [[-1,0,-1,0],[1,0,1,0],[0,-1,0,-1],[0,1,0,1]].map(([x,z,dx,dz],index)=>{const w=world(p,x,z),d=world({...p,x:0,z:0},dx,dz);return{x:w[0],z:w[1],y:p.y,dx:d[0],dz:d[1],height:p.height,thickness:2,family:'paving',index,id:p.id};});
 if(p.kind==='window_wall'||p.kind==='balustrade'||p.kind==='wall_niche'||p.kind==='arch'||p.kind==='arch_broken'||p.kind==='wall'||p.kind==='wall_broken'||p.kind==='wall_ruined'||p.kind==='opening_broken'||p.kind==='opening'||p.kind==='edge')a=[[-p.length/2,0,-1,0],[p.length/2,0,1,0]];
 else if(p.kind==='corner_in'||p.kind==='corner_out')a=[[.5,0,1,0],[0,.5,0,1]];
 else if(p.kind==='tee')a=[[-.5,0,-1,0],[.5,0,1,0],[0,.5,0,1]];
 else if(p.kind==='end')a=[[0,0,-1,0]];else return[];
 return a.map(([x,z,dx,dz],index)=>{const w=world(p,x,z),d=world({...p,x:0,z:0},dx,dz);return{x:w[0],z:w[1],y:p.y,dx:d[0],dz:d[1],height:p.height,thickness:.5,index,id:p.id};});
}
function rect(p,b){const cx=(b[0]+b[1])/2,cz=(b[4]+b[5])/2,c=Math.cos(b[6]||0),s=Math.sin(b[6]||0),points=[[b[0],b[4]],[b[0],b[5]],[b[1],b[4]],[b[1],b[5]]].map(([x,z])=>world(p,cx+(x-cx)*c+(z-cz)*s,cz-(x-cx)*s+(z-cz)*c));return[Math.min(...points.map(v=>v[0])),Math.max(...points.map(v=>v[0])),p.y+b[2],p.y+b[3],Math.min(...points.map(v=>v[1])),Math.max(...points.map(v=>v[1]))];}
const intersects=(a,b)=>a[0]<b[1]-EPS&&a[1]>b[0]+EPS&&a[2]<b[3]-EPS&&a[3]>b[2]+EPS&&a[4]<b[5]-EPS&&a[5]>b[4]+EPS;
function footprint(p){const a=boxes(p).map(b=>rect(p,b));return[Math.min(...a.map(b=>b[0])),Math.max(...a.map(b=>b[1])),p.y,p.y+p.height,Math.min(...a.map(b=>b[4])),Math.max(...a.map(b=>b[5]))];}
function validate(m,env={}){
 if(!m||![1,2].includes(m.version)||!Array.isArray(m.items)||m.items.length>2048||!Number.isSafeInteger(m.nextId)||m.nextId<1)err('未対応または不正な遺跡構造形式');
 const ids=new Set();for(const p of m.items){if(!p||typeof p.id!=='string'||!/^ruins_[1-9][0-9]*$/.test(p.id)||ids.has(p.id))err('遺跡構造IDの重複・不正');ids.add(p.id);
  if(+p.id.slice(6)>=m.nextId)err('遺跡構造ID採番が不正');if(typeof p.kind!=='string'||!Object.prototype.hasOwnProperty.call(TYPES,p.kind))err('未対応の構造材');
  for(const k of ['x','z','y','rot','length','width','height'])if(!finite(p[k]))err('構造材の数値が不正');
  const extended=p.kind==='soil_bank'||p.burialDepth>0||p.fracture===true||p.joined===true||p.stoneVariation===true;
  if(extended&&m.version<2)err('新しい遺跡編集形式が必要です');
  if(p.stoneVariation!==undefined&&(typeof p.stoneVariation!=='boolean'||!['wall','wall_broken','wall_ruined'].includes(p.kind)))err('石肌の変化は壁部材のみです');
  if(p.burialDepth!==undefined&&(!finite(p.burialDepth)||p.burialDepth<0||p.burialDepth>.1||!['paving','paving_broken'].includes(p.kind)||p.supportId))err('埋没は地面上の敷石のみ0〜10cmです');
  if(p.fracture!==undefined&&(typeof p.fracture!=='boolean'||p.kind!=='wall_ruined'))err('破断形状は崩落壁専用です');
  if(p.joined!==undefined&&(typeof p.joined!=='boolean'||p.kind!=='stone_beam'))err('連続端部は石梁専用です');
  if(p.kind==='soil_bank'&&(p.length>4||p.width>3||p.height>.2||p.finish!=='worn'||p.supportId||p.mountId||p.upperId))err('土の堆積は地面上・長さ4m幅3m高さ20cm以下です');
  if(Math.abs(p.rot/(Math.PI/2)-Math.round(p.rot/(Math.PI/2)))>EPS)err('構造材は90度単位です');
  if(p.length<.5||p.length>32||p.width<.5||p.width>32||p.height<.1||p.height>8||Math.abs(p.y)>1000)err('構造材の寸法が範囲外');
  if(Math.abs(p.length/GRID-Math.round(p.length/GRID))>EPS||Math.abs(p.width/GRID-Math.round(p.width/GRID))>EPS)err('長さと幅は0.5m単位です');
  if((p.kind==='paving'||p.kind==='paving_broken')&&(p.length!==2||p.width!==2||Math.abs(p.height-.12)>EPS))err('敷石は2m角・厚さ12cmの規格部材です');
  if((p.kind==='paving'||p.kind==='paving_broken')&&env.agent&&env.agent.maxStep<p.height-EPS)err('敷石の段差が歩行設定を超えています');
  if((p.kind==='arch'||p.kind==='arch_broken')&&(p.length<3||p.length>8||p.width!==.5||p.height<3.2||p.height>5))err('アーチは長さ3～8m、厚さ0.5m、高さ3.2～5mです');
  if((p.kind==='pier'||p.kind==='pier_broken')&&(p.length!==1||p.width!==1||p.height<1.2||p.height>4))err('角柱は1m角の基礎・高さ1.2〜4mです');
  if(COLUMN_PARTS.includes(p.kind)&&(p.length!==1||p.width!==1||(p.kind==='column_base'?Math.abs(p.height-.34)>EPS:p.kind==='column_capital'?Math.abs(p.height-.38)>EPS:p.height<1.2||p.height>4)))err('柱部材は1m規格、柱礎34cm・柱頭38cm、柱身1.2〜4mです');
  if(TRIM_PARTS.includes(p.kind)&&(p.width!==.5||p.length!==(p.kind==='edge_corner'?1:.5)||p.height<.1||p.height>1))err('床縁接続材は固定平面寸法・高さ0.1〜1mです');
  if(p.kind==='balustrade'&&(p.length!==2||p.width!==.5||Math.abs(p.height-1.1)>EPS))err('透かし石欄干は幅2m・厚さ0.5m・高さ1.1mです');
  if(p.kind==='window_wall'&&(p.length!==2||p.width!==.5||p.height<2.2||p.height>4))err('石窓壁は幅2m・厚さ0.5m・高さ2.2〜4mです');
  if(p.kind==='wall_niche'&&(p.length!==2||p.width!==.5||p.height<2.2||p.height>4))err('壁龕は幅2m・厚さ0.5m・高さ2.2～4mです');
  if(p.kind==='buttress_wall'&&(p.length!==2||p.width!==1.5||p.height!==3||p.mountId||p.upperId||p.beamSupports))err('控え壁は接合幅2m・張出しを含む奥行1.5m・高さ3mの固定規格です');
  if(p.kind==='offering_table'&&(p.length!==2||p.width!==1.5||Math.abs(p.height-1.2)>EPS||p.mountId||p.upperId||p.beamSupports))err('奉献台は2m×1.5m、高さ1.2mの固定規格です');
  if(p.beamSupports&&p.kind!=='stone_beam')err('梁支持は石梁専用です');
  if(p.kind==='stone_beam'){if(p.length<2||p.length>4||p.width!==.5||p.height!==.5)err('石梁は柱心間2～4m・幅50cm・高さ50cmです');if(p.supportId||p.mountId||p.upperId||!Array.isArray(p.beamSupports)||p.beamSupports.length!==2||p.beamSupports[0]===p.beamSupports[1])err('同じ高さの柱頭2点で石梁を支えてください');const b=p.beamSupports.map(id=>m.items.find(v=>v.id===id));if(b.some(v=>!v||!['pier','column_capital'].includes(v.kind)))err('対応する柱頭がありません');const a=b.map(v=>resolved(v,m)),delta=local({...p,x:a[0].x,z:a[0].z},a[1].x,a[1].z);if(Math.abs(delta[1])>EPS||Math.abs(Math.abs(delta[0])-p.length)>EPS||Math.abs(a[0].y+a[0].height-a[1].y-a[1].height)>EPS)err('柱心間・向き・支持高さが一致しません');if(Math.abs(p.x-(a[0].x+a[1].x)/2)>EPS||Math.abs(p.z-(a[0].z+a[1].z)/2)>EPS)err('石梁中心と支持柱が一致しません');}
  if(p.mountId&&(p.supportId||p.upperId||!['column_shaft','column_capital'].includes(p.kind)))err('柱支持と他の支持関係は併用できません');
  if(p.finish!=='stone'&&p.finish!=='worn'&&p.finish!=='carved')err('未対応の床材');
  if(p.kind==='wall_broken'&&(p.length<2||p.height<1))err('欠損壁は長さ2m以上・高さ1m以上が必要です');
  if(p.kind==='wall_ruined'&&(p.length<4||p.height<1.5))err('崩落壁は長さ4m以上・高さ1.5m以上が必要です');
  if((p.kind==='opening'||p.kind==='opening_broken')&&(p.length<3||p.height<2.2))err('開口は外幅3m以上・高さ2.2m以上が必要です');
  if((p.kind==='platform'||p.kind==='stairs')&&p.supportId)err('高床の積み重ねは未対応です');if(p.kind==='stairs'&&!p.upperId)err('階段の上端を高床へ接続してください');
  if(p.finish==='carved'&&!ORNAMENT_KINDS.includes(p.kind))err('この部材は装飾仕上げに対応していません');
  const q=resolved(p,m);if(q.height<=0||q.height>8)err('上下床の高さが逆転しています');
  if(q.kind==='stairs'){const n=Math.ceil(q.height/.24);if(q.length/n<.28-EPS)err('階段長不足：踏面28cm以上を確保してください');if(env.agent&&q.height/n>env.agent.maxStep+EPS)err('階段の段高が歩行設定を超えています');}
  for(const b of boxes(q)){const w=rect(q,b);if(env.half&&(w[0]<-env.half||w[1]>env.half||w[4]<-env.half||w[5]>env.half))err('マップ外へ張り出しています');}
  if(env.height&&!p.supportId&&!p.mountId&&!p.beamSupports){const a=footprint(q),samples=[[q.x,q.z],[a[0],a[4]],[a[1],a[4]],[a[0],a[5]],[a[1],a[5]]];
   for(let z=a[4];z<a[5];z+=.5)for(let x=a[0];x<a[1];x+=.5)samples.push([x,z]);for(const [x,z]of samples)if(Math.abs(env.height(x,z)-p.y)>.025)err('平坦な基礎地面が必要です');}
  if(p.supportId){const base=m.items.find(v=>v.id===p.supportId),a=footprint(q),b=footprint(base);if(a[0]<b[0]-EPS||a[1]>b[1]+EPS||a[4]<b[4]-EPS||a[5]>b[5]+EPS)err('支持する高床から外れています');}
  if(p.kind==='stairs'&&p.upperId){const top=m.items.find(v=>v.id===p.upperId),pt=world(q,0,q.length/2),b=footprint(top),alongX=Math.abs(Math.sin(q.rot))>.5;
   const onEdge=alongX?(Math.abs(pt[0]-b[0])<EPS||Math.abs(pt[0]-b[1])<EPS):(Math.abs(pt[1]-b[4])<EPS||Math.abs(pt[1]-b[5])<EPS);
   if(!onEdge||pt[0]<b[0]-EPS||pt[0]>b[1]+EPS||pt[1]<b[4]-EPS||pt[1]>b[5]+EPS)err('階段上端を高床の縁に合わせてください');
   const corners=[world(q,-q.width/2,q.length/2),world(q,q.width/2,q.length/2)];if(corners.some(v=>v[0]<b[0]-EPS||v[0]>b[1]+EPS||v[1]<b[4]-EPS||v[1]>b[5]+EPS))err('階段の幅が高床からはみ出しています');}
  if(env.conflict){const why=env.conflict(q,footprint(q));if(why)err(why);}
 }
 for(let i=0;i<m.items.length;i++)for(let j=0;j<i;j++){const a=resolved(m.items[i],m),b=resolved(m.items[j],m);const soil=a.kind==='soil_bank'?a:b.kind==='soil_bank'?b:null,other=soil===a?b:a;if(soil&&['paving','paving_broken','wall_ruined'].includes(other.kind)&&Math.abs(a.y-b.y)<EPS)continue;if(boxes(a).some(x=>boxes(b).some(y=>intersects(rect(a,x),rect(b,y)))))err('構造材が重なっています');}
 return m;
}
function transaction(m,action,env){const n=clone(m);if(action.type==='put'){const p=clone(action.item);if(p.id){const i=n.items.findIndex(v=>v.id===p.id);if(i<0)err('編集対象がありません');n.items[i]=p;}else{p.id='ruins_'+n.nextId++;n.items.push(p);}}
 else if(action.type==='delete'){if(n.items.some(p=>p.supportId===action.id||p.upperId===action.id||p.mountId===action.id||p.beamSupports?.includes(action.id)))err('この構造を参照する壁・階段を先に移動または削除してください');n.items=n.items.filter(p=>p.id!==action.id);}
 else err('未対応の編集操作');if(n.items.some(p=>p.kind==='soil_bank'||p.burialDepth>0||p.fracture===true||p.joined===true||p.stoneVariation===true))n.version=2;return validate(n,env);}
// Impact fractures are clipped planes on worked stone, not rounded/noisy cubes.
// Optional v2 construction: legacy meshes and authoring remain unchanged.
function facesGeometry(faces,soil=false,fractureDetail=false){
 const g={faces,positions:[],normals:[],uv:[],triangles:[]};
 // Fracture faces sample the interior of one stone, never mortar from the wall atlas.
 const all=faces.flatMap(f=>f.v),lo=[0,1,2].map(k=>Math.min(...all.map(v=>v[k]))),hi=[0,1,2].map(k=>Math.max(...all.map(v=>v[k])));
 for(const f of faces)for(let i=1;i<f.v.length-1;i++){
  const t=[f.v[0],f.v[i],f.v[i+1]],area=cross3(t[1].map((v,k)=>v-t[0][k]),t[2].map((v,k)=>v-t[0][k]));if(Math.hypot(...area)<1e-10)continue;
  const n=unit3(area);g.triangles.push(t);for(const v of t){g.positions.push(...v);g.normals.push(...n);const u=Math.abs(n[0])>.8?v[2]:v[0],V=Math.abs(n[1])>.6?v[2]:v[1];const a=Math.abs(n[0])>.8?2:0,b=Math.abs(n[1])>.6?2:1;
    const patch=Math.abs(Math.floor(lo[0]*7+lo[1]*11+lo[2]*5))%4,starts=[.15,1.02,2.14,3.08];
    const U=starts[patch]+(u-lo[a])*.45/Math.max(.4,hi[a]-lo[a]),Q=.10+(V-lo[b])*.26/Math.max(.3,hi[b]-lo[b]);
    g.uv.push(soil?v[0]/2:f.fresh?(fractureDetail?U:.13+u*.43):u,soil?v[2]/2:f.fresh?(fractureDetail?Q:.16+V*.43):V);}
 }
 g.bounds=[0,1,2].flatMap(k=>[Math.min(...g.positions.filter((v,i)=>i%3===k)),Math.max(...g.positions.filter((v,i)=>i%3===k))]);return g;
}
function piecesMesh(p,pieces){const out={positions:[],normals:[],uv:[]};for(const g of pieces){for(let i=0;i<g.positions.length;i+=3){const w=world(p,g.positions[i],g.positions[i+2]),n=world({...p,x:0,z:0},g.normals[i],g.normals[i+2]);out.positions.push(w[0],p.y+g.positions[i+1],w[1]);out.normals.push(n[0],g.normals[i+1],n[1]);}out.uv.push(...g.uv);}return out;}
const collapseCache=new Map(),buriedCache=new Map(),soilCache=new Map();
function buriedPaving(p){
 const key=p.kind+':'+p.burialDepth;let found=buriedCache.get(key);if(found)return found;
 const d=p.burialDepth;
 found=pavingGeometry({...p,burialDepth:0}).map(g=>facesGeometry(g.faces.map(f=>({...f,v:f.v.map(v=>[v[0],v[1]-d+d*(.65*v[0]+.22*v[2]),v[2]])}))));
 // Preserve stone-patch UVs, adjusting normals only for the small subsidence slope.
 for(let i=0;i<found.length;i++){const old=pavingGeometry({...p,burialDepth:0})[i];if(found[i].uv.length===old.uv.length)found[i].uv=old.uv.slice();}
 if(buriedCache.size>=32)buriedCache.delete(buriedCache.keys().next().value);buriedCache.set(key,found);return found;
}
function soilGeometry(p){
 const key=[p.length,p.width,p.height].join(':');let found=soilCache.get(key);if(found)return found;
 const N=6,points=[],faces=[];
 for(let z=0;z<=N;z++)for(let x=0;x<=N;x++){const u=x/N*2-1,v=z/N*2-1,r=Math.max(Math.abs(u),Math.abs(v)),a=Math.atan2(v,u),rim=1-.09*(.5+.5*Math.sin(a*3+.4))-.04*Math.cos(a*5),X=u*p.length/2*rim,Z=v*p.width/2*rim,Y=r>=1?-.018:p.height*Math.pow(1-r*r,1.6)*(.85+.15*Math.sin(u*3+v*2+.7));points.push([X,Y,Z]);}
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){const a=points[z*(N+1)+x],b=points[z*(N+1)+x+1],c=points[(z+1)*(N+1)+x],d=points[(z+1)*(N+1)+x+1];faces.push({v:[a,c,b]},{v:[b,c,d]});}
 const rim=[];for(let x=0;x<=N;x++)rim.push(points[x]);for(let z=1;z<=N;z++)rim.push(points[z*(N+1)+N]);for(let x=N-1;x>=0;x--)rim.push(points[N*(N+1)+x]);for(let z=N-1;z>0;z--)rim.push(points[z*(N+1)]);faces.push({v:rim});
 const geo=facesGeometry(faces,true),smooth=new Map(),keyOf=v=>v.join(',');
 // Average only the upward surface; the closed underside must not flatten its normals.
 for(const f of faces){const a=f.v[0],b=f.v[1],c=f.v[2],n=cross3(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k]));if(n[1]<=0)continue;for(const v of f.v){const key=keyOf(v),sum=smooth.get(key)||[0,0,0];smooth.set(key,sum.map((s,k)=>s+n[k]));}}
 for(let i=0;i<geo.positions.length;i+=3)if(geo.normals[i+1]>0){const n=smooth.get(keyOf(geo.positions.slice(i,i+3)));if(n)geo.normals.splice(i,3,...unit3(n));}
 found=[geo];if(soilCache.size>=32)soilCache.delete(soilCache.keys().next().value);soilCache.set(key,found);return found;
}
function collapseGeometry(p){
 const key=[p.length,p.height].join(':');let found=collapseCache.get(key);if(found)return found;
 const profile=[[0,1],[.15,.96],[.22,.70],[.27,.76],[.38,.35],[.43,.40],[.49,.17],[.60,.22],[.66,.17],[.78,.53],[.83,.46],[.91,.86],[1,1]],out=[],course=.48;
 for(let row=0;row<Math.ceil(p.height/course);row++){
  const y=row*course,Y=Math.min(p.height,(row+1)*course),offset=row%2?.42:0;
  for(let x=-p.length/2-offset;x<p.length/2;x+=.89){const lo=Math.max(-p.length/2,x),hi=Math.min(p.length/2,x+.89);if(hi-lo<.05)continue;
   for(let k=0;k<profile.length-1;k++){
    const A=-p.length/2+profile[k][0]*p.length,B=-p.length/2+profile[k+1][0]*p.length,l=Math.max(lo,A),h=Math.min(hi,B);if(h-l<.015)continue;
    const slope=(profile[k+1][1]-profile[k][1])*p.height/(B-A),intercept=profile[k][1]*p.height-slope*A;
    if(Math.max(l*slope+intercept,h*slope+intercept)<=y+.02)continue;
    let faces=archBox([lo+(lo>-p.length/2?.009:0),hi-(hi<p.length/2?.009:0),y+(row?.009:0),Y-.009,-.25,.25]);
    const seed=.5+.5*Math.sin(row*7+x*3),rad=.025+.035*seed,c=[(lo+hi)/2,(y+Y)/2,0],half=[(hi-lo)/2,(Y-y)/2,.25];
    for(const axis of[0,1])for(const s of[-1,1])for(const t of[-1,1]){if(axis===0&&((s<0&&lo===-p.length/2)||(s>0&&hi===p.length/2)))continue;const n=[0,0,t*.707];n[axis]=s*.707;faces=clipPier(faces,[...n,dot3(n,c)+half[axis]*.707+.25*.707-rad*.414],false);}
    faces=clipPier(faces,[-1,0,0,-l],false);faces=clipPier(faces,[1,0,0,h],false);
    faces=clipPier(faces,[-slope,1,.09,intercept],true);
    // A secondary local cleavage crosses only the exposed top stone.
    // Worked faces below the break and the precision end sockets stay intact.
    const topAtMid=slope*(l+h)/2+intercept;
    if(topAtMid<Y+.09&&topAtMid>y+.05&&h-l>.30&&seed>.55){
     const turn=(seed>.5?1:-1),tilt=slope+turn*(.19+.10*seed),mid=(l+h)/2;
     faces=clipPier(faces,[-tilt,1,turn*(.48+.28*seed),intercept+(slope-tilt)*mid+.045],true);
    }
    if(archVolume(faces)<1e-7)continue;
    // One impact shoulder at each exposed large fracture; preserve the broad surviving plane.
    if((k===3||k===10)&&topAtMid<Y+.12&&topAtMid>y+.06&&h-l>.12){
     const n=[-slope+(k===3?.44:-.31),1,k===3?-.66:.52];
     const top=faces.filter(f=>f.fresh).flatMap(f=>f.v);
     if(top.length){const limit=Math.max(...top.map(v=>dot3(n,v)))-.085;faces=clipPier(faces,[...n,limit],true);}
    }
    const g=facesGeometry(faces,false,true);g.body=true;out.push(g);
   }
  }
 }
 // Existing worked-stone fragments cluster below the removed central face.
 for(const g of fragmentGeometry(p)){const faces=g.faces.map(f=>({...f,v:f.v.map(v=>[v[0]*1.12,v[1]-.035,v[2]*1.2])}));const q=facesGeometry(faces,false,true);q.body=false;out.push(q);}
 if(collapseCache.size>=32)collapseCache.delete(collapseCache.keys().next().value);collapseCache.set(key,out);return out;
}

const fragmentCache=new Map();
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot3=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit3=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
function clipStone(faces,plane,fresh=true){
 const n=plane.slice(0,3),d=plane[3],cuts=[],result=[];
 for(const f of faces){const polygon=[];for(let i=0;i<f.v.length;i++){const a=f.v[i],b=f.v[(i+1)%f.v.length],da=dot3(n,a)-d,db=dot3(n,b)-d;if(da<=EPS)polygon.push(a);if((da<-EPS&&db>EPS)||(da>EPS&&db<-EPS)){const t=da/(da-db),p=a.map((v,k)=>v+(b[k]-v)*t);polygon.push(p);if(!cuts.some(q=>Math.hypot(...p.map((v,k)=>v-q[k]))<EPS))cuts.push(p);}}
  if(polygon.length>=3)result.push({v:polygon,fresh:f.fresh});
 }
 if(cuts.length>=3){const center=[0,1,2].map(k=>cuts.reduce((s,p)=>s+p[k],0)/cuts.length),nn=unit3(n),u=unit3(cross3(Math.abs(nn[1])<.9?[0,1,0]:[1,0,0],nn)),v=cross3(nn,u);cuts.sort((a,b)=>{const A=a.map((t,k)=>t-center[k]),B=b.map((t,k)=>t-center[k]);return Math.atan2(dot3(A,v),dot3(A,u))-Math.atan2(dot3(B,v),dot3(B,u));});result.push({v:cuts,fresh});}
 return result;
}
function fragmentGeometry(p){
 const key=p.length+':'+p.height;if(fragmentCache.has(key))return fragmentCache.get(key);
 const definitions=[
  [-.22,.53,.90,.44,.44,.19,0,[[1,1,1,1.65],[-1,.65,-.3,1.32]]],
  [-.08,.77,.65,.46,.32,-.31,0,[[1,.3,.85,1.25],[-.2,1,-1,1.55]]],
  [.06,.59,1.05,.48,.50,-.12,-.06,[[1,.18,.25,.88],[-1,1,1,2.10],[.3,-.4,-1,1.30],[1,-.7,.8,1.35]]],
  [-.21,.57,.38,.26,.24,-.42,0,[[1,.3,1,.38],[-.6,1,-.4,1.0]]],
  [.02,.36,.32,.24,.14,.54,0,[[-.5,.4,1,.4],[1,.3,-.3,.95]]],
  [-.09,.74,.23,.19,.11,-.67,0,[[1,1,1,.4],[-1,0,-1,.8]]],
  [.15,.64,.20,.15,.10,.91,0,[[.4,1,-1,.4],[1,0,.4,.6]]]

 ];
 const result=definitions.map(([x,z,L,W,H,yaw,tilt,planes],index)=>{
  H=Math.min(H,p.height*.25);let faces=[
   [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],
   [[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],
   [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
  ].map(v=>({v,fresh:false}));
  // Weather the old worked edges before impact. Fresh fracture planes are
  // clipped afterwards and keep their sharp, recognisably different ridges.
  for(const [a,b] of [[0,1],[0,2],[1,2]])for(const sa of [-1,1])for(const sb of [-1,1]){
   const r=.12+.055*(.5+.5*Math.sin(index*2.3+a*1.7+b+sa*2+sb));
   for(const t of [Math.PI/8,3*Math.PI/8]){const n=[0,0,0];n[a]=sa*Math.cos(t);n[b]=sb*Math.sin(t);faces=clipStone(faces,[...n,(1-r)*(Math.cos(t)+Math.sin(t))+r],false);}
  }
  for(const plane of planes)faces=clipStone(faces,plane);
  const ct=Math.cos(tilt),st=Math.sin(tilt),cy=Math.cos(yaw),sy=Math.sin(yaw);
  faces=faces.map(f=>({...f,v:f.v.map(a=>{const xx=a[0]*L/2,yy=a[1]*H/2,zz=a[2]*W/2,y=yy*ct-zz*st,Z=yy*st+zz*ct;return[x*p.length+xx*cy+Z*sy,y,z-xx*sy+Z*cy];})}));
  const bottom=Math.min(...faces.flatMap(f=>f.v.map(v=>v[1])));for(const f of faces)for(const v of f.v)v[1]-=bottom+.012;
  if(index===3){const support=Math.min(.44,p.height*.25),dy=support-.012;faces=faces.map(f=>({...f,v:f.v.map(v=>[v[0],v[1]+dy,v[2]])}));}
  // A fracture is a few broad facets. Preserve one UV frame across them.
  faces=faces.flatMap((f,fi)=>{if(!f.fresh||f.v.length<4||fi%2===0||index>2)return[f];const n=unit3(cross3(f.v[1].map((v,k)=>v-f.v[0][k]),f.v[2].map((v,k)=>v-f.v[0][k]))),u=unit3(f.v[1].map((v,k)=>v-f.v[0][k])),v=cross3(n,u),project=f.v.map(t=>[dot3(t,u),dot3(t,v)]),uvBasis={u,v,lo:[0,1].map(k=>Math.min(...project.map(t=>t[k]))),hi:[0,1].map(k=>Math.max(...project.map(t=>t[k])))},center=[0,1,2].map(k=>f.v.reduce((sum,v)=>sum+v[k],0)/f.v.length),lift=-Math.min(.035,H*.09);for(let k=0;k<3;k++)center[k]=center[k]*.68+f.v[1][k]*.32+n[k]*lift;return f.v.map((a,i)=>({fresh:true,uvBasis,v:[a,f.v[(i+1)%f.v.length],center.slice()]}));});
  const positions=[],normals=[],uv=[],triangles=[];
  for(const f of faces){const a=f.v[0],n=unit3(cross3(f.v[1].map((v,k)=>v-a[k]),f.v[2].map((v,k)=>v-a[k]))),u=f.uvBasis?.u||unit3(f.v[1].map((v,k)=>v-a[k])),v=f.uvBasis?.v||cross3(n,u),projection=f.v.map(t=>[dot3(t,u),dot3(t,v)]),lo=f.uvBasis?.lo||[0,1].map(k=>Math.min(...projection.map(t=>t[k]))),hi=f.uvBasis?.hi||[0,1].map(k=>Math.max(...projection.map(t=>t[k])));
   for(let i=1;i<f.v.length-1;i++){const ids=[0,i,i+1],tri=ids.map(k=>f.v[k]);if(Math.hypot(...cross3(tri[1].map((v,k)=>v-tri[0][k]),tri[2].map((v,k)=>v-tri[0][k])))<EPS)continue;triangles.push(tri);
    for(const k of ids){positions.push(...f.v[k]);normals.push(...n);const U=(projection[k][0]-lo[0])/(hi[0]-lo[0]),V=(projection[k][1]-lo[1])/(hi[1]-lo[1]);const spanU=hi[0]-lo[0],spanV=hi[1]-lo[1],scale=Math.min(1,.64/spanU,.32/spanV);uv.push(.11+(projection[k][0]-lo[0])*scale,.075+(projection[k][1]-lo[1])*scale);}
   }
  }
  const bounds=[0,1,2].flatMap(k=>[Math.min(...faces.flatMap(f=>f.v.map(v=>v[k]))),Math.max(...faces.flatMap(f=>f.v.map(v=>v[k])))]);
  return{positions,normals,uv,triangles,bounds,faces,index};
 });
 if(fragmentCache.size>=64)fragmentCache.delete(fragmentCache.keys().next().value);fragmentCache.set(key,result);return result;
}
function fragmentSurface(p,q,x,z){return convexSurface(fragmentGeometry(p)[q[7]],p,x,z);}
function convexSurface(g,p,x,z){
 const b=g.bounds;if(x<b[0]-EPS||x>b[1]+EPS||z<b[4]-EPS||z>b[5]+EPS)return null;let y=null;
 for(const t of g.triangles){const [a,b,c]=t,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<EPS)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>=-EPS){const h=u*a[1]+v*b[1]+w*c[1]+p.y;if(y===null||h>y)y=h;}}
 return y;
}
function fragmentBlocked(p,q,x,z,r,y,h){return convexBlocked(fragmentGeometry(p)[q[7]],p,x,z,r,y,h);}
function convexBlocked(g,p,x,z,r,y,h){
 const b=g.bounds,Y=y-p.y,H=Y+h;if(Y>=b[3]-EPS||H<=b[2]+EPS||x+r<b[0]||x-r>b[1]||z+r<b[4]||z-r>b[5])return false;
 const roof=convexSurface(g,p,x,z);if(roof!==null&&y>=roof-EPS)return false;
 // Clip the convex stone to the actor's vertical interval, then compare its XZ silhouette.
 const points=[];for(const f of g.faces)for(let i=0;i<f.v.length;i++){const a=f.v[i],b=f.v[(i+1)%f.v.length];if(a[1]>=Y&&a[1]<=H)points.push([a[0],a[2]]);for(const t of [Y,H])if((a[1]-t)*(b[1]-t)<0){const f=(t-a[1])/(b[1]-a[1]);points.push([a[0]+(b[0]-a[0])*f,a[2]+(b[2]-a[2])*f]);}}
 if(points.length<3)return false;points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lo=[],hi=[];for(const v of points){while(lo.length>=2&&turn(lo.at(-2),lo.at(-1),v)<=EPS)lo.pop();lo.push(v);}for(const v of points.slice().reverse()){while(hi.length>=2&&turn(hi.at(-2),hi.at(-1),v)<=EPS)hi.pop();hi.push(v);}const hull=lo.slice(0,-1).concat(hi.slice(0,-1));let inside=true;
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];if(turn(a,b,[x,z])<-EPS)inside=false;const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;if(l<EPS)continue;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l));if((x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2<r*r-EPS)return true;}
 return inside;
}

// Build a shared, dimension-keyed stair surface; floor queries use these same roof triangles.
// Column bevel planes can intersect existing vertices; retain those vertices in the closing face.
function clipPier(faces,plane,fresh=false){
 const n=plane.slice(0,3),d=plane[3],cuts=[],out=[],eps=1e-9;
 const add=p=>{if(!cuts.some(q=>Math.hypot(...p.map((v,k)=>v-q[k]))<eps))cuts.push(p);};
 for(const f of faces){const poly=[];for(let i=0;i<f.v.length;i++){const a=f.v[i],b=f.v[(i+1)%f.v.length],da=dot3(n,a)-d,db=dot3(n,b)-d;
  if(da<=eps){poly.push(a);if(Math.abs(da)<=eps)add(a);}
  if((da<-eps&&db>eps)||(da>eps&&db<-eps)){const t=da/(da-db),v=a.map((x,k)=>x+(b[k]-x)*t);poly.push(v);add(v);}}
  if(poly.length>=3)out.push({v:poly,fresh:f.fresh});}
 if(cuts.length>=3){const c=[0,1,2].map(k=>cuts.reduce((s,v)=>s+v[k],0)/cuts.length),nn=unit3(n),u=unit3(cross3(Math.abs(nn[1])<.9?[0,1,0]:[1,0,0],nn)),v=cross3(nn,u);cuts.sort((a,b)=>{const A=a.map((x,k)=>x-c[k]),B=b.map((x,k)=>x-c[k]);return Math.atan2(dot3(A,v),dot3(A,u))-Math.atan2(dot3(B,v),dot3(B,u));});out.push({v:cuts,fresh});}return out;
}
const pierCache=new Map();
function pierBlocks(p){
 const H=p.height,broken=p.kind==='pier_broken',top=broken?H:H-.38,rows=Math.max(1,Math.ceil((top-.34)/.54)),out=[[-.5,.5,0,.18,-.5,.5],[-.42,.42,.18,.34,-.42,.42]];
 for(let i=0;i<rows;i++){const y=.34+(top-.34)*i/rows,Y=.34+(top-.34)*(i+1)/rows;out.push([-.31,.31,y,Y,-.31,.31]);}
 if(!broken)out.push([-.40,.40,H-.38,H-.19,-.40,.40],[-.5,.5,H-.19,H,-.5,.5]);
 return out;
}
function pierGeometry(p){
 const key=p.kind+':'+p.height;let result=pierCache.get(key);if(result)return result;
 result=pierBlocks(p).map((b,index,all)=>{
  const [x,X,y,Y,z,Z]=b,c=[(x+X)/2,(y+Y)/2,(z+Z)/2],half=[(X-x)/2,(Y-y)/2,(Z-z)/2],last=index===all.length-1;
  let faces=[[[x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z]],[[X,y,Z],[X,y,z],[X,Y,z],[X,Y,Z]],[[x,y,Z],[x,y,z],[X,y,z],[X,y,Z]],[[x,Y,z],[x,Y,Z],[X,Y,Z],[X,Y,z]],[[X,y,z],[x,y,z],[x,Y,z],[X,Y,z]],[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]]].map(v=>({v,fresh:false}));
  for(const [a,b]of[[0,2],[0,1],[1,2]])for(const sa of[-1,1])for(const sb of[-1,1]){
   // Keep the support plane exact; vary exposed wear rather than applying one bevel.
   if(index===0&&((a===1&&sa<0)||(b===1&&sb<0)))continue;
   const shaft=index>=2&&(p.kind==='pier_broken'||index<all.length-2);
   if(shaft&&((a===1&&sa<0)||(b===1&&sb<0)))continue;
   const wearScale=shaft&&(a===1||b===1)?.30:1;
   const radius=Math.min(wearScale*(.065+.065*(.5+.5*Math.sin(index*3.1+a*2+sa+sb*.8))),half[a]*.85,half[b]*.85);
   for(const theta of[Math.PI/8,3*Math.PI/8]){const n=[0,0,0];n[a]=sa*Math.cos(theta);n[b]=sb*Math.sin(theta);faces=clipPier(faces,[...n,dot3(n,c)+Math.cos(theta)*half[a]+Math.sin(theta)*half[b]-radius*(Math.cos(theta)+Math.sin(theta)-1)],false);}
  }
  if(index===1||index%3===0){const n=[.7,.45,index%2?.65:-.65],d=dot3(n,c)+n.reduce((s,v,k)=>s+Math.abs(v)*half[k],0)-Math.min(index===all.length-1?.14:.11,(Y-y)*.65);faces=clipPier(faces,[...n,d],true);}
  if(last&&p.kind==='pier_broken'){
   faces=clipPier(faces,[.30,1,.14,Y-.11],true);
   faces=clipPier(faces,[-.55,1,-.4,Y-.04],true);
  }
  const cuts=[[0,.84,1.98,2.90,4],[0,1.13,1.90,2.92,4],[0,.91,1.72,2.85,4],[0,1.04,2.13,3.04,4],[0,.77,1.81,2.89,4],[0,1.16,2.07,3.11,4],[0,.90,1.97,2.75,4],[0,.82,1.86,3.02,4]],offsets=[0,.46,.13,.61,.25,.74,.08,.52],courses=[0,.5,1.01,1.5,1.99,2.5,3.01,3.5,4];
  const row=(index*3+2)%8,col=(index*7+1)%4,u0=cuts[row][col]-offsets[row],v0=courses[row],uw=cuts[row][col+1]-cuts[row][col],vh=courses[row+1]-courses[row];
  const triangles=[],positions=[],normals=[],uv=[];
  for(const f of faces){const n=unit3(cross3(f.v[1].map((v,k)=>v-f.v[0][k]),f.v[2].map((v,k)=>v-f.v[0][k]))),axis=Math.abs(n[1])>.6?1:Math.abs(n[0])>Math.abs(n[2])?0:2,origin=f.v[0];
   for(let j=1;j<f.v.length-1;j++){const tri=[f.v[0],f.v[j],f.v[j+1]],area=cross3(tri[1].map((v,k)=>v-tri[0][k]),tri[2].map((v,k)=>v-tri[0][k]));if(Math.hypot(...area)<1e-10)continue;triangles.push(tri);
    for(const v of tri){positions.push(...v);normals.push(...unit3(area));const u=axis===0?(v[2]-z)/(Z-z):(v[0]-x)/(X-x),V=axis===1?(v[2]-z)/(Z-z):(v[1]-y)/(Y-y);uv.push(u0+.035+(index%2?1-u:u)*(uw-.07),v0+.035+V*(vh-.07));}
   }
  }
  const bounds=[0,1,2].flatMap(k=>[Math.min(...faces.flatMap(f=>f.v.map(v=>v[k]))),Math.max(...faces.flatMap(f=>f.v.map(v=>v[k])))]);
  return{faces,triangles,positions,normals,uv,bounds};
 });
 if(pierCache.size>=64)pierCache.delete(pierCache.keys().next().value);pierCache.set(key,result);return result;
}
function pierMesh(p){const out={positions:[],normals:[],uv:[]};for(const g of pierGeometry(p)){for(let i=0;i<g.positions.length;i+=3){const v=g.positions.slice(i,i+3),w=world(p,v[0],v[2]),n=g.normals.slice(i,i+3),N=world({...p,x:0,z:0},n[0],n[2]);out.positions.push(w[0],p.y+v[1],w[1]);out.normals.push(N[0],n[1],N[1]);}out.uv.push(...g.uv);}return out;}

// Independent fitted column pieces reuse the proven exposed weathering, not old placements.
// Small cached surface triangulation: vertices follow the carved contour instead of a dense grid.
function buttressTriangulate(points){
 const p=points.slice(),N=p.length;const xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,D=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*8;
 p.push([cx-D,cy-D],[cx+D,cy-D],[cx,cy+D]);let tris=[[N,N+1,N+2]];
 const orient=t=>(p[t[1]][0]-p[t[0]][0])*(p[t[2]][1]-p[t[0]][1])-(p[t[1]][1]-p[t[0]][1])*(p[t[2]][0]-p[t[0]][0]);
 for(let i=0;i<N;i++){
  const bad=[],edges=new Map();for(let j=0;j<tris.length;j++){const t=tris[j],a=p[t[0]],b=p[t[1]],c=p[t[2]],ax=a[0]-p[i][0],ay=a[1]-p[i][1],bx=b[0]-p[i][0],by=b[1]-p[i][1],cx=c[0]-p[i][0],cy=c[1]-p[i][1],det=(ax*ax+ay*ay)*(bx*cy-by*cx)-(bx*bx+by*by)*(ax*cy-ay*cx)+(cx*cx+cy*cy)*(ax*by-ay*bx);if(det>1e-12){bad.push(j);for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}}
  const removed=new Set(bad);tris=tris.filter((_,j)=>!removed.has(j));for(const [a,b]of edges.values()){let t=[a,b,i],v=orient(t);if(Math.abs(v)<1e-12)continue;if(v<0)t=[b,a,i];tris.push(t);}
 }
 return tris.filter(t=>t.every(i=>i<N)).map(t=>[points[t[0]],points[t[2]],points[t[1]]]);
}

// The incision belongs to the stone surface; there are no overlapping leaf objects.
function buttressSurface(faces,index,carved){
 if(index<13||index>15)return faces;
 const out=[];out.surfaceNormals=new Map();
 for(const f of faces){
  const n=unit3(cross3(f.v[1].map((v,k)=>v-f.v[0][k]),f.v[2].map((v,k)=>v-f.v[0][k])));
  if(n[2]>-.90||n[1]<.1){out.push(f);continue;}
  const xs=f.v.map(v=>v[0]),ys=f.v.map(v=>v[1]),lo=[Math.min(...xs),Math.min(...ys)],hi=[Math.max(...xs),Math.max(...ys)];
  const deform=v=>{
   const x=v[0],y=v[1];let border=Infinity;
   for(let k=0;k<f.v.length;k++){const a=f.v[k],b=f.v[(k+1)%f.v.length],dx=b[0]-a[0],dy=b[1]-a[1];border=Math.min(border,Math.abs(dx*(y-a[1])-dy*(x-a[0]))/Math.max(1e-8,Math.hypot(dx,dy)));}
   const t=Math.min(1,border/.065),fade=t*t*(3-2*t);
   let depth=0;
   const patches=index===13?[[-.25,.72,.16,.14,.022],[.20,.45,.09,.07,.013]]:index===15?[[.19,2.15,.16,.20,.025],[-.18,1.92,.13,.09,.014]]:[[.29,1.68,.13,.10,.018]];
   for(const [cx,cy,rx,ry,d]of patches){const u=(x-cx)/rx,w=(y-cy)/ry,r=u*u+w*w;depth+=d*Math.pow(Math.max(0,1-r+.13*Math.sin(x*37+y*23)),2);}
   if(index===14&&carved){
    for(const [side,row]of[[-1,0],[1,0],[-1,1],[1,1]]){
     const ax=side*.024,ay=1.16+row*.26,bx=side*(row&&side>0?.225:.28),by=ay+(row&&side>0?.24:.31),dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy),s=((x-ax)*dx+(y-ay)*dy)/(L*L),w=((x-ax)*dy-(y-ay)*dx)/L;
     if(s>0&&s<1){const width=(side<0?.072:.062)*Math.pow(Math.sin(Math.PI*s),.7),q=Math.abs(w)/width;depth=Math.max(depth,.037*Math.pow(Math.max(0,1-q*q),1.5)*Math.pow(Math.sin(Math.PI*s),1.1));}
    }
    const stem=Math.max(0,1-Math.abs(x-.007*Math.sin(y*9))/.026)*Math.max(0,Math.min(1,(y-1.12)/.06,(1.70-y)/.07));depth=Math.max(depth,.015*stem);
   }
   return[x,y,v[2]+depth*fade];
  };
  const points=[],seen=new Set(),plane=(x,y)=>[x,y,f.v[0][2]-(n[0]*(x-f.v[0][0])+n[1]*(y-f.v[0][1]))/n[2]];
  const add=(x,y)=>{const v=plane(x,y);for(let j=0;j<f.v.length;j++){const a=f.v[j],b=f.v[(j+1)%f.v.length];if((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])>1e-8)return;}const key=[x,y].map(v=>v.toFixed(7)).join(':');if(!seen.has(key)){points.push(v);seen.add(key);}};
  for(let j=0;j<f.v.length;j++){const a=f.v[j],b=f.v[(j+1)%f.v.length],n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.12);for(let k=0;k<n;k++)add(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n);}
  for(let x=lo[0]+.08;x<hi[0];x+=.115)for(let y=lo[1]+.08;y<hi[1];y+=.115)add(x,y);
  if(index===14&&carved){for(const [side,row]of[[-1,0],[1,0],[-1,1],[1,1]]){const ax=side*.024,ay=1.16+row*.26,bx=side*(row&&side>0?.225:.28),by=ay+(row&&side>0?.24:.31),dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy);add(ax,ay);add(bx,by);for(const s of[.08,.20,.36,.53,.70,.85,.95]){const width=(side<0?.072:.062)*Math.pow(Math.sin(Math.PI*s),.7);for(const w of[-1,-.52,0,.52,1])add(ax+dx*s+dy/L*width*w,ay+dy*s-dx/L*width*w);}}for(let y=1.12;y<=1.70;y+=.045)for(const x of[-.027,0,.027])add(x+.007*Math.sin(y*9),y);}
  for(const poly of buttressTriangulate(points)){
   const vs=poly.map(deform);for(let k=0;k<poly.length;k++){const v=poly[k],e=.0004,a=deform([v[0]+e,v[1],v[2]-n[0]/n[2]*e]),b=deform([v[0]-e,v[1],v[2]+n[0]/n[2]*e]),c=deform([v[0],v[1]+e,v[2]-n[1]/n[2]*e]),d=deform([v[0],v[1]-e,v[2]+n[1]/n[2]*e]);out.surfaceNormals.set(vs[k].map(v=>v.toFixed(7)).join(':'),unit3([(a[2]-b[2])/(2*e),(c[2]-d[2])/(2*e),-1]));}out.push({v:vs,fresh:false});
  }

 }
 return out;
}
const buttressCache=new Map();
function buttressGeometry(p){
 const carved=p.finish==='carved'||p._carvedGeometry,key=carved?'carved':'stone';if(buttressCache.has(key))return buttressCache.get(key);
 // Bonded wall core, then battered external courses. End planes are protected joints.
 const blocks=[];for(let j=0;j<6;j++){const ys=j*.5,split=j%2===0?-.18:.29;blocks.push([-1,split,ys,ys+.5,-.25,.25],[split+.008,1,ys,ys+.5,-.25,.25]);}
 blocks.push([-.51,.51,0,.34,-1.25,-.23],[-.44,.44,.34,1.05,-1.10,-.23],[-.40,.40,1.05,1.79,-.91,-.23],[-.37,.37,1.79,2.38,-.73,-.23],[-.44,.44,2.38,2.61,-.82,-.23]);
 const out=[];
 for(let i=0;i<blocks.length;i++){
  const b=blocks[i],c=[(b[0]+b[1])/2,(b[2]+b[3])/2,(b[4]+b[5])/2],half=[(b[1]-b[0])/2,(b[3]-b[2])/2,(b[5]-b[4])/2];let faces=archBox(b);
  for(const [a,k]of[[0,2],[0,1],[1,2]])for(const sa of[-1,1])for(const sb of[-1,1]){
   if((a===1&&sa<0)||(k===1&&sb<0))continue;
   if(i<12&&((a===0&&Math.abs(c[0]+sa*half[0])>.99)||(k===0&&Math.abs(c[0]+sb*half[0])>.99)))continue;
   if(i<12&&k===1&&b[3]<2.99)continue;
   const wear=Math.min(.022+.041*(.5+.5*Math.sin(i*2.19+a*3+sa*.7+sb)),half[a]*.45,half[k]*.45);
   for(const t of[Math.PI/8,3*Math.PI/8]){const n=[0,0,0];n[a]=sa*Math.cos(t);n[k]=sb*Math.sin(t);faces=clipPier(faces,[...n,dot3(n,c)+Math.cos(t)*half[a]+Math.sin(t)*half[k]-wear*(Math.cos(t)+Math.sin(t)-1)],false);}
  }
  if(i>=13&&i<=15){const nz=-.7,ny=.20;faces=clipPier(faces,[0,ny,nz,ny*b[2]+nz*b[4]+.004],false);}
  if(i===10)faces=clipPier(faces,[.25,.8,-.5,dot3([.25,.8,-.5],c)+.25*half[0]+.8*half[1]+.5*half[2]-.07],true);
  if(i===16){faces=clipPier(faces,[-.7,.6,-.4,dot3([-.7,.6,-.4],c)+.7*half[0]+.6*half[1]+.4*half[2]-.075],true);faces=clipPier(faces,[-.4,.8,-.6,dot3([-.4,.8,-.6],c)+.4*half[0]+.8*half[1]+.6*half[2]-.085],true);}
  if(i===12)faces=clipPier(faces,[.6,.3,-.7,dot3([.6,.3,-.7],c)+.6*half[0]+.3*half[1]+.7*half[2]-.12],true);
  faces=buttressSurface(faces,i,carved);const g=facesGeometry(faces);const patch=[[.08,.06],[.63,.55],[1.15,1.06],[.20,2.06]][i%4];
  for(let j=0;j<g.positions.length;j+=3){const n=g.normals.slice(j,j+3),front=i>=13&&i<=15&&g.positions[j+2]<b[4]+(g.positions[j+1]-b[2])*.20/.7+.07,a=front?0:Math.abs(n[0])>.8?2:0,k=front?1:Math.abs(n[1])>.6?2:1,lo=[b[0],b[2],b[4]],hi=[b[1],b[3],b[5]];g.uv[j/3*2]=patch[0]+(g.positions[j+a]-lo[a])/(hi[a]-lo[a])*.39;g.uv[j/3*2+1]=patch[1]+(g.positions[j+k]-lo[k])/(hi[k]-lo[k])*.36;}
  for(let j=0;j<g.positions.length;j+=3){const n=faces.surfaceNormals?.get(g.positions.slice(j,j+3).map(v=>v.toFixed(7)).join(':'));if(n&&g.normals[j+2]<-.05)g.normals.splice(j,3,...n);}out.push(g);
 }
 buttressCache.set(key,out);return out;
}

const offeringCache=new Map();
function offeringGeometry(p){
 const carved=p.finish==='carved'||p._carvedGeometry,key=carved?'carved':'stone';let cached=offeringCache.get(key);if(cached)return cached;
 // Separate worked blocks: protected bearing faces stay exact, exposed edges wear unevenly.
 const blocks=[[-1,0.03,0,.18,-.75,.75],[.04,1,0,.18,-.75,.75],[-.41,.41,.18,.96,-.55,.55],[-.82,-.42,.18,.96,-.55,.55],[.42,.82,.18,.96,-.55,.55],[-1,-.08,.96,1.2,-.71,.71],[-.067,1,.96,1.2,-.71,.71]];
 const out=[];
 for(let i=0;i<blocks.length;i++){
  const b=blocks[i],c=[(b[0]+b[1])/2,(b[2]+b[3])/2,(b[4]+b[5])/2],half=[(b[1]-b[0])/2,(b[3]-b[2])/2,(b[5]-b[4])/2];let faces=archBox(b);
  for(const [a,k]of[[0,2],[0,1],[1,2]])for(const sa of[-1,1])for(const sb of[-1,1]){
   if((a===1&&sa<0)||(k===1&&sb<0))continue;
   const wear=Math.min(.035+.047*(.5+.5*Math.sin(i*3.11+a*2+sa*.83+sb)),half[a]*.6,half[k]*.6);
   for(const t of[Math.PI/8,3*Math.PI/8]){const n=[0,0,0];n[a]=sa*Math.cos(t);n[k]=sb*Math.sin(t);faces=clipPier(faces,[...n,dot3(n,c)+Math.cos(t)*half[a]+Math.sin(t)*half[k]-wear*(Math.cos(t)+Math.sin(t)-1)],false);}
  }
  if(i===0)faces=clipPier(faces,[-.7,.55,-.5,dot3([-.7,.55,-.5],c)+.7*half[0]+.55*half[1]+.5*half[2]-.13],true);
  if(i===5){for(const [nx,nz,loss]of[[-.085,-.04,.032],[-.035,-.07,.024]]){faces=clipPier(faces,[nx,1,nz,1.2+Math.abs(nx)*1+Math.abs(nz)*.71-loss],false);}}
  if(i===6){faces=clipPier(faces,[.045,1,.055,1.2+.045+.055*.71-.024],false);faces=clipPier(faces,[.72,.63,-.36,dot3([.72,.63,-.36],c)+.72*half[0]+.63*half[1]+.36*half[2]-.115],true);faces=clipPier(faces,[.36,.55,-.79,dot3([.36,.55,-.79],c)+.36*half[0]+.55*half[1]+.79*half[2]-.16],true);}
  const g=facesGeometry(faces);const starts=[[.06,.06,.70,.38],[.60,.55,.90,.36],[.21,1.06,.55,.36],[1.15,.56,.44,.35],[.80,3.06,.38,.36],[1.06,2.06,.74,.35],[.70,3.06,.64,.36]],patch=starts[i];
  for(let j=0;j<g.positions.length;j+=3){const v=g.positions.slice(j,j+3),n=g.normals.slice(j,j+3),a=Math.abs(n[0])>.8?2:0,k=Math.abs(n[1])>.6?2:1,lo=[b[0],b[2],b[4]],hi=[b[1],b[3],b[5]];g.uv[j/3*2]=patch[0]+(v[a]-lo[a])/(hi[a]-lo[a])*patch[2];g.uv[j/3*2+1]=patch[1]+(v[k]-lo[k])/(hi[k]-lo[k])*patch[3];}
  out.push(g);
 }
 if(carved){
  // Shallow eight-petal relief is part of the front stone, with one shortened broken petal.
  for(let k=0;k<9;k++){
   let polygon;
   if(k===8)polygon=Array.from({length:10},(_,i)=>{const t=i*Math.PI/5,r=.111+.007*Math.sin(i*1.9);return[Math.cos(t)*r,.56+Math.sin(t)*r];});
   else{const t=k*Math.PI/4,rad=k===5?.263:.32+.022*Math.sin(k*2.1),at=(r,v)=>[Math.cos(t)*r-Math.sin(t)*v,.56+Math.sin(t)*r+Math.cos(t)*v];polygon=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return at(.105+(rad-.105)*(.5+.5*Math.cos(a)),Math.sin(a)*(.067+.006*Math.sin(i*1.7+k)));});}
   const z=k===8?-.579:-.568-.004*Math.sin(k*1.7),cx=polygon.reduce((a,v)=>a+v[0],0)/polygon.length,cy=polygon.reduce((a,v)=>a+v[1],0)/polygon.length;
   const shoulder=polygon.map(([x,y])=>[x,y,z+.009]),front=polygon.map(([x,y])=>[cx+(x-cx)*.76,cy+(y-cy)*.80,z]),back=polygon.map(([x,y])=>[x,y,-.535]);
   const faces=[{v:back.slice().reverse(),fresh:false}],mid=[cx,cy,(z-.535)/2];
   for(let i=0;i<front.length;i++){const j=(i+1)%front.length;faces.push({v:[shoulder[i],shoulder[j],back[j],back[i]],fresh:false});faces.push({v:[front[i],front[j],shoulder[j],shoulder[i]],fresh:k===5&&i===0});faces.push({v:[front[i],[cx,cy,z-.002],front[j]],fresh:false});}
   for(const f of faces){const n=cross3(f.v[1].map((v,j)=>v-f.v[0][j]),f.v[2].map((v,j)=>v-f.v[0][j]));if(dot3(n,f.v[0].map((v,j)=>v-mid[j]))<0)f.v.reverse();}
   const g=facesGeometry(faces);for(let j=0;j<g.positions.length;j+=3){g.uv[j/3*2]=.20+(g.positions[j]+.40)*.65;g.uv[j/3*2+1]=1.07+(g.positions[j+1]-.18)*.48;}out.push(g);
  }
 }
 offeringCache.set(key,out);return out;
}

const columnCache=new Map();
function columnGeometry(p){
 const key=p.kind+':'+p.height;let result=columnCache.get(key);if(result)return result;
 const H=p.kind==='column_shaft'?p.height+.72:3,source=pierGeometry({kind:'pier',height:H});
 const picked=p.kind==='column_base'?source.slice(0,2):p.kind==='column_capital'?source.slice(-2):source.slice(2,-2),dy=p.kind==='column_base'?0:p.kind==='column_capital'?H-.38:.34;
 const shift=v=>[v[0],v[1]-dy,v[2]];
 result=picked.map(g=>({...g,faces:g.faces.map(f=>({...f,v:f.v.map(shift)})),triangles:g.triangles.map(t=>t.map(shift)),positions:g.positions.map((v,i)=>i%3===1?v-dy:v),bounds:g.bounds.map((v,i)=>i===2||i===3?v-dy:v)}));
 if(columnCache.size>=64)columnCache.delete(columnCache.keys().next().value);columnCache.set(key,result);return result;
}
function columnMesh(p){const out={positions:[],normals:[],uv:[]};for(const g of columnGeometry(p)){for(let i=0;i<g.positions.length;i+=3){const w=world(p,g.positions[i],g.positions[i+2]),n=world({...p,x:0,z:0},g.normals[i],g.normals[i+2]);out.positions.push(w[0],p.y+g.positions[i+1],w[1]);out.normals.push(n[0],g.normals[i+1],n[1]);}out.uv.push(...g.uv);}return out;}
const pavingCache=new Map();
function pavingGeometry(p){if(p.burialDepth>0)return buriedPaving(p);
 let found=pavingCache.get(p.kind);if(found)return found;
 const slabs=[[-1,.06,0,.12,-1,-.13],[.074,1,0,.12,-1,-.13],[-1,-.18,0,.12,-.116,1],[-.166,1,0,.12,-.116,1]],raw=[];
 for(let i=0;i<slabs.length;i++){
  const b=slabs[i],c=[(b[0]+b[1])/2,.06,(b[4]+b[5])/2],half=[(b[1]-b[0])/2,.06,(b[5]-b[4])/2];let faces=archBox(b);
  // Worn upper edges, exact resting face. Avoid a uniform bevel width.
  for(const axis of [0,2])for(const sign of [-1,1]){
   const radius=.035+.03*(.5+.5*Math.sin(i*3.7+axis+sign));
   for(const angle of [Math.PI/8,3*Math.PI/8]){const n=[0,Math.sin(angle),0];n[axis]=sign*Math.cos(angle);faces=clipPier(faces,[...n,dot3(n,c)+Math.cos(angle)*half[axis]+Math.sin(angle)*.06-radius*(Math.cos(angle)+Math.sin(angle)-1)],false);}
  }
  const corner=[[-1,-1],[1,-1],[-1,1],[1,1]][i],n=[corner[0],.55,corner[1]],loss=[.22,.13,.18,.11][i];faces=clipPier(faces,[...n,dot3(n,c)+half[0]+.55*.06+half[2]-loss],true);
  if(p.kind==='paving_broken'&&i===3){
   // One lost outer corner and one fracture through a slab; broad worked planes survive.
   faces=clipPier(faces,[1,.15,1,1.59],true);faces=clipPier(faces,[.3,.1,1,1.12],true);
   for(const [section,plane]of [[[0,0,1,.3],[1,0,-.43,.23]],[[0,0,-1,-.3],[1,0,.2,.419]]]){const half=clipPier(faces,section,false);for(const sign of [-1,1]){const cut=plane.map(v=>v*sign);cut[3]-=.012;const f=clipPier(half,cut,true);if(archVolume(f)>1e-8)raw.push({faces:f,b,seed:i+(sign>0?4:0)});}}continue;
  }
  raw.push({faces,b,seed:i});
 }
 const cuts=[[0,.84,1.98,2.90,4],[0,1.13,1.90,2.92,4],[0,.91,1.72,2.85,4],[0,1.04,2.13,3.04,4],[0,.77,1.81,2.89,4],[0,1.16,2.07,3.11,4],[0,.90,1.97,2.75,4],[0,.82,1.86,3.02,4]],offsets=[0,.46,.13,.61,.25,.74,.08,.52],courses=[0,.5,1.01,1.5,1.99,2.5,3.01,3.5,4];
 found=raw.map(({faces,b,seed})=>{const positions=[],normals=[],uv=[],triangles=[],row=(seed*3+1)%8,col=(seed*7+2)%4,u0=cuts[row][col]-offsets[row],v0=courses[row],uw=cuts[row][col+1]-cuts[row][col],vh=courses[row+1]-courses[row];
  for(const f of faces)for(let j=1;j<f.v.length-1;j++){const tri=[f.v[0],f.v[j],f.v[j+1]],area=cross3(tri[1].map((v,k)=>v-tri[0][k]),tri[2].map((v,k)=>v-tri[0][k]));if(Math.hypot(...area)<1e-10)continue;const n=unit3(area);triangles.push(tri);for(const v of tri){positions.push(...v);normals.push(...n);const u=(v[0]-b[0])/(b[1]-b[0]),V=Math.abs(n[1])>.6?(v[2]-b[4])/(b[5]-b[4]):v[1]/.12;uv.push(u0+.035+(seed%2?1-u:u)*(uw-.07),v0+.035+V*(vh-.07));}}
  return{faces,positions,normals,uv,triangles,bounds:[0,1,2].flatMap(k=>[Math.min(...faces.flatMap(f=>f.v.map(v=>v[k]))),Math.max(...faces.flatMap(f=>f.v.map(v=>v[k])))])};
 });pavingCache.set(p.kind,found);return found;
}
function pavingMesh(p){const out={positions:[],normals:[],uv:[]};for(const g of pavingGeometry(p)){for(let i=0;i<g.positions.length;i+=3){const w=world(p,g.positions[i],g.positions[i+2]),n=world({...p,x:0,z:0},g.normals[i],g.normals[i+2]);out.positions.push(w[0],p.y+g.positions[i+1],w[1]);out.normals.push(n[0],g.normals[i+1],n[1]);}out.uv.push(...g.uv);}return out;}

const archCache=new Map();
function archBox(b){const [x,X,y,Y,z,Z]=b;return [[[x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z]],[[X,y,Z],[X,y,z],[X,Y,z],[X,Y,Z]],[[x,y,Z],[x,y,z],[X,y,z],[X,y,Z]],[[x,Y,z],[x,Y,Z],[X,Y,Z],[X,Y,z]],[[X,y,z],[x,y,z],[x,Y,z],[X,Y,z]],[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]]].map(v=>({v,fresh:false}));}
function archVolume(faces){let v=0;for(const f of faces)for(let j=1;j<f.v.length-1;j++)v+=dot3(f.v[0],cross3(f.v[j],f.v[j+1]))/6;return Math.abs(v);}
function archGeometry(p){
 const key=p.kind+':'+p.length+':'+p.height;let result=archCache.get(key);if(result)return result;
 const spring=p.height-1.5,inner=1,outer=1.36,count=11,step=Math.PI/count,broken=p.kind==='arch_broken',raw=[];
 const hole=[[-1,0,0,outer],[1,0,0,outer],[0,-1,0,0]];
 for(let i=0;i<count;i++){const a=(i+.5)*step;hole.push([Math.cos(a),Math.sin(a),0,Math.sin(a)*spring+outer*Math.cos(step/2)]);}
 const subtract=(faces,planes=hole)=>{const out=[];let remaining=faces;for(const plane of planes){const outside=clipPier(remaining,plane.map(v=>-v),false);if(archVolume(outside)>1e-9)out.push(outside);remaining=clipPier(remaining,plane,false);if(archVolume(remaining)<1e-9)break;}return out;};
 const rows=Math.ceil(p.height/.51),rowH=p.height/rows;
 for(let row=0;row<rows;row++){
  const offset=row%2?.43:0,width=.88;let col=0;
  for(let start=-p.length/2-offset;start<p.length/2;start+=width,col++){
   const x=Math.max(-p.length/2,start),X=Math.min(p.length/2,start+width);if(X-x<.04)continue;
   const y=row*rowH,Y=(row+1)*rowH,seed=.5+.5*Math.sin(row*9.7+col*3.3),left=Math.abs(x+p.length/2)<EPS,right=Math.abs(X-p.length/2)<EPS;
   const b=[x+(left?0:.004),X-(right?0:.004),y+(row?.004:0),Y-.004,-.25,.25];let faces=archBox(b),center=[(b[0]+b[1])/2,(b[2]+b[3])/2,0],half=[(b[1]-b[0])/2,(b[3]-b[2])/2,.25];
   for(const axis of[0,1])for(const sign of[-1,1])for(const zsign of[-1,1]){
    if(axis===0&&((sign<0&&left)||(sign>0&&right)))continue;
    if(axis===1&&sign<0)continue;
    const rad=Math.min(.045+.045*seed,half[axis]*.26);
    for(const angle of[Math.PI/8,3*Math.PI/8]){const n=[0,0,zsign*Math.sin(angle)];n[axis]=sign*Math.cos(angle);faces=clipPier(faces,[...n,dot3(n,center)+Math.cos(angle)*half[axis]+Math.sin(angle)*.25-rad*(Math.cos(angle)+Math.sin(angle)-1)],false);}
   }
   if(row===rows-1&&(left||right)){const nx=left?.65:-.58,n=[nx,1,.36];faces=clipPier(faces,[...n,dot3(n,center)+Math.abs(nx)*half[0]+half[1]+.36*.25-(.07+.07*seed)],true);}
   if(!left&&!right&&row===rows-1){const n=[.25*(seed-.5),1,.18];faces=clipPier(faces,[...n,dot3(n,center)+half[1]+.18*.25-(.045+.07*seed)],true);}
   if(broken&&!left&&!right){
    // No unsupported crown fragments: retain only the side shoulders and springers.
    const limit=Math.abs(center[0])<1.35?spring+.18+(center[0]<0?.12:.02):p.height-(center[0]<0?.15:.31);
    faces=clipPier(faces,[center[0]<0?-.15:.18,1,.12,limit+(center[0]<0?-.15:.18)*center[0]],true);
   }
   const below=clipPier(faces,[0,1,0,spring],false),above=clipPier(faces,[0,-1,0,-spring],false);
   for(const piece of [...subtract(below,[[-1,0,0,inner],[1,0,0,inner]]),...subtract(above)])if(archVolume(piece)>1e-9)raw.push({faces:piece,b,seed:row*7+col,ring:false});
  }
 }
 for(let i=0;i<count;i++){
  if(broken&&i>1&&i<count-2)continue;
  const a=i*step,b=(i+1)*step,c=[Math.cos(a),Math.sin(a)],d=[Math.cos(b),Math.sin(b)];
  const polygon=[[inner*c[0],spring+inner*c[1]],[outer*c[0],spring+outer*c[1]],[outer*d[0],spring+outer*d[1]],[inner*d[0],spring+inner*d[1]]];
  let faces=[{v:polygon.map(v=>[v[0],v[1],-.25]).reverse(),fresh:false},{v:polygon.map(v=>[v[0],v[1],.25]),fresh:false}];
  for(let j=0;j<4;j++){const v=polygon[j],w=polygon[(j+1)%4];faces.push({v:[[v[0],v[1],-.25],[w[0],w[1],-.25],[w[0],w[1],.25],[v[0],v[1],.25]],fresh:false});}
  for(let j=0;j<4;j++)for(const zsign of[-1,1]){const v=polygon[j],w=polygon[(j+1)%4],dx=w[0]-v[0],dy=w[1]-v[1],len=Math.hypot(dx,dy),n=[dy/len,-dx/len,0],plane=dot3(n,[v[0],v[1],0]),rad=.035+.025*(.5+.5*Math.sin(i*2.8+j));
   for(const angle of[Math.PI/8,3*Math.PI/8])faces=clipPier(faces,[n[0]*Math.cos(angle),n[1]*Math.cos(angle),zsign*Math.sin(angle),plane*Math.cos(angle)+.25*Math.sin(angle)-rad*(Math.cos(angle)+Math.sin(angle)-1)],false);
  }
  if(i===2||i===7||broken){const mid=(a+b)/2,n=[Math.cos(mid)*.6,Math.sin(mid)*.6,.8],point=[outer*Math.cos(mid),spring+outer*Math.sin(mid),.25];faces=clipPier(faces,[...n,dot3(n,point)-.07],true);}
  if(broken&&(i===1||i===count-2)){const mid=(a+b)/2,n=[Math.cos(mid)*.45,1,i===1?.36:-.24],point=[outer*Math.cos(mid),spring+outer*Math.sin(mid),0];faces=clipPier(faces,[...n,dot3(n,point)-.06],true);}
  if(archVolume(faces)>1e-9)raw.push({faces,seed:53+i,ring:true,a,b});
 }
 if(broken){const pieces=archGeometry({...p,kind:'arch'}).filter(g=>g.ring);for(const [j,index]of [5,8].entries()){
  const g=pieces[index],b=g.bounds,cx=(b[0]+b[1])/2,cy=(b[2]+b[3])/2,scale=j?.78:1.05,angle=j?-.33:.28,cs=Math.cos(angle),sn=Math.sin(angle);
  let faces=g.faces.map(f=>({...f,v:f.v.map(v=>{const x=(v[0]-cx)*scale,z=(v[1]-cy)*scale;return[(j?-1.3:1.3)+x*cs+z*sn,(v[2]+.25)*.55-.008,.72-x*sn+z*cs];}).reverse()}));
  // One impact scar breaks a former corner; preserve the broad worked face and resting face.
  const n=j?[.8,1,-.5]:[-.7,1,.8],limit=Math.max(...faces.flatMap(f=>f.v.map(v=>dot3(n,v))));
  faces=clipPier(faces,[...n,limit-(j?.13:.17)],true);
  const bounds=[0,1,2].flatMap(k=>[Math.min(...faces.flatMap(f=>f.v.map(v=>v[k]))),Math.max(...faces.flatMap(f=>f.v.map(v=>v[k])))]);
  raw.push({faces,b:bounds,seed:91+j,ring:false,ground:true});
 }}
 const cuts=[[0,.84,1.98,2.90,4],[0,1.13,1.90,2.92,4],[0,.91,1.72,2.85,4],[0,1.04,2.13,3.04,4],[0,.77,1.81,2.89,4],[0,1.16,2.07,3.11,4],[0,.90,1.97,2.75,4],[0,.82,1.86,3.02,4]],offsets=[0,.46,.13,.61,.25,.74,.08,.52],courses=[0,.5,1.01,1.5,1.99,2.5,3.01,3.5,4];
 result=raw.map(part=>{const faces=part.faces,bounds=[0,1,2].flatMap(k=>[Math.min(...faces.flatMap(f=>f.v.map(v=>v[k]))),Math.max(...faces.flatMap(f=>f.v.map(v=>v[k])))]),positions=[],normals=[],uv=[],triangles=[],row=(part.seed*3+2)%8,col=(part.seed*7+1)%4,u0=cuts[row][col]-offsets[row],v0=courses[row],uw=cuts[row][col+1]-cuts[row][col],vh=courses[row+1]-courses[row];
  for(const f of faces)for(let j=1;j<f.v.length-1;j++){const tri=[f.v[0],f.v[j],f.v[j+1]],area=cross3(tri[1].map((v,k)=>v-tri[0][k]),tri[2].map((v,k)=>v-tri[0][k]));if(Math.hypot(...area)<1e-10)continue;const n=unit3(area);triangles.push(tri);
   for(const v of tri){positions.push(...v);normals.push(...n);let u,V;if(part.ring){const angle=Math.atan2(v[1]-spring,v[0]);u=(angle-part.a)/(part.b-part.a);V=(Math.hypot(v[0],v[1]-spring)-inner)/(outer-inner);}else{const b=part.b;u=Math.abs(n[0])>.7?(v[2]+.25)/.5:(v[0]-b[0])/(b[1]-b[0]);V=Math.abs(n[1])>.7?(v[2]+.25)/.5:(v[1]-b[2])/(b[3]-b[2]);}uv.push(u0+.035+u*(uw-.07),v0+.035+V*(vh-.07));}
  }return{faces,positions,normals,uv,triangles,bounds,ring:part.ring,ground:!!part.ground};});
 if(archCache.size>=32)archCache.delete(archCache.keys().next().value);archCache.set(key,result);return result;
}
function archMesh(p){const out={positions:[],normals:[],uv:[]};for(const g of archGeometry(p)){for(let i=0;i<g.positions.length;i+=3){const v=g.positions.slice(i,i+3),w=world(p,v[0],v[2]),n=g.normals.slice(i,i+3),N=world({...p,x:0,z:0},n[0],n[2]);out.positions.push(w[0],p.y+v[1],w[1]);out.normals.push(N[0],n[1],N[1]);}out.uv.push(...g.uv);}return out;}

const stairCache=new Map();
function stairShape(p){
 const key=[p.width,p.length,p.height,p.finish].join(':');if(stairCache.has(key))return stairCache.get(key);
 const n=Math.ceil(p.height/.24),run=p.length/n,rise=p.height/n,hw=p.width/2,hl=p.length/2;
 const xs=[-hw,-hw+.065,-hw*.68,-hw*.32,hw*.12,hw*.51,hw-.065,hw],positions=[],normals=[],uv=[],roofs=[];
 const edgePoint=q=>{const a=q.slice();if(a[1]<=EPS||Math.abs(a[2]-hl)<EPS)return a;
  const side=Math.max(0,1-(hw-Math.abs(a[0]))/.065),heightBand=Math.min(1,a[1]/.15),wear=(.020+.012*(.5+.5*Math.sin(a[2]*3.7)))*side*heightBand;
  a[1]-=wear;return a;};
 const emit=(a,b,c,up=false)=>{a=edgePoint(a);b=edgePoint(b);c=edgePoint(c);const normal=unit3(cross3(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k])));positions.push(...a,...b,...c);for(const q of [a,b,c]){normals.push(...normal);const axis=Math.abs(normal[1])>.5?1:Math.abs(normal[0])>Math.abs(normal[2])?0:2;uv.push(axis===0?q[2]:q[0],axis===1?q[2]:q[1]);}if(up)roofs.push([a,b,c]);};
 const face=(a,b,c,d,up=false)=>{emit(a,b,c,up);emit(a,c,d,up);};
 const f=p.finish==='worn'?1:.7;
 for(let k=0;k<n;k++){
  const z=-hl+k*run,Z=z+run,y=(k+1)*rise,below=k*rise;
  // A few broad, offset depressions rather than the same bevel on every tread.
  // The rear contact remains exact. Floor queries and exported Collider share this roof.
  const wornSteps=[1,4,7],centres=[-.58,.43,-.28],amplitudes=[.105,.145,.085];
  const j=wornSteps.indexOf(k),centre=j<0?0:hw*centres[j];
  const row=xs.map((x,i)=>{const s=.5+.5*Math.sin(k*2.31+i*1.87),major=(k+i*2)%5===0?1:0,
   broad=j<0?0:Math.max(0,1-Math.abs(x-centre)/(hw*.60)),
   scar=(k===3&&i===0)||(k===7&&i===5)?1:0,
   depth=k===0?0:Math.min(run*.58,(.018+.017*s+.020*major+.070*scar+(j<0?0:amplitudes[j])*broad)*f),
   drop=Math.min(rise*.43,(k===0?.020+.008*s:.014+.015*s+.016*major+.055*scar+.074*broad)*f),
   bevelWidth=.028+.017*s+.065*broad;
   return{x,front:z+depth,bevel:Math.min(Z-.025,z+depth+bevelWidth),drop};});
  for(let i=0;i<xs.length-1;i++){
   const a=row[i],b=row[i+1];
   face([a.x,y,a.bevel],[a.x,y,Z],[b.x,y,Z],[b.x,y,b.bevel],true);
   const amid=[a.x,y-a.drop*.293,a.front+(a.bevel-a.front)*.293],bmid=[b.x,y-b.drop*.293,b.front+(b.bevel-b.front)*.293];
   face([a.x,y-a.drop,a.front],amid,bmid,[b.x,y-b.drop,b.front],true);
   face(amid,[a.x,y,a.bevel],[b.x,y,b.bevel],bmid,true);
   face([b.x,below,b.front],[a.x,below,a.front],[a.x,y-a.drop,a.front],[b.x,y-b.drop,b.front]);
   // Flat previous tread joins the worn riser: no gap beneath the recessed nose.
   if(k>0)face([a.x,below,z],[a.x,below,a.front],[b.x,below,b.front],[b.x,below,z],true);
  }
  for(const i of [0,row.length-1]){const q=row[i],x=q.x,poly=[[x,0,z],[x,0,Z],[x,y,Z],[x,y,q.bevel],[x,y-q.drop*.293,q.front+(q.bevel-q.front)*.293],[x,y-q.drop,q.front],[x,below,q.front],[x,below,z]];if(i!==0)poly.reverse();for(let j=1;j<poly.length-1;j++){const a=poly[0],b=poly[j],c=poly[j+1],cross=cross3(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k]));if(Math.hypot(...cross)>EPS)emit(a,b,c);}}
 }
 face([-hw,0,hl],[hw,0,hl],[hw,p.height,hl],[-hw,p.height,hl]);
 face([-hw,0,-hl],[hw,0,-hl],[hw,0,hl],[-hw,0,hl]);
 const result={positions,normals,uv,roofs};if(stairCache.size>=64)stairCache.delete(stairCache.keys().next().value);stairCache.set(key,result);return result;
}
function stairSurface(p,x,z){let high=null;for(const [a,b,c]of stairShape(p).roofs){if(x<Math.min(a[0],b[0],c[0])-EPS||x>Math.max(a[0],b[0],c[0])+EPS||z<Math.min(a[2],b[2],c[2])-EPS||z>Math.max(a[2],b[2],c[2])+EPS)continue;const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<EPS)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>=-EPS){const h=u*a[1]+v*b[1]+w*c[1];if(high===null||h>high)high=h;}}return high;}
function stairMesh(p){const g=stairShape(p),positions=[],normals=[],uv=[],variant=surfaceVariant(p),du=[0,.5,1,1.5][variant],dv=[0,.5,1.5,1][variant];for(let i=0;i<g.positions.length;i+=3){const w=world(p,g.positions[i],g.positions[i+2]),n=world({...p,x:0,z:0},g.normals[i],g.normals[i+2]);positions.push(w[0],p.y+g.positions[i+1],w[1]);normals.push(n[0],g.normals[i+1],n[1]);}for(let i=0;i<g.uv.length;i+=2)uv.push(g.uv[i]+du,g.uv[i+1]+dv);return{positions,normals,uv};}

// Real recessed joints and local missing corners, aligned with the shared 2m stone atlas.
function masonryFaces(p,bs,emit,du,dv){
 const courses=[0,.50,1.01,1.50,1.99,2.50,3.01,3.50,4],offsets=[0,.46,.13,.61,.25,.74,.08,.52];
 const cuts=[[0,.84,1.98,2.90,4],[0,1.13,1.90,2.92,4],[0,.91,1.72,2.85,4],[0,1.04,2.13,3.04,4],[0,.77,1.81,2.89,4],[0,1.16,2.07,3.11,4],[0,.90,1.97,2.75,4],[0,.82,1.86,3.02,4]];
 for(const box of bs)for(const sign of [-1,1]){
  const z=sign<0?box[4]:box[5],lo=box[0],hi=box[1],low=box[2],high=box[3]-.13;
  if(Math.abs(z-sign*.25)>EPS)continue;
  for(let cycle=Math.floor((low+dv)/4)-1;cycle<=Math.ceil((high+dv)/4);cycle++)for(let r=0;r<8;r++){
   const Y=Math.max(low,cycle*4+courses[r]-dv),V=Math.min(high,cycle*4+courses[r+1]-dv);if(V-Y<.015)continue;
   for(let tile=Math.floor((lo+du+offsets[r])/4)-1;tile<=Math.ceil((hi+du+offsets[r])/4);tile++)for(let c=0;c<4;c++){
    const left=tile*4-du-offsets[r]+cuts[r][c],right=tile*4-du-offsets[r]+cuts[r][c+1],x=Math.max(lo,left),X=Math.min(hi,right);if(X-x<.015)continue;
    const seed=Math.abs(Math.sin((r+31)*18.71+(tile+7)*9.21+c*2.31)),dx=Math.min(.023,(X-x)*.12),dy=Math.min(.023,(V-Y)*.12),chip=Math.min((X-x)*.16,(V-Y)*.25,.025+seed*.080);
    const inner=[[x+dx,Y+dy+chip],[x+dx+chip*.68,Y+dy],[X-dx-chip*.2,Y+dy],[X-dx,Y+dy+chip*.22],[X-dx,V-dy-chip*.65],[X-dx-chip*.8,V-dy],[x+dx+chip*.32,V-dy],[x+dx,V-dy-chip*.25]];
    const outer=[[x,Y],[X,Y],[X,V],[x,V]],depth=.002+seed*.008;
    const at=(q,inside)=>[q[0],q[1],z-sign*(inside?depth:0.023)];
    const inn=inner.map(v=>at(v,true)),out=outer.map(v=>at(v,false));
    // Exact outer boundary keeps socket and neighboring face contact closed.
    for(let k=0;k<4;k++)if(Math.abs(out[k][0]-lo)<EPS||Math.abs(out[k][0]-hi)<EPS||Math.abs(out[k][1]-low)<EPS||Math.abs(out[k][1]-high)<EPS)out[k][2]=z;
    const tri=(a,b,c)=>{if(sign<0)emit(a,c,b);else emit(a,b,c);};
    for(let k=1;k<7;k++)tri(inn[0],inn[k],inn[k+1]);
    for(let k=0;k<4;k++){const a=k*2,b=k*2+1,c=(k*2+2)%8,next=(k+1)%4;tri(out[k],inn[b],inn[a]);tri(out[k],out[next],inn[c]);tri(out[k],inn[c],inn[b]);}
   }
  }
 }
}

function floor(m,x,z,margin=0){let result=null;for(const raw of m.items){if(raw.kind==='buttress_wall'){const p=resolved(raw,m),[a,b]=local(p,x,z);for(const g of buttressGeometry(p)){const y=convexSurface(g,p,a,b);if(y!==null&&(!result||y>result.y))result={y,id:p.id,kind:p.kind};}continue;}if(raw.kind==='offering_table'){const p=resolved(raw,m),[a,b]=local(p,x,z);for(const g of offeringGeometry(p)){const y=convexSurface(g,p,a,b);if(y!==null&&(!result||y>result.y))result={y,id:p.id,kind:p.kind};}continue;}if(raw.kind==='soil_bank'||raw.kind==='wall_ruined'&&raw.fracture){const p=resolved(raw,m),[a,b]=local(p,x,z),parts=p.kind==='soil_bank'?soilGeometry(p):collapseGeometry(p);for(const g of parts){const y=convexSurface(g,p,a,b);if(y!==null&&y>p.y+EPS&&(!result||y>result.y))result={y,id:p.id,kind:p.kind==='soil_bank'?'soil_bank':'rubble'};}continue;}if(COLUMN_PARTS.includes(raw.kind)){const p=resolved(raw,m),[a,b]=local(p,x,z);for(const g of columnGeometry(p)){const y=convexSurface(g,p,a,b);if(y!==null&&(!result||y>result.y))result={y,id:p.id,kind:p.kind};}continue;}if(raw.kind==='paving'||raw.kind==='paving_broken'){const p=resolved(raw,m),[a,b]=local(p,x,z);for(const g of pavingGeometry(p)){const y=convexSurface(g,p,a,b);if(y!==null&&y>=p.y-EPS&&(!result||y>result.y))result={y,id:p.id,kind:p.kind};}continue;}if(raw.kind==='arch_broken'){const p=resolved(raw,m),[a,b]=local(p,x,z);for(const g of archGeometry(p).filter(v=>v.ground)){const y=convexSurface(g,p,a,b);if(y!==null&&(!result||y>result.y))result={y,id:p.id,kind:'rubble'};}continue;}if(raw.kind==='pier'||raw.kind==='pier_broken'){const p=resolved(raw,m),[a,b]=local(p,x,z);for(const g of pierGeometry(p)){const y=convexSurface(g,p,a,b);if(y!==null&&(!result||y>result.y))result={y,id:p.id,kind:'pier'};}continue;}if(raw.kind==='wall_ruined'){const p=resolved(raw,m),[a,b]=local(p,x,z);for(const q of boxes(p).filter(q=>q.length>6)){const y=fragmentSurface(p,q,a,b);if(y!==null&&y>p.y+EPS&&(!result||y>result.y))result={y,id:p.id,kind:'rubble'};}continue;}if(raw.kind!=='platform'&&raw.kind!=='stairs')continue;const p=resolved(raw,m),[a,b]=local(p,x,z),hw=(p.kind==='stairs'?p.width:p.length)/2,hl=(p.kind==='stairs'?p.length:p.width)/2;
  if(Math.abs(a)>hw-margin+EPS||Math.abs(b)>hl+EPS)continue;
  let y=p.y+p.height;if(p.kind==='platform'&&Math.abs(b)>hl-margin+EPS)continue;
  if(p.kind==='platform'){const h=platformSurface(p,a,b);if(h===null)continue;y=p.y+h;}
  if(p.kind==='stairs'){const h=stairSurface(p,a,b);if(h===null)continue;y=p.y+h;}
  if(!result||y>result.y)result={y,id:p.id,kind:p.kind};}return result;}
function blocked(m,x,z,r,y,h){for(const raw of m.items){if(raw.kind==='soil_bank'||raw.kind==='platform'||raw.kind==='stairs'||raw.kind==='paving'||raw.kind==='paving_broken')continue;const p=resolved(raw,m),[a,b]=local(p,x,z);if(p.kind==='buttress_wall'){if(buttressGeometry(p).some(g=>convexBlocked(g,p,a,b,r,y,h)))return true;continue;}if(p.kind==='offering_table'){if(offeringGeometry(p).some(g=>convexBlocked(g,p,a,b,r,y,h)))return true;continue;}if(p.kind==='wall_ruined'&&p.fracture){if(collapseGeometry(p).some(g=>convexBlocked(g,p,a,b,r,y,h)))return true;continue;}if(COLUMN_PARTS.includes(p.kind)){if(columnGeometry(p).some(g=>convexBlocked(g,p,a,b,r,y,h)))return true;continue;}if(p.kind==='arch'||p.kind==='arch_broken'){if(archGeometry(p).some(g=>convexBlocked(g,p,a,b,r,y,h)))return true;continue;}if(p.kind==='pier'||p.kind==='pier_broken'){if(pierGeometry(p).some(g=>convexBlocked(g,p,a,b,r,y,h)))return true;continue;}for(const q of boxes(p)){if(q.length>6){if(fragmentBlocked(p,q,a,b,r,y,h))return true;continue;}const roof=p.y+q[3];if(y+h<=p.y+q[2]+EPS||y>=roof-EPS)continue;const cx=(q[0]+q[1])/2,cz=(q[4]+q[5])/2,c=Math.cos(q[6]||0),s=Math.sin(q[6]||0),ax=cx+(a-cx)*c-(b-cz)*s,bz=cz+(a-cx)*s+(b-cz)*c,dx=Math.max(q[0]-ax,0,ax-q[1]),dz=Math.max(q[4]-bz,0,bz-q[5]);if(dx*dx+dz*dz<r*r-EPS)return true;}}return false;}
function gridPoints(p){if(p.kind==='offering_table')return[{x:p.x,z:p.z}];if(p.kind==='stone_beam')return[-1,1].map(sign=>{const a=world(p,sign*p.length/2,0);return{x:a[0],z:a[1]};});if(COLUMN_PARTS.includes(p.kind))return[{x:p.x,z:p.z}];const s=sockets(p);if(s.length)return s;const b=footprint(p);return[{x:b[0],z:b[4]},{x:b[1],z:b[5]}];}
function snap(m,item,options={}){let p={...item};const step=options.grid?GRID:0;if(step){const a=gridPoints(p)[0];p.x+=Math.round(a.x/step)*step-a.x;p.z+=Math.round(a.z/step)*step-a.z;}

 if(p.kind==='stone_beam'){
  delete p.supportId;delete p.mountId;delete p.upperId;delete p.beamSupports;
  const candidates=[],supports=m.items.filter(v=>v.id!==p.id&&['pier','column_capital'].includes(v.kind)).map(v=>resolved(v,m));
  for(let i=0;i<supports.length;i++)for(let j=0;j<i;j++){const a=supports[j],b=supports[i],v=local({...p,x:a.x,z:a.z},b.x,b.z);if(Math.abs(v[1])>EPS||Math.abs(Math.abs(v[0])-p.length)>EPS||Math.abs(a.y+a.height-b.y-b.height)>EPS)continue;const x=(a.x+b.x)/2,z=(a.z+b.z)/2,d=Math.hypot((options.join?item:p).x-x,(options.join?item:p).z-z),limit=options.join?.55:EPS;if(d>limit)continue;if(step&&[a,b].some(v=>Math.abs(v.x/step-Math.round(v.x/step))>EPS||Math.abs(v.z/step-Math.round(v.z/step))>EPS))continue;const key='beam:'+a.id+':'+b.id;candidates.push({item:{...p,x,z,y:a.y+a.height,beamSupports:[a.id,b.id]},snapped:!!options.join,key,d,priority:options.previous===key?-1:0,reason:'柱頭2点に支持された石梁'});}
  candidates.sort((a,b)=>a.priority-b.priority||a.d-b.d||a.key.localeCompare(b.key));return candidates[0]||{item:p,snapped:false,reason:'指定した柱心間・向き・高さに合う柱頭2点が必要です'};
 }
 if(!options.join)return{item:p,snapped:false};
 if(p.kind==='column_shaft'||p.kind==='column_capital'){
  const want=p.kind==='column_shaft'?'column_base':'column_shaft',choices=[];let why='';
  for(const other of m.items){if(other.id===p.id||other.kind!==want)continue;const b=resolved(other,m),d=Math.hypot(item.x-b.x,item.z-b.z);if(d>.55)continue;
   if(m.items.some(v=>v.id!==p.id&&v.mountId===other.id)){why='支持部材は使用中です';continue;}
   if(step&&(Math.abs(b.x/step-Math.round(b.x/step))>EPS||Math.abs(b.z/step-Math.round(b.z/step))>EPS)){why='柱中心が格子外です';continue;}
   const key='mount:'+other.id;choices.push({item:{...p,x:b.x,z:b.z,y:b.y+b.height,supportId:undefined,mountId:other.id},snapped:true,key,d,priority:options.previous===key?-1:0,reason:'柱の支持面に接合'});
  }choices.sort((a,b)=>a.priority-b.priority||a.d-b.d||a.key.localeCompare(b.key));if(choices.length)return choices[0];if(why)return{item:p,snapped:false,reason:why};
 }
const straight=q=>['wall','wall_broken','wall_ruined','opening','opening_broken','window_wall','wall_niche','balustrade','edge'].includes(q.kind);
  const candidates=[],source=sockets(resolved(p,m)),rawSource=sockets(resolved(item,m));let rejected='';
  // 壁厚の半分だけずらし、直交する壁の外角と端面を合わせる。
  if(straight(p))for(const other of m.items){
   if(other.id===p.id||!straight(other))continue;
   for(const b of sockets(resolved(other,m)))for(const a of rawSource){
    if(Math.abs(a.dx*b.dx+a.dz*b.dz)>EPS||Math.abs(a.y-b.y)>EPS||Math.abs(a.height-b.height)>EPS)continue;
    const x=b.x-b.dx*a.thickness/2-a.dx*b.thickness/2,z=b.z-b.dz*a.thickness/2-a.dz*b.thickness/2,d=Math.hypot(a.x-x,a.z-z);
    if(d>.4)continue;const q={...p,x:item.x+x-a.x,z:item.z+z-a.z};
    if(step&&gridPoints(q).some(v=>Math.abs(v.x/(step/2)-Math.round(v.x/(step/2)))>EPS||Math.abs(v.z/(step/2)-Math.round(v.z/(step/2)))>EPS))continue;
    const key='corner:'+b.id+':'+b.index+':'+a.index;
    candidates.push({item:q,snapped:true,key,d,priority:options.previous===key?-1:0,reason:'直角の壁端に一致（壁厚の半分を補正）'});
   }
  }
 for(const other of m.items){if(other.id===p.id)continue;for(const b of sockets(resolved(other,m)))for(const a of (straight(p)&&straight(other)?rawSource:source)){const d=Math.hypot(a.x-b.x,a.z-b.z);if(d>.3||(a.family||'wall')!==(b.family||'wall'))continue;
  if(Math.abs(a.y-b.y)>EPS||Math.abs(a.height-b.height)>EPS){rejected='高さ不一致';continue;}if(a.dx*b.dx+a.dz*b.dz>-.9999){rejected='接合方向不一致';continue;}
  const origin=straight(p)&&straight(other)?item:p,q={...p,x:origin.x+b.x-a.x,z:origin.z+b.z-a.z},joinStep=straight(p)&&straight(other)?step/2:step;if(step&&gridPoints(q).some(v=>Math.abs(v.x/joinStep-Math.round(v.x/joinStep))>EPS||Math.abs(v.z/joinStep-Math.round(v.z/joinStep))>EPS)){rejected='格子外の接合点';continue;}
  const key=b.id+':'+b.index+':'+a.index;candidates.push({item:q,snapped:true,key,d,priority:options.previous===key&&d<.3?-1:0});}}
 candidates.sort((a,b)=>a.priority-b.priority||a.d-b.d||a.key.localeCompare(b.key));return candidates[0]||{item:p,snapped:false,reason:rejected};}
// 軸整列した箱の和集合から内部面を除く。階段・角・T字の重複面を残さない。
function surfaceVariant(p){if(p.kind==='window_wall')return 0;if(p.kind==='balustrade')return 0;if(p.kind==='wall_niche')return 0;if(p._trim||TRIM_PARTS.includes(p.kind))return 0;if(COLUMN_PARTS.includes(p.kind))return 0;if(['paving','paving_broken','wall','wall_broken','wall_ruined','opening','opening_broken','end','pier','pier_broken','arch','arch_broken'].includes(p.kind))return 0;let h=2166136261;for(const c of p.id||'preview')h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%4;}
// Selective edge loss: sockets, bearing bottoms and the central stair lane stay exact.
function wearAxes(p,axes,bs){
 const add=(k,values)=>{const lo=axes[k][0],hi=axes[k].at(-1);axes[k]=[...new Set([...axes[k],...values.filter(v=>v>lo+EPS&&v<hi-EPS)])].sort((a,b)=>a-b);};
 if(p.kind==='window_wall'){for(const x of [-.45,.45])add(0,[x-.06,x-.02,x+.02,x+.06]);for(const y of [.9,p.height-.35])add(1,[y-.06,y-.02,y+.02,y+.06]);return;}
 if(p.kind==='balustrade'){for(const x of [-.78,-.39,-.21,.21,.39,.78])add(0,[x-.025,x+.025]);for(const y of [.18,.88])add(1,[y-.023,y+.023]);return;}
 if(p.kind==='wall_niche'){add(0,[-.38,-.21,.08,.32]);for(const x of [-.55,.55])add(0,[x-.076,x-.023,x+.023,x+.076]);for(const y of [.5,p.height-.35])add(1,[y-.076,y-.023,y+.023,y+.076]);add(2,[-.227,-.174]);return;}
 if(p.kind==='stairs'){add(0,[-p.width/2+.16,p.width/2-.16]);return;}
 if(p.kind==='platform'){
  // Only three broad exposure patches; flat interiors are merged again below.
  add(0,[-p.length*.38,-p.length*.24,-p.length*.10,p.length*.20,p.length*.33,p.length*.46,-p.length/2+.22,p.length/2-.22]);
  add(2,[-p.width*.31,-p.width*.12,p.width*.07,-p.width/2+.22,p.width/2-.22]);
  add(1,[p.height-.22,p.height-.075,p.height*.47]);return;
 }
 if(['wall','edge','wall_broken','wall_ruined'].includes(p.kind)){const c=-p.length*.21;add(0,[c-.23,c,c+.23,p.length*.23]);if(p.kind==='wall_ruined'||p.kind==='wall_broken'){add(0,[-p.length*.435,-p.length*.075,p.length*.445]);add(1,bs.map(b=>b[3]-.28));}add(1,bs.map(b=>b[3]-.13));add(2,[0]);return;}
 add(1,[p.height*.47]);if(['opening','opening_broken','end'].includes(p.kind))add(1,[p.height-.13]);
 if(['corner_in','corner_out','tee','end'].includes(p.kind)){add(0,[-.227,-.174,0,.174,.227]);add(2,[-.227,-.174,0,.174,.227]);}
}
const platformRoofCache=new Map();
function platformSurface(p,x,z){
 // Query the same Float32 local vertices used by Web buffers and Unity MeshCollider.
 x=Math.fround(x);z=Math.fround(z);
 const key=JSON.stringify([p.length,p.width,p.height,p.finish,p._bearing||[]]);
 let g=platformRoofCache.get(key);if(!g){const source=mesh({...p,x:0,y:0,z:0,rot:0});g={positions:source.positions.map(Math.fround),normals:source.normals};if(platformRoofCache.size>=64)platformRoofCache.delete(platformRoofCache.keys().next().value);platformRoofCache.set(key,g);}
 let high=null;for(let i=0;i<g.positions.length;i+=9){if(g.normals[i+1]<=.001)continue;const a=g.positions.slice(i,i+3),b=g.positions.slice(i+3,i+6),c=g.positions.slice(i+6,i+9),d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);const area=Math.abs(d),roundoff=Number.EPSILON*16*Math.max(Math.abs((b[2]-c[2])*(a[0]-c[0])),Math.abs((c[0]-b[0])*(a[2]-c[2])),Number.MIN_VALUE);if(area<=roundoff)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,w=1-u-v;if(Math.min(u,v,w)>=-EPS){const y=u*a[1]+v*b[1]+w*c[1];if(high===null||y>high)high=y;}}
 return high;
}
function roundOldEdges(p,a,bs){
 const atSocket=sockets({...p,x:0,y:0,z:0,rot:0}).some(e=>Math.abs((a[0]-e.x)*e.dx+(a[2]-e.z)*e.dz)<EPS),r=atSocket?.065:.058+.018*(.5+.5*Math.sin(a[0]*2.2+a[1]*1.8+a[2]*2.7)),q=a.slice(),inside=t=>bs.some(b=>t[0]>b[0]-EPS&&t[0]<b[1]+EPS&&t[1]>b[2]-EPS&&t[1]<b[3]+EPS&&t[2]>b[4]-EPS&&t[2]<b[5]+EPS);
 if(a[1]<EPS)return q;
 if(p.kind==='platform'&&(p._bearing||[]).some(b=>a[0]>=b[0]-.025&&a[0]<=b[1]+.025&&a[2]>=b[2]-.025&&a[2]<=b[3]+.025))return q;
 const offsets=[0,0,0];let count=0;
 for(let k=0;k<3;k++){
  let best=null;
  for(const b of bs)for(const side of [0,1]){const edge=b[k*2+side],sign=side?1:-1,d=(edge-a[k])*sign;if(d< -EPS||d>=r)continue;
   const t=a.slice();t[k]=edge+sign*.0001;if(inside(t))continue;
   // Sockets retain their longitudinal boundary. Their exposed top profile
   // can still weather continuously without moving the connection metadata.
   if(k!==1&&sockets({...p,x:0,y:0,z:0,rot:0}).some(e=>Math.abs((a[0]-e.x)*e.dx+(a[2]-e.z)*e.dz)<EPS&&(k===0?Math.abs(e.dx):Math.abs(e.dz))>.5))continue;
   if(best===null||d<best.d)best={d,sign};
  }
  if(best){offsets[k]=best.sign*(r-best.d);count++;}
 }
 if(count>=2){const l=Math.hypot(...offsets);if(l>r)for(let k=0;k<3;k++)q[k]+=offsets[k]*(r/l-1);}
 return q;
}
function weatherMesh(p,pos,norm,bs){
 const clamp=v=>Math.max(0,Math.min(1,v)),factor=p.finish==='worn'?1:.55,ends=sockets({...p,x:0,z:0,y:0,rot:0}),xs=bs.flatMap(b=>b.slice(0,2)),zs=bs.flatMap(b=>b.slice(4,6)),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
 for(let i=0;i<pos.length;i+=3){let [x,z]=local(p,pos[i],pos[i+2]),y=pos[i+1]-p.y;if(y<EPS)continue;const rounded=roundOldEdges(p,[x,y,z],bs);let rx=rounded[0]-x,ry=rounded[1]-y,rz=rounded[2]-z;
  if(ends.some(e=>Math.abs((x-e.x)*e.dx+(z-e.z)*e.dz)<EPS)){const w=world(p,x+rx,z+rz);pos[i]=w[0];pos[i+1]=p.y+y+ry;pos[i+2]=w[1];continue;}
  let dx=0,dz=0,dy=0;
  if(p.kind==='wall_niche'){
   // An exposed sill wears unevenly; the hidden socket and back remain exact.
   const lip=clamp(1-Math.abs(y-.5)/.08)*clamp((-.1-z)/.15),patch=clamp(1-Math.abs(x+.21)/.25);
   dy-=.045*lip*patch;dz+=.025*lip*patch;
  }else if(p.kind==='stairs'){
   if(Math.abs(z)>=p.length/2-EPS)continue;const side=clamp((Math.abs(x)-(p.width/2-.16))/.16),n=Math.round(y/(p.height/Math.ceil(p.height/.24))),loss=(.018+.026*(.5+.5*Math.sin(n*2.17)))*side*factor;
   dx=-Math.sign(x)*loss;dy=-loss*.65;
  }else if(p.kind==='platform'){
   // Recess only exposed rim. Protected sockets/bearings and the interior stay exact.
   const protectedPoint=(p._bearing||[]).some(b=>x>=b[0]-.025&&x<=b[1]+.025&&z>=b[2]-.025&&z<=b[3]+.025);
   const top=clamp((y-(p.height-.22))/.22),X=clamp(1-Math.min(x-xmin,xmax-x)/.22),Z=clamp(1-Math.min(z-zmin,zmax-z)/.22),
    patchFront=clamp(1-Math.abs(x+p.length*.24)/(p.length*.14))*(z<0?1:.45),
    patchBack=clamp(1-Math.abs(x-p.length*.33)/(p.length*.13))*(z>0?1:.30),
    patchSide=clamp(1-Math.abs(z+p.width*.12)/(p.width*.19))*(x<0?1:.6),
    exposure=(patchFront*.11+patchBack*.14)*Z+patchSide*.105*X;
   const bearingDistance=Math.min(Infinity,...(p._bearing||[]).map(b=>Math.max(b[0]-x,x-b[1],b[2]-z,z-b[3],0))),bearingFade=clamp((bearingDistance-.025)/.18);
   if(!protectedPoint){const loss=exposure*top*bearingFade*(p.finish==='worn'?1:.86);dy-=loss;dx+=(x<0?1:-1)*loss*X*.62;dz+=(z<0?1:-1)*loss*Z*.72;}
   if(y<p.height-EPS){const cornerX=clamp(1-Math.min(x-xmin,xmax-x)/.10),cornerZ=clamp(1-Math.min(z-zmin,zmax-z)/.10),band=clamp(1-Math.abs(y-p.height*.47)/Math.max(.2,p.height*.4)),loss=.065*cornerX*cornerZ*band*factor;dx+=(x<(xmin+xmax)/2?1:-1)*loss;dz+=(z<(zmin+zmax)/2?1:-1)*loss*.73;}
  }else{
   const roofs=bs.filter(b=>x>=b[0]-EPS&&x<=b[1]+EPS&&z>=b[4]-EPS&&z<=b[5]+EPS).map(b=>b[3]),roof=roofs.length?Math.max(...roofs):p.height,top=clamp((y-(roof-.13))/.13);
   const n1=clamp(1-Math.abs(x+p.length*.21)/.24),n2=clamp(1-Math.abs(x-p.length*.23)/.19),edge=clamp(1-Math.min(z-zmin,zmax-z)/.13),socketFade=p._trim?clamp(Math.min(...ends.map(e=>Math.abs((x-e.x)*e.dx+(z-e.z)*e.dz)))/.14):1,loss=(p._trim?(.008+.024*n1+.017*n2):(.018+.18*n1+.09*n2))*top*(.35+.65*edge)*factor*socketFade;
   dz=(z<(zmin+zmax)/2?1:-1)*loss*.68;dy=-loss;
   if(p.kind==='wall_ruined'||p.kind==='wall_broken'){
    // Local broken shoulders reach the outline; protected sockets and foot stay exact.
    const topBand=clamp((y-(roof-.28))/.28),shoulder=Math.max(clamp(1-Math.abs(x+p.length*.435)/.22),p.kind==='wall_ruined'&&x>=-p.length*.435&&x<=-p.length*.4+EPS?.88:0),break2=clamp(1-Math.abs(x+p.length*.075)/.33),endChip=clamp(1-Math.abs(x-p.length*.445)/.22);
    dy-=(.20*shoulder+.115*break2+.17*endChip)*topBand*(.82+.18*(z+.25)/.5)*factor;
    dx+=((p.kind==='wall_ruined'&&x>=-p.length*.435&&x<=-p.length*.4+EPS?-.08:.105)*shoulder-.08*endChip)*topBand*factor;
    dz+=(z<0?1:-1)*(.055*shoulder+.075*endChip)*topBand*factor;
   }
   if(!['wall','edge','wall_broken','wall_ruined'].includes(p.kind)){
    const X=clamp(1-Math.min(x-xmin,xmax-x)/.10),Z=clamp(1-Math.min(z-zmin,zmax-z)/.10),band=clamp(1-Math.abs(y-p.height*.47)/Math.max(.2,p.height*.48)),corner=.055*X*Z*(.4*top+band)*factor;
    dx+=(x<(xmin+xmax)/2?1:-1)*corner;dz+=(z<(zmin+zmax)/2?1:-1)*corner*.75;dy-=top*corner*.5;
   }
  }
  const w=world(p,x+dx+rx,z+dz+rz);pos[i]=w[0];pos[i+1]=p.y+y+dy+ry;pos[i+2]=w[1];
 }
 for(let i=0;i<pos.length;i+=9){const u=[pos[i+3]-pos[i],pos[i+4]-pos[i+1],pos[i+5]-pos[i+2]],v=[pos[i+6]-pos[i],pos[i+7]-pos[i+1],pos[i+8]-pos[i+2]],n=cross3(u,v),l=Math.hypot(...n);for(let j=0;j<3;j++)for(let k=0;k<3;k++)norm[i+j*3+k]=n[k]/l;}
}

// Individual exposed stones around a recessed core. Authoring footprint/sockets remain unchanged.
function stoneWallMesh(p,bs){
 let uvBounds=null,uvPatch=null;
 const out={positions:[],normals:[],uv:[]},emit=(a,b,c)=>{const cross=cross3(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k]));if(Math.hypot(...cross)<=1e-10)return;const n=unit3(cross);if(!n.every(Number.isFinite))return;const axis=Math.abs(n[1])>.5?1:Math.abs(n[0])>Math.abs(n[2])?0:2;for(const q of[a,b,c]){const w=world(p,q[0],q[2]),nd=world({...p,x:0,z:0},n[0],n[2]);out.positions.push(w[0],p.y+q[1],w[1]);out.normals.push(nd[0],n[1],nd[1]);let u=axis===0?q[2]:q[0],v=axis===1?q[2]:q[1];if(uvBounds&&axis!==2){const [a,A,h,H]=uvBounds;if(axis===0){u=.12+(q[2]+.25)*.52;v=.09+(q[1]-h)*.52;}else{u=.11+(q[0]-a)*.52;v=.09+(q[2]+.25)*.52;}}if(uvBounds&&uvPatch){const [a,A,h,H]=uvBounds,[u0,v0,w,hg,mirror]=uvPatch;
 if(axis===2){let t=(q[0]-a)/(A-a);if(mirror)t=1-t;u=u0+.022+t*(w-.044);v=v0+.023+(q[1]-h)/(H-h)*(hg-.046);}
 else {u=u0+.07+(u-.11);v=v0+.065+(v-.09);}}
 out.uv.push(u,v);}};
 const facesOf=b=>{const [x,X,y,Y,z,Z]=b;return[[[x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z]],[[X,y,Z],[X,y,z],[X,Y,z],[X,Y,Z]],[[x,y,Z],[x,y,z],[X,y,z],[X,y,Z]],[[x,Y,z],[x,Y,Z],[X,Y,Z],[X,Y,z]],[[X,y,z],[x,y,z],[x,Y,z],[X,Y,z]],[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]]].map(v=>({v,fresh:false}));};
 const draw=faces=>{for(const f of faces)for(let i=1;i<f.v.length-1;i++)emit(f.v[0],f.v[i],f.v[i+1]);};
 const atlasCuts=[[0,.84,1.98,2.90,4],[0,1.13,1.90,2.92,4],[0,.91,1.72,2.85,4],[0,1.04,2.13,3.04,4],[0,.77,1.81,2.89,4],[0,1.16,2.07,3.11,4],[0,.90,1.97,2.75,4],[0,.82,1.86,3.02,4]],atlasOffsets=[0,.46,.13,.61,.25,.74,.08,.52],courses=[0,.5,1.01,1.5,1.99,2.5,3.01,3.5,4];
  // One reusable alternate bond, not an unbounded mesh variant for every placement.
  const cuts=p._stonePattern?[[0,.62,1.76,2.64,4],[0,1.24,2.28,3.16,4],[0,.76,1.38,2.82,4],[0,1.36,2.04,2.72,4],[0,.68,1.90,3.24,4],[0,1.31,2.53,3.20,4],[0,.58,1.75,2.45,4],[0,1.28,1.98,3.25,4]]:atlasCuts;
  const offsets=p._stonePattern?[.23,.82,.41,.05,.66,.18,.91,.37]:atlasOffsets;
 for(const b of bs){
  const [lo,hi,low,high]=b;draw(facesOf([lo,hi,low,Math.max(low+.01,high-.08),-.20,.20]));
  for(let cycle=Math.floor(low/4);cycle<=Math.floor(high/4);cycle++)for(let r=0;r<8;r++){
   const y=Math.max(low,cycle*4+courses[r]),Y=Math.min(high,cycle*4+courses[r+1]);if(Y-y<.025)continue;
   for(let tile=Math.floor((lo+offsets[r])/4)-1;tile<=Math.ceil((hi+offsets[r])/4);tile++)for(let c=0;c<4;c++){
    const x=Math.max(lo,tile*4-offsets[r]+cuts[r][c]),X=Math.min(hi,tile*4-offsets[r]+cuts[r][c+1]);if(X-x<.03)continue;
    const seed=.5+.5*Math.sin((r+13)*17.31+(tile+5)*7.71+c*2.37),top=Y>=high-EPS,drop=top&&!p._facade?.018+seed*.045:0,
     a=x+(x>lo+EPS?.006:.027),A=X-(X<hi-EPS?.006:.027),h=y+(y>low+EPS?.006:0),H=Y-drop-(p._facade&&top?0:.006);
    if(H<=h+.01||A<=a+.01)continue;
    const pick=((Math.imul(r+cycle*8+19,73856093)^Math.imul(c+tile*4+23,19349663)^Math.round(p.length*193+p.height*71)^(p._stonePattern?0x45d9f3b:0))>>>0),pr=pick%8,pc=(pick>>>8)%4;
    uvPatch=[atlasCuts[pr][pc]-atlasOffsets[pr],courses[pr],atlasCuts[pr][pc+1]-atlasCuts[pr][pc],courses[pr+1]-courses[pr],!!(pick&65536)];
    uvBounds=[a,A,h,H];const endStone=Math.abs(a+p.length/2)<.03||Math.abs(A-p.length/2)<.03,depth=endStone?.25:.25-.024*seed;let faces=facesOf([a,A,h,H,-depth,depth]);
    // Different old-edge bevel widths per block; convex corners survive only at hidden joints.
    const widths=[A-a,H-h,depth*2],center=[(a+A)/2,(h+H)/2,0],half=widths.map(v=>v/2),rad=Math.min(.035+seed*.055,(A-a)*.14,(H-h)*.14);
    for(const [i,j] of [[0,2],[1,2]])for(const si of[-1,1])for(const sj of[-1,1]){
     if(i===0&&((si<0&&Math.abs(a+p.length/2)<.03)||(si>0&&Math.abs(A-p.length/2)<.03)))continue;
     for(const theta of[Math.PI/8,3*Math.PI/8]){const n=[0,0,0];n[i]=si*Math.cos(theta);n[j]=sj*Math.sin(theta);const d=dot3(n,center)+Math.cos(theta)*half[i]+Math.sin(theta)*half[j]-rad*(Math.cos(theta)+Math.sin(theta)-1);faces=clipStone(faces,[...n,d],false);}
    }
    // One unequal corner impact, while the other worked planes remain broad.
    if(seed>.43){const n=[seed>.7?-.58:.62,.68,.51],d=dot3(n,center)+Math.abs(n[0])*half[0]+n[1]*half[1]+n[2]*half[2]-Math.min(.065,(H-h)*.18);faces=clipStone(faces,[...n,d],true);}
    if(top&&!p._facade&&seed>.55){const n=[seed>.78?-.72:.65,1,.3],d=dot3(n,center)+Math.abs(n[0])*half[0]+half[1]+.3*half[2]-Math.min(.15,(H-h)*.34);faces=clipStone(faces,[...n,d],true);}
    if(top&&!p._facade&&!endStone&&['wall_broken','wall_ruined'].includes(p.kind)){
     const tilt=(seed-.5)*.28,cut=Math.min(.045+(1-seed)*.045,(H-h)*.16);
     faces=clipStone(faces,[tilt,1,-.12,H-cut+tilt*center[0]],true);
    }
    draw(faces);uvBounds=null;uvPatch=null;
   }
  }
 }
 // Retain only the original connection collars; exposed masonry is generated above.
 const old=unmergedMesh({...p,_stoneCore:true},bs),ends=sockets({...p,x:0,y:0,z:0,rot:0});
 for(let i=0;i<old.positions.length;i+=9){const pts=[0,3,6].map(k=>{const q=old.positions.slice(i+k,i+k+3),l=local(p,q[0],q[2]);return[l[0],q[1]-p.y,l[1]];});
  for(const e of ends){const clipped=clipStone([{v:pts,fresh:false}],[-e.dx,0,-e.dz,-e.x*e.dx-e.z*e.dz+.026],false);for(const f of clipped)for(let j=1;j<f.v.length-1;j++)emit(f.v[0],f.v[j],f.v[j+1]);}
 }

 return out;
}

// Replace only the flat central vertical facade. Top bearing, rounded rim,
// corner envelope and foundation remain the original surface.
function platformMasonry(p,source){
 const out={positions:[],normals:[],uv:[]};
 const emit=(a,b,c,uvs)=>{const nn=cross3(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k]));if(Math.hypot(...nn)<=1e-10)return;const n=unit3(nn);for(let j=0;j<3;j++){const q=[a,b,c][j],w=world(p,q[0],q[2]),N=world({...p,x:0,z:0},n[0],n[2]);out.positions.push(w[0],p.y+q[1],w[1]);out.normals.push(N[0],n[1],N[1]);out.uv.push(...uvs[j]);}};
 const variant=surfaceVariant(p),du=[0,.5,1,1.5][variant],dv=[0,.5,1.5,1][variant];
 for(let i=0;i<source.positions.length;i+=9){const points=[0,3,6].map(k=>{const w=source.positions.slice(i+k,i+k+3),q=local(p,w[0],w[2]);return[q[0],w[1]-p.y,q[1]];}),n=cross3(points[1].map((v,k)=>v-points[0][k]),points[2].map((v,k)=>v-points[0][k]));
  const axis=Math.abs(n[0])>Math.abs(n[2])?0:2,span=axis===0?p.width:p.length,boundary=(axis===0?p.length:p.width)/2,side=1-axis/2;
  if(Math.abs(n[1])<1e-10&&Math.abs(n[axis])>1e-10&&points.every(q=>Math.abs(Math.abs(q[axis])-boundary)<1e-7)){
   let remaining=[{v:points,fresh:false}];const along=axis===0?2:0;
   for(const [ax,sign,d]of[[along,-1,span/2-.10],[along,1,span/2-.10],[1,-1,-.04],[1,1,p.height-.22]]){const plane=[0,0,0,d];plane[ax]=sign;const outside=clipStone(remaining,plane.map(v=>-v),false);for(const f of outside)for(let k=1;k<f.v.length-1;k++){const tri=[f.v[0],f.v[k],f.v[k+1]];emit(...tri,tri.map(q=>[q[along]+du,q[1]+dv]));}remaining=clipStone(remaining,plane,false);if(!remaining.length)break;}
  }else emit(...points,[0,1,2].map(k=>source.uv.slice(i/3*2+k*2,i/3*2+k*2+2)));
 }
 if(p.height<=.30)return source;
 for(const axis of[0,2])for(const sign of[-1,1]){
  const span=(axis===0?p.width:p.length)-.20,boundary=(axis===0?p.length:p.width)/2;
  const slab=stoneWallMesh({_facade:true,kind:'wall',id:p.id,finish:p.finish,length:span,height:p.height-.26,width:.5,x:0,y:0,z:0,rot:0},[[-span/2,span/2,0,p.height-.26,-.25,.25]]);
  // Continuous recessed backing plus closed returns: no open slit under the rim.
  const map=(u,y,depth)=>axis===2?[u,y,sign*(boundary-depth)]:[sign*(boundary-depth),y,u];
  const backing=[map(-span/2,.04,.075),map(span/2,.04,.075),map(span/2,p.height-.22,.075),map(-span/2,p.height-.22,.075)],rim=[map(-span/2,.04,0),map(span/2,.04,0),map(span/2,p.height-.22,0),map(-span/2,p.height-.22,0)];
  const face=q=>{if((axis===2&&sign<0)||(axis===0&&sign>0))q=q.slice().reverse();for(let k=1;k<q.length-1;k++){const tri=[q[0],q[k],q[k+1]];emit(...tri,tri.map(v=>[v[axis===0?2:0],v[1]]));}};
  face(backing);for(let k=0;k<4;k++){const n=(k+1)%4;face([rim[k],rim[n],backing[n],backing[k]]);}
  for(let i=0;i<slab.positions.length;i+=9){if(slab.normals[i+2]<=.01)continue;const points=[0,3,6].map(k=>{const q=slab.positions.slice(i+k,i+k+3);return axis===2?[q[0],q[1]+.04,sign*(boundary+q[2]-.25)]:[sign*(boundary+q[2]-.25),q[1]+.04,q[0]];}),uvs=[0,1,2].map(k=>slab.uv.slice(i/3*2+k*2,i/3*2+k*2+2));if((axis===2&&sign<0)||(axis===0&&sign>0)){[points[1],points[2]]=[points[2],points[1]];[uvs[1],uvs[2]]=[uvs[2],uvs[1]];}emit(...points,uvs);}
 }
 return out;
}


// One worked lintel, with intact lower bearing faces and unequal exposed wear.
const beamCache=new Map();
function beamMesh(p){const key=p.length+':'+!!p.joined;let raw=beamCache.get(key);if(!raw){const L=p.length/2+(p.joined?0:.28),H=.5,b=[-L,L,0,H,-.25,.25],center=[0,H/2,0],half=[L,H/2,.25];let faces=archBox(b);
 for(const [a,b]of [[0,2],[0,1],[1,2]])for(const sa of[-1,1])for(const sb of[-1,1]){const bottom=(a===1&&sa<0)||(b===1&&sb<0);const radius=bottom?.014+.01*(.5+.5*Math.sin(a+b+sa*2+sb)):.038+.025*(.5+.5*Math.sin(a*2.7+b+sa*1.4+sb));for(const theta of[Math.PI/8,3*Math.PI/8]){const n=[0,0,0];n[a]=sa*Math.cos(theta);n[b]=sb*Math.sin(theta);faces=clipPier(faces,[...n,dot3(n,center)+Math.cos(theta)*half[a]+Math.sin(theta)*half[b]-radius*(Math.cos(theta)+Math.sin(theta)-1)],false);}}
 for(const [sign,loss]of[[-1,.09],[1,.065]]){const n=[sign,.65,sign*.5];faces=clipPier(faces,[...n,L+.65*H+.5*.25-loss],true);}
    // Unequal, localized end impacts; the underside bearing area stays untouched.
   const facePlane=f=>{const n=unit3(cross3(f.v[1].map((v,k)=>v-f.v[0][k]),f.v[2].map((v,k)=>v-f.v[0][k])));return [...n,dot3(n,f.v[0])];};
   const trim=(poly,pl)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=dot3(a,pl)-pl[3],db=dot3(b,pl)-pl[3];if(da<=1e-9)out.push(a);if((da<-1e-9&&db>1e-9)||(da>1e-9&&db<-1e-9)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}return out.filter((v,i,a)=>!i||Math.hypot(...v.map((q,k)=>q-a[i-1][k]))>1e-9);};
   const originalPlanes=faces.map(facePlane);
   for(const spec of [{x:L-.23,w:.19,y:.425,z:-.21,d:.15,tilt:.46},{x:L-.075,w:.075,y:.355,z:.20,d:.16,tilt:-.31}]){
    let cutter=archBox([spec.x-spec.w/2,spec.x+spec.w/2,spec.y,.57,spec.z-spec.d/2,spec.z+spec.d/2]);
    cutter=clipPier(cutter,[.21,-1,spec.tilt,.21*spec.x-spec.y+spec.tilt*spec.z+.025],true);
    cutter=clipPier(cutter,[1,.35,.27,spec.x+spec.w/2+.35*.49+.27*spec.z-.016],true);
    cutter=cutter.map(f=>({...f,v:f.v.map(v=>{const dx=v[0]-spec.x,dy=v[1]-spec.y,dz=v[2]-spec.z;return[v[0]+dy*.58+dz*.22,v[1]+dx*.34+dz*.19,v[2]+dy*.16];})}));
    const planes=cutter.map(facePlane),keep=[];
    for(const f of faces){let inside=f.v;for(const pl of planes){const outside=trim(inside,pl.map(v=>-v));if(outside.length>=3)keep.push({v:outside,fresh:f.fresh});inside=trim(inside,pl);if(inside.length<3)break;}}
    for(const f of cutter){let poly=f.v;for(const pl of originalPlanes){poly=trim(poly,pl);if(poly.length<3)break;}if(poly.length>=3)keep.push({v:poly.reverse(),fresh:true});}
    faces=keep;
   }
faces=faces.flatMap(f=>{if(!f.fresh)return[f];const n=unit3(cross3(f.v[1].map((v,k)=>v-f.v[0][k]),f.v[2].map((v,k)=>v-f.v[0][k]))),c=[0,1,2].map(k=>f.v.reduce((a,v)=>a+v[k],0)/f.v.length*.65+f.v[0][k]*.35-n[k]*.012);return f.v.map((v,i)=>({v:[v,f.v[(i+1)%f.v.length],c],fresh:true}));});
   raw={positions:[],normals:[],uv:[]};for(const f of faces)for(let i=1;i<f.v.length-1;i++){const tri=[f.v[0],f.v[i],f.v[i+1]],cross=cross3(tri[1].map((v,k)=>v-tri[0][k]),tri[2].map((v,k)=>v-tri[0][k]));if(Math.hypot(...cross)<1e-10)continue;const n=unit3(cross);for(const v of tri){raw.positions.push(...v);raw.normals.push(...n);raw.uv.push(Math.abs(n[0])>.9?v[2]:v[0],Math.abs(n[1])>.9?v[2]:v[1]);}}
 beamCache.set(key,raw);}
 const out={positions:[],normals:[],uv:raw.uv.slice()};for(let i=0;i<raw.positions.length;i+=3){const w=world(p,raw.positions[i],raw.positions[i+2]),n=world({...p,x:0,z:0},raw.normals[i],raw.normals[i+2]);out.positions.push(w[0],p.y+raw.positions[i+1],w[1]);out.normals.push(n[0],raw.normals[i+1],n[1]);}return out;
}

function unmergedMesh(p,override){if(p.kind==='buttress_wall')return piecesMesh(p,buttressGeometry(p));if(p.kind==='offering_table')return piecesMesh(p,offeringGeometry(p));if(p.kind==='soil_bank')return piecesMesh(p,soilGeometry(p));if(p.kind==='wall_ruined'&&p.fracture)return piecesMesh(p,collapseGeometry(p));
 if(p.kind==='balustrade'&&!p._trim)return unmergedMesh({...p,_trim:true},override);
 if(p.kind==='stone_beam')return beamMesh(p);
 if(TRIM_PARTS.includes(p.kind))return unmergedMesh({...p,kind:p.kind==='edge_corner'?'corner_in':'end',_trim:true},override);
 if(p.kind==='paving'||p.kind==='paving_broken')return pavingMesh(p);
 if(p.kind==='arch'||p.kind==='arch_broken')return archMesh(p);
 if(COLUMN_PARTS.includes(p.kind))return columnMesh(p);
 if(p.kind==='pier'||p.kind==='pier_broken')return pierMesh(p);
 if(p.kind==='stairs')return stairMesh(p);
 if(!override&&p.kind==='wall_ruined'){
  const bs=boxes(p),chunks=[mesh(p,bs.filter(b=>b.length===6))];
  for(const g of fragmentGeometry(p)){const positions=[],normals=[];for(let i=0;i<g.positions.length;i+=3){const w=world(p,g.positions[i],g.positions[i+2]),n=world({...p,x:0,z:0},g.normals[i],g.normals[i+2]);positions.push(w[0],p.y+g.positions[i+1],w[1]);normals.push(n[0],g.normals[i+1],n[1]);}chunks.push({positions,normals,uv:g.uv});}
  return{positions:chunks.flatMap(g=>g.positions),normals:chunks.flatMap(g=>g.normals),uv:chunks.flatMap(g=>g.uv)};
 }
 if(!p._stoneCore&&['wall','wall_broken','wall_ruined'].includes(p.kind))return stoneWallMesh(p,override||boxes(p).filter(b=>b.length===6));
 const variant=surfaceVariant(p),du=[0,.5,1,1.5][variant],dv=[0,.5,1.5,1][variant],bs=override||boxes(p),axes=[0,2,4].map(k=>[...new Set(bs.flatMap(b=>[b[k],b[k+1]]))].sort((a,b)=>a-b)),pos=[],norm=[],uv=[];
 const masonry=!p._trim&&['wall','wall_broken','wall_ruined','opening','opening_broken','end'].includes(p.kind);
 wearAxes(p,axes,bs);
 for(let k=0;k<3;k++){const lo=Math.min(...bs.map(b=>b[k*2])),hi=Math.max(...bs.map(b=>b[k*2+1]));const bounds=k===1?[p.height]:k===0&&['wall','wall_broken','wall_ruined','opening','opening_broken','edge'].includes(p.kind)?[]:[lo,hi];for(const edge of bounds)for(const d of [.023,.076]){const v=k===1||edge===hi?edge-d:edge+d;if(v>lo+EPS&&v<hi-EPS)axes[k].push(v);}
  if(p.kind==='platform'&&k!==1)for(const b of p._bearing||[])for(const v of k===0?b.slice(0,2):b.slice(2,4))for(const d of [-.026,0,.026])if(v+d>lo&&v+d<hi)axes[k].push(v+d);
  axes[k]=[...new Set(axes[k])].sort((a,b)=>a-b);
 }
 const inside=(x,y,z)=>bs.some(b=>x>b[0]-EPS&&x<b[1]+EPS&&y>b[2]-EPS&&y<b[3]+EPS&&z>b[4]-EPS&&z<b[5]+EPS);
 function face(v,n){for(const i of [0,1,2,0,2,3]){const a=v[i],w=world(p,a[0],a[2]),nd=world({...p,x:0,z:0},n[0],n[2]);pos.push(w[0],p.y+a[1],w[1]);norm.push(nd[0],n[1],nd[1]);let u=n[1]?a[0]:n[0]?a[2]:a[0],vcoord=n[1]?a[2]:a[1];
 if(p._fragment||(p.kind==='wall_ruined'&&n[1]>0&&a[1]<p.height-EPS)){const xs=v.map(t=>n[1]?t[0]:n[0]?t[2]:t[0]),ys=v.map(t=>n[1]?t[2]:t[1]);u=.10+.48*(u-Math.min(...xs))/(Math.max(...xs)-Math.min(...xs));vcoord=.09+.30*(vcoord-Math.min(...ys))/(Math.max(...ys)-Math.min(...ys));uv.push(u,vcoord);}
 else if(p.kind==='stairs'&&n[1]>0){const zs=v.map(t=>t[2]);uv.push(u+du,.012+.4*(a[2]-Math.min(...zs))/(Math.max(...zs)-Math.min(...zs))+dv);}
 else uv.push(u+du,vcoord+dv);}}
 for(let i=0;i<axes[0].length-1;i++)for(let j=0;j<axes[1].length-1;j++)for(let k=0;k<axes[2].length-1;k++){const [x,X]=axes[0].slice(i,i+2),[y,Y]=axes[1].slice(j,j+2),[z,Z]=axes[2].slice(k,k+2),cx=(x+X)/2,cy=(y+Y)/2,cz=(z+Z)/2;if(!inside(cx,cy,cz))continue;
  if(!inside(x-1e-4,cy,cz))face([[x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z]],[-1,0,0]);
  if(!inside(X+1e-4,cy,cz))face([[X,y,Z],[X,y,z],[X,Y,z],[X,Y,Z]],[1,0,0]);
  if(!inside(cx,y-1e-4,cz))face([[x,y,Z],[x,y,z],[X,y,z],[X,y,Z]],[0,-1,0]);
  if(!inside(cx,Y+1e-4,cz))face([[x,Y,z],[x,Y,Z],[X,Y,Z],[X,Y,z]],[0,1,0]);
  if(!(masonry&&Math.abs(z+.25)<EPS&&Y<=Math.max(...bs.filter(b=>cx>b[0]-EPS&&cx<b[1]+EPS).map(b=>b[3]))-.13+EPS)&&!inside(cx,cy,z-1e-4))face([[X,y,z],[x,y,z],[x,Y,z],[X,Y,z]],[0,0,-1]);
  if(!(masonry&&Math.abs(Z-.25)<EPS&&Y<=Math.max(...bs.filter(b=>cx>b[0]-EPS&&cx<b[1]+EPS).map(b=>b[3]))-.13+EPS)&&!inside(cx,cy,Z+1e-4))face([[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]],[0,0,1]);
 }
 if(masonry)masonryFaces(p,bs,(a,b,c)=>{const n=unit3(cross3(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k]))),nd=world({...p,x:0,z:0},n[0],n[2]);for(const q of[a,b,c]){const w=world(p,q[0],q[2]);pos.push(w[0],p.y+q[1],w[1]);norm.push(nd[0],n[1],nd[1]);const axis=2;uv.push((axis===0?q[2]:q[0])+du,(axis===1?q[2]:q[1])+dv);}},du,dv);

 weatherMesh(p,pos,norm,bs);
 // Circular edge projection can coalesce diagonal vertices of a corner cell.
 // Remove only zero-area triangles, preserving all visible surface triangles.
 const clean={positions:[],normals:[],uv:[]};for(let i=0;i<pos.length;i+=9){const a=pos.slice(i,i+3),b=pos.slice(i+3,i+6),c=pos.slice(i+6,i+9),n=cross3(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k]));if(Math.hypot(...n)<=1e-10)continue;clean.positions.push(...pos.slice(i,i+9));clean.normals.push(...norm.slice(i,i+9));clean.uv.push(...uv.slice(i/3*2,i/3*2+6));}
 return p.kind==='platform'?platformMasonry(p,clean):clean;}
function patch(m,size,resolution,height){const n=resolution-1,cell=size/n,half=size/2,holes=new Uint8Array(n*n),tris=[];const rects=m.items.filter(p=>p.kind==='platform').map(footprint);
 function subtract(a,b){const x=Math.max(a[0],b[0]),X=Math.min(a[1],b[1]),z=Math.max(a[2],b[4]),Z=Math.min(a[3],b[5]);if(x>=X-EPS||z>=Z-EPS)return[a];return[[a[0],x,a[2],a[3]],[X,a[1],a[2],a[3]],[x,X,a[2],z],[x,X,Z,a[3]]].filter(v=>v[1]-v[0]>EPS&&v[3]-v[2]>EPS);}
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=i*cell-half,z=j*cell-half,a=[x,x+cell,z,z+cell];let pieces=[a],hit=false;for(const b of rects){if(a[0]>=b[1]-EPS||a[1]<=b[0]+EPS||a[2]>=b[5]-EPS||a[3]<=b[4]+EPS)continue;hit=true;pieces=pieces.flatMap(v=>subtract(v,b));}if(!hit)continue;holes[j*n+i]=1;for(const [x,X,z,Z]of pieces)tris.push(x,z,x,Z,X,Z,x,z,X,Z,X,z);}
 return{holes,tris};}
const unityTriangles=n=>Array.from({length:n},(_,i)=>i%3===1?i+1:i%3===2?i-1:i);
function exportData(m,size,resolution,height,originY=0){validate(m);const p=patch(m,size,resolution,height),half=size/2,convert=a=>a.map((v,i)=>i%3===0?v+half:i%3===1?v-originY:half-v);
 const items=m.items.map(raw=>{const item=resolved(raw,m),g=mesh({...item,x:0,z:0,y:0,rot:0}),normals=g.normals.map((v,i)=>i%3===2?-v:v);return{id:item.id,kind:item.kind,finish:item.finish,position:[item.x+half,item.y-originY,half-item.z],yawDeg:-item.rot*180/Math.PI,positions:g.positions.map((v,i)=>i%3===2?-v:v),normals,uv:g.uv,triangles:unityTriangles(g.positions.length/3)};});
 const cap=[];for(let i=0;i<p.tris.length;i+=2)cap.push(p.tris[i],height(p.tris[i],p.tris[i+1]),p.tris[i+1]);return{format:'tdj-ruins-structures',version:VERSION,requiredFeature:FEATURE,terrainResolution:resolution,size,items,cap:{positions:convert(cap),uv:cap.flatMap((v,i)=>i%3===0?[(v+half)/size]:i%3===2?[(half-v)/size]:[]),triangles:unityTriangles(cap.length/3)},holes:Array.from(p.holes),authoring:clone(m)};}
// Unity mesh arrays are Float32. Shorten JSON tokens only when they round back
// to the exact same float; authoring, indices, transforms and metadata stay untouched.
function stringifyExport(data){
 const stack=[],cache=new Map();
 return JSON.stringify(data,function(key,value){
  while(stack.length&&stack[stack.length-1].value!==this)stack.pop();
  const parent=stack[stack.length-1];
  if(value&&typeof value==='object'){
   let role='other';
   if(!parent&&key==='')role='root';
   else if(parent?.role==='root'&&key==='items'&&Array.isArray(value))role='items';
   else if(parent?.role==='items'&&!Array.isArray(value))role='item';
   else if(parent?.role==='root'&&key==='cap')role='cap';
   else if((parent?.role==='item'||parent?.role==='cap')&&['positions','normals','uv'].includes(key)&&Array.isArray(value))role='meshFloat';
   stack.push({value,role});return value;
  }
  if(typeof value!=='number')return value;
  if(!Number.isFinite(value))throw Error('遺跡出力に非有限の数値があります');
  if(parent?.role!=='meshFloat')return value;
  const f=Math.fround(value);if(!Number.isFinite(f))throw Error('遺跡メッシュの数値がFloat32の範囲を超えています');
  // Preserve signed underflow tokens; JSON already normalizes literal -0 to 0.
  if(f===0)return value;if(cache.has(f))return cache.get(f);
  let q=f;for(let n=1;n<=9;n++){const candidate=Number(f.toPrecision(n));if(Math.fround(candidate)===f){q=candidate;break;}}
  cache.set(f,q);return q;
 });
}
// Coalesce only convex, coplanar regions with the same affine UV mapping.
// No vertex motion, normal averaging, silhouette reduction or fracture smoothing.
function coalescePlanar(g){
 const groups=new Map(),round=x=>Math.round(x*1e7),vertices=[],vertexMap=new Map();
 for(let i=0;i<g.positions.length;i+=9){
  const a=g.positions.slice(i,i+3),b=g.positions.slice(i+3,i+6),c=g.positions.slice(i+6,i+9),n=g.normals.slice(i,i+3),drop=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),axes=[0,1,2].filter(k=>k!==drop),u=axes[0],v=axes[1];
  const den=(b[u]-a[u])*(c[v]-a[v])-(b[v]-a[v])*(c[u]-a[u]);if(Math.abs(den)<1e-12)continue;
  const mapping=[];for(let k=0;k<2;k++){const A=g.uv[i/3*2+k],B=g.uv[i/3*2+2+k],C=g.uv[i/3*2+4+k],s=((B-A)*(c[v]-a[v])-(C-A)*(b[v]-a[v]))/den,t=((C-A)*(b[u]-a[u])-(B-A)*(c[u]-a[u]))/den;mapping.push(s,t,A-s*a[u]-t*a[v]);}
  let key=[...n,dot3(n,a),...mapping].map(round).join(':'),group=groups.get(key);const plane=dot3(n,a);
  if(group&&([...n.map((v,k)=>v-group.n[k]),plane-group.plane,...mapping.map((v,k)=>v-group.mapping[k])].some(v=>Math.abs(v)>1e-9))){key+=':'+i;group=null;}
  if(!group){group={n,plane,mapping,axes,polys:[]};groups.set(key,group);}
  // Numerical grouping is never enough: every vertex must satisfy the group's
  // original plane, normal and UV transform before becoming mergeable.
  const ids=[];for(let j=0;j<3;j++){const p=g.positions.slice(i+j*3,i+j*3+3),uv=g.uv.slice(i/3*2+j*2,i/3*2+j*2+2),N=g.normals.slice(i+j*3,i+j*3+3),vk=[...p,...N,...uv].map(x=>Math.round(x*1e9)).join(':');let id=vertexMap.get(vk);if(id===undefined){id=vertices.length;vertices.push({p,n:N,uv});vertexMap.set(vk,id);}ids.push(id);}
  group.polys.push(ids);
 }
 const out={positions:[],normals:[],uv:[]};
 for(const group of groups.values()){
  const polys=group.polys;let changed=true;
  const simplify=poly=>{let again=true;while(again&&poly.length>3){again=false;for(let j=0;j<poly.length;j++){const a=vertices[poly[(j+poly.length-1)%poly.length]].p,b=vertices[poly[j]].p,c=vertices[poly[(j+1)%poly.length]].p,u=b.map((x,k)=>x-a[k]),v=c.map((x,k)=>x-b[k]);if(Math.hypot(...cross3(u,v))<1e-10&&dot3(u,v)>=0){poly.splice(j,1);again=true;break;}}}return poly;};
  const convex=poly=>poly.every((id,j)=>{const a=vertices[id].p,b=vertices[poly[(j+1)%poly.length]].p,c=vertices[poly[(j+2)%poly.length]].p;return dot3(cross3(b.map((x,k)=>x-a[k]),c.map((x,k)=>x-b[k])),group.n)>=-1e-10;});
  while(changed){changed=false;const edges=new Map();
   for(let pi=0;pi<polys.length;pi++){let p=polys[pi];if(!p)continue;
    for(let j=0;j<p.length;j++){const a=p[j],b=p[(j+1)%p.length],reverse=edges.get(b+':'+a);
     if(reverse&&reverse.pi!==pi&&polys[reverse.pi]&&polys[reverse.pi][reverse.j]===b&&polys[reverse.pi][(reverse.j+1)%polys[reverse.pi].length]===a){const q=polys[reverse.pi];let merged=Array.from({length:p.length},(_,k)=>p[(j+1+k)%p.length]).concat(Array.from({length:q.length-2},(_,k)=>q[(reverse.j+2+k)%q.length]));merged=simplify(merged);
      if(new Set(merged).size===merged.length&&convex(merged)){polys[pi]=merged;polys[reverse.pi]=null;changed=true;break;}
     }
     edges.set(a+':'+b,{pi,j});
    }
   }
  }
  for(const p of polys)if(p)for(let j=1;j<p.length-1;j++)for(const id of [p[0],p[j],p[j+1]]){const v=vertices[id];out.positions.push(...v.p);out.normals.push(...v.n);out.uv.push(...v.uv);}
 }
 return out;
}

const ORNAMENT_KINDS=['buttress_wall','offering_table','window_wall','balustrade','wall_niche','opening','opening_broken','stone_beam','wall','wall_broken','wall_ruined','pier','pier_broken','arch','arch_broken','paving','paving_broken','corner_in','corner_out','tee','end','stairs','column_base','column_shaft','column_capital','platform','edge','edge_corner','edge_end'];
// Reserved UV domain encodes shallow engraved panels without extra renderer,
// material maps, collider geometry, or deformation of precision sockets.
function ornamentUV(p,g){if(p.kind==='buttress_wall')return g;
 if(p.kind==='offering_table'){if(p.finish!=='carved')return g;for(let i=0;i<g.positions.length;i+=9){const ny=g.normals[i+1];if(ny>.99&&ny<.999&&Math.min(g.positions[i+1],g.positions[i+4],g.positions[i+7])-p.y>1.15){for(let j=0;j<3;j++){const k=i+j*3,q=local(p,g.positions[k],g.positions[k+2]),u=-128+q[0]+1,v=3*64+16+(q[1]+.75)*2/1.5,fold=t=>Math.abs((t-Math.floor(t))*2-1);g.uv[k/3*2]=.63+fold(u*.37)*.75;g.uv[k/3*2+1]=2.06+fold(v*.61)*.34;}continue;}if(ny<.999||g.positions[i+1]-p.y<1.19)continue;for(let j=0;j<3;j++){const k=i+j*3,q=local(p,g.positions[k],g.positions[k+2]);g.uv[k/3*2]=-128+q[0]+1;g.uv[k/3*2+1]=3*64+16+(q[1]+.75)*2/1.5;}}return g;}

 if(p.finish!=='carved')return g;
 const family=p.kind==='balustrade'?12:p.kind==='window_wall'||p.kind==='wall_niche'||p.kind.startsWith('opening')?17:p.kind==='stone_beam'?12:TRIM_PARTS.includes(p.kind)?(p.kind==='edge_corner'?15:16):p.kind==='platform'?12:p.kind==='edge'?13:COLUMN_PARTS.includes(p.kind)?(p.kind==='column_base'?8:p.kind==='column_capital'?9:10):p.kind.startsWith('wall')?0:p.kind.startsWith('pier')?1:p.kind.startsWith('arch')?2:p.kind.startsWith('paving')?3:p.kind==='stairs'?5:4;
 for(let i=0;i<g.positions.length;i+=9){
  const n=local({...p,x:0,z:0},g.normals[i],g.normals[i+2]),ny=g.normals[i+1];
  const type=p.kind==='stone_beam'&&ny>.999?14:family>=15&&family<=16&&ny<.999?13:family===13&&ny>.999?14:family===5?(ny>.85?7:Math.abs(n[0])>.999?6:5):(family===8||family===9)&&ny>.999?11:family;
  const face=p.kind==='balustrade'?(ny>.999||Math.abs(n[1])>.999):type===17?(Math.abs(n[1])>.01&&Math.abs(ny)<.95):type>=15?ny>.999:type===14?ny>.999:family===12||family===13?Math.max(Math.abs(n[0]),Math.abs(n[1]))>.999:type===11?ny>.999:family===5?(ny>.85||Math.abs(n[0])>.999||n[1]<-.999):type===3?ny>.999:(type===1||type===4||type>=8)?Math.max(Math.abs(n[0]),Math.abs(n[1]))>.999:Math.abs(n[1])>.999;
  const rise=p.height/Math.ceil(p.height/.24),faceTop=Math.max(g.positions[i+1],g.positions[i+4],g.positions[i+7])-p.y;
  if(!face||p.kind==='wall_niche'&&n[1]>=-.01||p.kind==='balustrade'&&Math.min(g.positions[i+1],g.positions[i+4],g.positions[i+7])-p.y<.88-EPS)continue;
  if(family===12&&Math.min(g.positions[i+1],g.positions[i+4],g.positions[i+7])-p.y<Math.max(0,p.height-.82)-EPS)continue;
  for(let j=0;j<3;j++){const k=i+j*3,q=local(p,g.positions[k],g.positions[k+2]),y=g.positions[k+1]-p.y;let u,v;
   if(type===0){u=q[0]+1+2*Math.ceil(p.length/4);v=y*2.2/p.height;}
   if(type===1){u=(Math.abs(n[0])>.9?q[1]:q[0])+.5;v=y*3/p.height;}
   if(type===2){u=q[0]+2;v=y-(p.height-3.5);}
   if(type===3){u=q[0]+1;v=q[1]+1;}
   if(type===4){u=(Math.abs(n[0])>.9?q[1]:q[0])+.5;v=y*2.2/p.height;}
   if(type===5){u=(q[0]+p.width/2)*2/p.width;v=y/rise-Math.round(faceTop/rise)+1;}
   if(type===6){u=q[1]+p.length/2;v=y*p.length/p.height;}
   if(type===7){u=(q[0]+p.width/2)*2/p.width;v=q[1]+p.length/2;}
   if(type>=8){u=(Math.abs(n[0])>.9?q[1]:q[0])+.5;v=y/(type===10?p.height/2.28:p.height);}
   if(type===11){u=q[0]+.5;v=q[1]+.5;}
   if(type===12){u=(Math.abs(n[0])>.9?q[1]+p.width/2:q[0]+p.length/2);v=p.height-y;}
   if(type===13){u=(Math.abs(n[0])>.9?q[1]+.25:q[0]+p.length/2);v=y*.3/p.height;}
   if(type===14){u=q[0]+p.length/2;v=q[1]+.25;}
   if(type>=12){u=g.uv[k/3*2];v=g.uv[k/3*2+1];}
   if(p.kind==='balustrade'){if(ny>.999){u=q[0]+1;v=q[1]+.25;}else{u=(Math.abs(n[0])>.9?q[1]+.25:q[0]+1);v=(y-.88)*.5/.22;}}
   if(type===17){u=q[0]*(p.kind==='window_wall'||p.kind==='wall_niche'?2:1);v=y*3/p.height;}
   g.uv[k/3*2]=-128+u;g.uv[k/3*2+1]=type*64+16+v;
  }
 }return g;
}

function mesh(p,override){if(p.kind==='buttress_wall')return piecesMesh(p,buttressGeometry(p));const source=p.stoneVariation?{...p,stoneVariation:false,_stonePattern:p.finish!=='carved'}:p;const g=ornamentUV(p,coalescePlanar(unmergedMesh(source.finish==='carved'?{...source,finish:'stone',_carvedGeometry:['offering_table','buttress_wall'].includes(source.kind)}:source,override)));if(p.stoneVariation&&(p.finish==='carved'||p.kind==='wall_ruined'&&p.fracture))for(let i=0;i<g.uv.length;i+=2)g.uv[i]+=2;return g;}
const api={buttressGeometry,offeringGeometry,TRIM_PARTS,columnGeometry,COLUMN_PARTS,pavingGeometry,archGeometry,pierGeometry,VERSION,FEATURE,GRID,TYPES,empty,defaults,resolved,boxes,sockets,footprint,validate,transaction,floor,blocked,snap,surfaceVariant,fragmentGeometry,mesh,patch,exportData,stringifyExport};
if(typeof module!=='undefined')module.exports=api;root.TDRuins=api;
})(typeof window==='undefined'?globalThis:window);
