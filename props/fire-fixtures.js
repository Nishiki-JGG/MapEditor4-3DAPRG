// 手持ち風の地面松明と、独立した地面置き篝火。原本RoomTorchは編集しない。
(()=>{'use strict';
const {col,mat4,makeGeo,displace}=TDGeo;
const part=(g,x,y,z,c,sx=1,sy=1,sz=1,ry=0,rx=0,rz=0,glow=0)=>({g,m:mat4(x,y,z,sx,sy,sz,ry,rx,rz),c:col(c),glow,j:.045});
const iron=0x343b40,char=0x171410;
function torch(){
 const p=[];const wood=displace(new THREE.CylinderGeometry(.052,.072,1.5,9,5),.075,54);
 p.push({...part(wood,0,.75,0,0x66503a),cfn:(y,n,R,pr)=>col(y>1.25?0x29201a:0x70563a)});
 for(const y of [1.27,1.32,1.37])p.push(part(new THREE.TorusGeometry(.069,.012,4,12),0,y,0,0x8d7951,1,1,1,0,Math.PI/2));
 p.push(part(new THREE.CylinderGeometry(.122,.074,.21,10,1,true),0,1.56,0,iron));
 for(let i=0;i<8;i++){const a=i*Math.PI/4;p.push(part(new THREE.BoxGeometry(.021,.21,.018),Math.cos(a)*.104,1.59,Math.sin(a)*.104,0x454441,1,1,1,-a));}
 p.push(part(new THREE.TorusGeometry(.119,.017,5,16),0,1.665,0,0x514b3e,1,1,1,0,Math.PI/2));
 p.push(part(displace(new THREE.CylinderGeometry(.108,.092,.14,9,2),.18,62),0,1.64,0,char));
 for(let i=0;i<9;i++){const a=i*2.4;p.push(part(new THREE.DodecahedronGeometry(.024,0),Math.cos(a)*.075,1.708+(i%3)*.008,Math.sin(a)*.075,i%3?0x672714:0xe35318,1,.4,1,a,0,0,i%3?.15:1.2));}
 return makeGeo(p,705,{ao:.14});
}
const torchFire={origin:[0,1.69,0],width:.29,height:.48,power:1.8,range:8,sparkRate:7,smokeRate:2.5,radius:.045};
const originalBuild=TDProps.build;TDProps.build=()=>originalBuild().map(t=>t.id==='torch'?{...t,preparationGeo:t.geo,geo:torch(),groundSink:.05,material:'default',fireEffect:torchFire,light:[0xffa04c,1.8,1.75]}:t);
function brazier(){
 const p=[];
 // 鍛鉄の三脚。荷重を受ける足と炉床を別の部品として読める形にする。
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3,x=Math.cos(a),z=Math.sin(a);p.push(part(new THREE.CylinderGeometry(.036,.05,.58,7),x*.35,.28,z*.35,iron,1,1,1,-a,Math.sin(a)*.25,Math.cos(a)*.25));p.push(part(new THREE.BoxGeometry(.21,.045,.11),x*.42,.025,z*.42,0x292e31,1,1,1,-a));p.push(part(new THREE.TorusGeometry(.115,.018,4,12,Math.PI),x*.37,.38,z*.37,0x45403a,1,1,1,-a,0,Math.PI/2));}
 const profile=[new THREE.Vector2(.22,.36),new THREE.Vector2(.29,.40),new THREE.Vector2(.47,.50),new THREE.Vector2(.60,.65),new THREE.Vector2(.615,.70)];
 p.push(part(new THREE.LatheGeometry(profile,18),0,0,0,0x3c3730));
 p.push(part(new THREE.LatheGeometry(profile.map(v=>new THREE.Vector2(v.x-.018,v.y+.008)),18),0,0,0,0x221e1a));
 for(const [r,y]of [[.61,.69],[.34,.43]])p.push(part(new THREE.TorusGeometry(r,.026,5,24),0,y,0,0x51473c,1,1,1,0,Math.PI/2));
 for(let i=0;i<12;i++){const a=i*Math.PI/6;p.push(part(new THREE.SphereGeometry(.025,5,3),Math.cos(a)*.60,.64,Math.sin(a)*.60,0x6a5741));}
 p.push(part(new THREE.CylinderGeometry(.48,.38,.045,14),0,.54,0,0x62574b));
 // 重なり合う薪、割れた木口、灰をかぶった炭、熾火の割れ目。
 for(let i=0;i<5;i++){const a=i*2.399,x=Math.cos(a)*.10,z=Math.sin(a)*.10,y=.59+i*.026,dir=new THREE.Vector3(Math.sin(a),.06*(i%2?1:-1),Math.cos(a)).normalize();const g=displace(new THREE.CylinderGeometry(.072,.092,.83,7,3),.16,140+i),log=part(g,x,y,z,i%2?0x34231b:0x473020);log.m.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir),new THREE.Vector3(1,1,1));p.push(log);for(const s of [-1,1]){const center=new THREE.Vector3(x,y,z).addScaledVector(dir,.418*s);for(const [r,c,offset]of [[.065,0x8c6540,0],[.032,0x3b2a20,.001]]){const cap=part(new THREE.CircleGeometry(r,9),0,0,0,c);cap.m.compose(center.clone().addScaledVector(dir,offset*s),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),dir.clone().multiplyScalar(s)),new THREE.Vector3(1,1,1));p.push(cap);}}}
 for(let i=0;i<17;i++){const a=i*2.399,r=.12+.28*((i*7%17)/17);p.push(part(displace(new THREE.DodecahedronGeometry(.065+(i%3)*.012,0),.15,i),Math.cos(a)*r,.58+(i%3)*.02,Math.sin(a)*r,i%4?char:0xae3513,1,.55,1,a,0,0,i%4?.0:.7));}
 for(let i=0;i<12;i++){const a=i*1.73,r=.08+(i%4)*.08;p.push(part(new THREE.BoxGeometry(.012,.011,.10),Math.cos(a)*r,.66,Math.sin(a)*r,i%2?0xfd7320:0xb72e0d,1,1,1,a,0,0,1.7));}
 return makeGeo(p,941,{ao:.26});
}
const brazierFire={origin:[0,.67,0],width:.95,height:1.05,power:3.5,range:10,sparkRate:15,smokeRate:5,radius:.20};
TDProps.add({id:'brazier',name:'篝火',r:.73,min:2.2,sc:[.85,1.15],slope:.5,vis:.9,height:1.72,groundSink:.025,anyGround:true,manualOnly:true,tags:['cave','castle','ruins','graveyard'],material:'default',fireEffect:brazierFire,light:[0xff9c45,3.5,.98],build:brazier});
function exportData(props,types,roomId,U,baseY){const selected=props.filter(p=>types[p[0]].fireEffect);if(!selected.length)return null;const used=new Set(selected.map(p=>p[0]));return{version:1,units:'metres',axes:'Unity X/Y/Z',assets:[...used].map(t=>{const a=types[t];return{id:a.id,assetKey:a.assetKey,radius:a.r,height:a.height,fire:a.fireEffect,...TDSmallPropExport.geometry(a.geo)};}),instances:selected.map(p=>({instanceId:p[8],type:types[p[0]].id,assetKey:types[p[0]].assetKey,seedKey:roomId+'#'+p[8],position:[U.x(p[1]),U.y(baseY(p)),U.z(p[2])],yaw:U.yaw(p[3]),scale:[p[4],p[4]*(p[6]??1),p[4]]}))};}
window.TDFireFixtures={exportData};
})();
