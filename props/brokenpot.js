TDProps.add({id:'brokenpot',name:'割れた壺',r:0,min:1,sc:[.8,1.2],slope:.18,vis:.62,anyGround:true,tags:['ruins','castle'],height:.42,groundSink:.002,build(){
 const {mat4}=TDGeo,{mesh}=TDSmallParts,P=TDPracticalParts,p=[P.part(P.brokenVessel(),undefined,P.clay)];
 for(const[x,z,a,s]of [[.39,.16,.5,.9],[-.35,.20,-.4,.7],[.18,-.40,1.2,.6]]){const g=mesh([[-.10,0,-.08],[.11,0,-.06],[.04,.045,.10],[-.10,.02,-.08],[.11,.02,-.06],[.04,.065,.10]],[0,2,1,3,4,5,0,1,3,1,4,3,1,2,4,2,5,4,2,0,5,0,3,5]);p.push(P.part(g,mat4(x,.002,z,s,s,s,a),P.clay));}return P.build(p,807);
}});
