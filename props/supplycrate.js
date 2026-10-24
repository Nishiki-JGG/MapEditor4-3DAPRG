TDProps.add({id:'supplycrate',name:'物資の木箱',r:.58,min:1.4,sc:[.8,1.2],slope:.18,vis:.64,anyGround:true,tags:['ruins','castle'],height:.70,groundSink:.002,shape:true,material:'cards2',build(){
 const {mat4}=TDGeo,{part,wood,iron,build}=TDPracticalParts,p=[];
 const board=(w,h,d,x,y,z,ry=0,rz=0)=>p.push(part(new THREE.BoxGeometry(w,h,d),mat4(x,y,z,1,1,1,ry,0,rz),wood,true));
 for(const s of [-1,1]){for(let k=0;k<3;k++){board(.88,.185,.045,0,.13+k*.20,s*.365);board(.045,.185,.69,s*.425,.13+k*.20,0);}for(const x of [-.365,.365])board(.065,.70,.065,x,.35,s*.365);}
 for(let k=0;k<4;k++)board(.205,.035,.74,(k-1.5)*.2175,.682,0);
 for(const s of [-1,1]){board(.82,.065,.04,0,.075,s*.39);board(.82,.065,.04,0,.625,s*.39);board(.79,.06,.035,0,.35,s*.402,0,s*.57);}
 board(.84,.045,.70,0,.025,0);
 for(const x of [-.365,.365])for(const z of [-.407,.407])for(const y of [.075,.625])p.push(part(new THREE.BoxGeometry(.019,.019,.012),mat4(x,y,z,1,1,1),iron));return build(p,802,true);
}});
