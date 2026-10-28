TDProps.add({id:'brokenpot',name:'割れた壺',r:0,min:1,sc:[.8,1.2],slope:.18,vis:.62,anyGround:true,tags:['ruins','castle'],height:.42,groundSink:.002,material:'cards2',build(){
 const {mat4}=TDGeo,{mesh}=TDSmallParts,P=TDPracticalParts,body=P.brokenVessel(),pos=body.attributes.position,bi=body.index;
 // Close the vessel physically: the old horizontal inner floor faced down.
 for(let i=0;i<bi.count;i+=3){const a=bi.getX(i),b=bi.getX(i+1),c=bi.getX(i+2),y=pos.getY(a);if(Math.abs(y-pos.getY(b))<1e-6&&Math.abs(y-pos.getY(c))<1e-6&&(Math.abs(y)<1e-6||Math.abs(y-.065)<1e-6)){const ny=(pos.getZ(b)-pos.getZ(a))*(pos.getX(c)-pos.getX(a))-(pos.getX(b)-pos.getX(a))*(pos.getZ(c)-pos.getZ(a));if(ny*(y>.03?1:-1)<0){bi.setX(i+1,c);bi.setX(i+2,b);}}}
 body.computeVertexNormals();const p=[P.part(body,undefined,P.clay)];
 for(const[x,z,a,s]of [[.39,.16,.5,.9],[-.35,.20,-.4,.7],[.18,-.40,1.2,.6]]){
  // 壺の胴から落ちた浅く湾曲した素地。平たい三角柱にはしない。
  const points=[[-.10,.006,-.07],[.055,.018,-.085],[.12,.044,.025],[-.025,.022,.10]],v=[...points,...points.map(([x,y,z])=>[x,y+.018,z])],ix=[0,2,1,0,3,2,4,5,6,4,6,7];
  for(let j=0;j<4;j++){const n=(j+1)%4;ix.push(j,n,j+4,n,n+4,j+4);}p.push(P.part(mesh(v,ix),mat4(x,.002-.006*s,z,s,s,s,a),P.clay));
 }return P.ceramic(p,807);
}});
