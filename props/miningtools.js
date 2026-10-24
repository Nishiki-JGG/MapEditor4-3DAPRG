// つるはしとシャベルは別々の剛体として地面に沿う。用途は装飾で採掘機能は持たない。
TDProps.add({id:'miningtools',name:'採掘道具',r:0,min:1.5,sc:[.9,1.1],slope:.35,vis:.85,anyGround:true,tags:['ruins','castle'],height:.16,groundSink:.001,build(){
 const {mat4,col,mixc}=TDGeo,{tube,mesh}=TDSmallParts,{part,iron,grounded}=TDPracticalParts,p=[],wood=(y,ny,R,pr)=>mixc(col(0x88653e),col(0xbfa074),.25+pr*.45);
 // 横たえた木柄と片側の尖った鉄頭。反対側は短い平刃。
 const pick=mat4(-.18,0,-.08,1,1,1,-.23),add=(g,m,c=wood,tex=false)=>p.push(part(g,pick.clone().multiply(m),c,tex));
 add(new THREE.CylinderGeometry(.026,.031,1.08,6),mat4(0,.075,0,1,1,1,0,Math.PI/2),wood,true);
 const hv=[],hi=[],head=[[-.28,.004,.015,.035],[-.14,.028,.013,.075],[-.045,.045,0,.11],[.045,.043,0,.10],[.13,.026,.012,.068],[.23,.010,.015,.030]];
 for(const[x,w,b,t]of head)hv.push([x,b,-.40-w],[x,t,-.40-w],[x,t,-.40+w],[x,b,-.40+w]);
 for(let k=0;k<head.length-1;k++)for(let j=0;j<4;j++){const a=k*4+j,b=k*4+(j+1)%4,c=a+4,d=b+4;hi.push(a,c,b,b,c,d);}hi.push(0,1,2,0,2,3,20,22,21,20,23,22);
 add(mesh(hv,hi),mat4(0,0,0,1,1,1),iron);
 add(new THREE.CylinderGeometry(.047,.04,.13,6),mat4(0,.075,-.40,1,1,1,0,Math.PI/2),iron);
 const split=p.length,pose=mat4(.24,0,.06,1,1,1,.28),addS=(g,m,c=wood,tex=false)=>p.push(part(g,pose.clone().multiply(m),c,tex));
 addS(new THREE.CylinderGeometry(.024,.028,.92,6),mat4(0,.10,-.11,1,1,1,0,Math.PI/2),wood,true);
 addS(new THREE.CylinderGeometry(.023,.023,.19,6),mat4(0,.10,.35,1,1,1,0,0,Math.PI/2),wood,true);
 addS(new THREE.CylinderGeometry(.043,.035,.18,6),mat4(0,.08,-.58,1,1,1,0,Math.PI/2),iron);
 const q=[[-.12,0,-.67],[.12,0,-.67],[.17,.025,-.87],[.11,0,-1.02],[-.11,0,-1.02],[-.17,.025,-.87],[0,.035,-.77]],v=[...q,...q.map(([x,y,z])=>[x,y+.017,z])],ix=[];for(let i=0;i<6;i++){const j=(i+1)%6;ix.push(6,i,j,13,j+7,i+7,i,i+7,j,j,i+7,j+7);}addS(mesh(v,ix),mat4(0,0,0,1,1,1),iron);
 return grounded(p,801,[['pick',0,split,[-.18,0,-.08]],['shovel',split,p.length,[.24,0,.06]]]);
}});
