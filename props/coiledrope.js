TDProps.add({id:'coiledrope',name:'巻いた縄',r:0,min:1,sc:[.9,1.2],slope:.35,vis:.43,anyGround:true,tags:['ruins','castle'],height:.065,groundSink:.001,build(){
 const {tube}=TDSmallParts,{part,fibre,grounded}=TDPracticalParts,p=[],v=[];for(let k=0;k<=48;k++){const a=k/48*Math.PI*2*2.8,r=.095+k/48*.19;v.push([Math.cos(a)*r,.024,Math.sin(a)*r*.84]);}
 v.push([.20,.024,-.30],[.06,.024,-.35],[-.03,.024,-.33]);p.push(part(tube(v,v.map(()=>.020),5),undefined,fibre));return grounded(p,805,[['rope',0,1,[0,0,0]]]);
}});
