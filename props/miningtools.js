// つるはしとシャベルは別々の剛体として地面に沿う。用途は装飾で採掘機能は持たない。
TDProps.add({id:'miningtools',name:'採掘道具',r:0,min:1.5,sc:[.9,1.1],slope:.35,vis:.85,anyGround:true,tags:['ruins','castle'],height:.16,groundSink:.001,material:'cards2',build(){
 const {mat4,col,mixc,ATLAS2}=TDGeo,{tube,mesh}=TDSmallParts,{part,grounded}=TDPracticalParts,p=[],wood=(y,ny,R,pr)=>mixc(col(0xc7b596),col(0xead9b9),.25+pr*.35),iron=(y,ny,R,pr)=>mixc(col(0x444a4d),col(0x737875),.18+pr*.27),edge=(y,ny,R,pr)=>mixc(col(0x747b7a),col(0xa0a39a),.2+pr*.22);
 // The existing wood atlas follows each handle, with a narrow knot-free grain strip.
 const piece=(g,m,c,tex)=>{const a=part(g,m,c,tex);a.j=.008;if(tex){const q=ATLAS2.uvr('wood');a.uvr=[q[0]+.04*(q[2]-q[0]),q[1],q[0]+.16*(q[2]-q[0]),q[3]];}return a;};
 // 横たえた木柄と片側の尖った鉄頭。反対側は短い平刃。
 const outward=g=>{const ix=g.index;for(let i=0;i<ix.count;i+=3){const b=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,b);}g.computeVertexNormals();return g;};
 const pick=mat4(-.18,0,-.08,1,1,1,-.23),add=(g,m,c=wood,tex=false)=>p.push(piece(g,pick.clone().multiply(m),c,tex));
 let pickPitch=Math.atan((.075-.026)/.94);for(let i=0;i<3;i++)pickPitch=Math.atan((.075-.026*Math.cos(pickPitch))/.94);
 const pickButt=.026*Math.cos(pickPitch),pickFront=.075+.14*Math.tan(pickPitch);
 add(new THREE.CylinderGeometry(.026,.031,1.08/Math.cos(pickPitch),10),mat4(0,(pickButt+pickFront)/2,0,1,1,1,0,Math.PI/2+pickPitch),wood,true);
 const hv=[],hi=[],head=[[-.28,.004,.015,.035],[-.14,.028,.013,.075],[-.045,.045,0,.11],[.045,.043,0,.10],[.13,.026,.012,.068],[.23,.010,.015,.030]];
 for(const[x,w,b,t]of head)hv.push([x,b,-.40-w],[x,t,-.40-w],[x,t,-.40+w],[x,b,-.40+w]);
 for(let k=0;k<head.length-1;k++)for(let j=0;j<4;j++){const a=k*4+j,b=k*4+(j+1)%4,c=a+4,d=b+4;hi.push(a,c,b,b,c,d);}hi.push(0,1,2,0,2,3,20,22,21,20,23,22);
 add(outward(mesh(hv,hi)),mat4(0,0,0,1,1,1),iron);
 add(new THREE.CylinderGeometry(.047,.04,.13,8),mat4(0,.075,-.40,1,1,1,0,Math.PI/2+pickPitch),iron);
 add(new THREE.CylinderGeometry(.033,.033,.042,10),mat4(0,.069,-.32,1,1,1,0,Math.PI/2+pickPitch),iron);
 add(new THREE.CylinderGeometry(.008,.009,.004,6),mat4(0,.112,-.40,1,1,1),edge);
 const split=p.length,pose=mat4(.24,0,.06,1,1,1,.28),addS=(g,m,c=wood,tex=false)=>p.push(piece(g,pose.clone().multiply(m),c,tex));
 let shovelPitch=Math.atan((.08-.024)/.93);for(let i=0;i<3;i++)shovelPitch=Math.atan((.08-.024*Math.cos(shovelPitch))/.93);
 addS(new THREE.CylinderGeometry(.024,.028,.92/Math.cos(shovelPitch),10),mat4(0,.08-.47*Math.tan(shovelPitch),-.11,1,1,1,0,Math.PI/2+shovelPitch),wood,true);
 addS(new THREE.CylinderGeometry(.023,.023,.19,10),mat4(0,.023*Math.cos(Math.PI/10),.35,1,1,1,0,0,Math.PI/2),wood,true);
 addS(new THREE.CylinderGeometry(.043,.035,.18,8),mat4(0,.08,-.58,1,1,1,0,Math.PI/2+shovelPitch),iron);
 // A thin, cupped blade: a raised shoulder, lowered cutting lip and a worn bevel.
 const outline=[[-.12,.035,-.67],[.12,.035,-.67],[.17,.034,-.83],[.155,.022,-.94],[.11,.008,-1.02],[-.11,.008,-1.02],[-.155,.022,-.94],[-.17,.034,-.83]],v=[],ix=[],bevel=[],n=outline.length;
 for(const[x,y,z]of outline)v.push([x,y-.008,z]);
 for(const[x,y,z]of outline)v.push([x,y,z]);
 for(const[x,y,z]of outline)v.push([x*.95,y-.004,z+(z<-.9?.008:z>-.7?-.007:0)]);
 const bottom=v.length;v.push([0,.002,-.82]);const centre=v.length;v.push([0,.012,-.82]);
 // Clockwise outline in X/Z gives upward-facing fan normals.
 for(let j=0;j<n;j++){const k=(j+1)%n;ix.push(bottom,k,j,j,k,n+j,k,n+k,n+j,centre,2*n+j,2*n+k);bevel.push(n+j,n+k,2*n+j,n+k,2*n+k,2*n+j);}
 addS(mesh(v,ix),mat4(0,0,0,1,1,1),iron);addS(mesh(v,bevel),mat4(0,0,0,1,1,1),edge);
 // A short forged neck overlaps the blade face and the socket; it is structural.
 addS(new THREE.BoxGeometry(.045,.014,Math.hypot(.13,.042)),mat4(0,.059,-.675,1,1,1,0,-Math.atan2(.042,.13)),iron);
 addS(new THREE.CylinderGeometry(.029,.029,.035,10),mat4(0,.08-.47*Math.tan(shovelPitch),.30,1,1,1,0,Math.PI/2+shovelPitch),iron);
 addS(new THREE.CylinderGeometry(.008,.009,.004,6),mat4(0,.069,-.68,1,1,1),edge);
 const g=grounded(p,801,[['pick',0,split,[-.18,0,-.08]],['shovel',split,p.length,[.24,0,.06]]],true);
 // Keep thin forged faces flat rather than smoothing their normals across the underside.
 const pos=g.attributes.position,norm=g.attributes.normal;let offset=0;
 for(const a of p){const count=a.g.index?a.g.index.count:a.g.attributes.position.count;if(!a.uvr)for(let i=offset;i<offset+count;i+=3){const x=new THREE.Vector3().fromBufferAttribute(pos,i),y=new THREE.Vector3().fromBufferAttribute(pos,i+1),z=new THREE.Vector3().fromBufferAttribute(pos,i+2),n=y.sub(x).cross(z.sub(x)).normalize();for(let j=i;j<i+3;j++)norm.setXYZ(j,n.x,n.y,n.z);}offset+=count;}return g;
}});
