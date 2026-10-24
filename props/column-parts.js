// Decorative column parts. The old composite ID remains loadable for existing maps.
(()=>{
const {mat4,makeGeo,col,mixc}=TDGeo,{mesh}=TDSmallParts;
const stone=(y,ny,R,pr)=>mixc(col(0x9d9a8e),col(0xc3bdac),.25+pr*.35);
function shaft(h,r0,r1,fallen=false){const v=[],ix=[],N=24,levels=fallen?[0,.10,h*.55,h]:[.30,.38,.80,1.34,1.65];
 for(let k=0;k<levels.length;k++)for(let j=0;j<N;j++){const a=j/N*Math.PI*2,t=k/(levels.length-1),r=THREE.MathUtils.lerp(r0,r1,t)*(1-.05*(1+Math.cos(a*12))),fract=k===levels.length-1?.035*Math.sin(a*3+.4)+.020*Math.cos(a*7):fallen&&k===0?.06*Math.sin(a*5):0;v.push([Math.cos(a)*r,levels[k]+fract,Math.sin(a)*r]);}
 for(let k=1;k<levels.length;k++)for(let j=0;j<N;j++){const a=(k-1)*N+j,b=(k-1)*N+(j+1)%N,c=a+N,d=b+N;ix.push(a,c,b,b,c,d);}
 for(const k of [0,levels.length-1]){const q=v.length;for(let j=0;j<N;j++){const a=j/N*Math.PI*2;v.push([Math.cos(a)*.13,levels[k]+.018*Math.sin(a*5+.3),Math.sin(a)*.13]);}const c=v.length;v.push([.016,levels[k]-.006,-.013]);for(let j=0;j<N;j++){const n=(j+1)%N;if(k)ix.push(k*N+j,q+j,q+n,k*N+j,q+n,k*N+n,c,q+n,q+j);else ix.push(k*N+j,q+n,q+j,k*N+j,k*N+n,q+n,c,q+j,q+n);}}
 return mesh(v,ix);
}
TDProps.add({id:'brokencol_base',name:'折れた石柱・根元',r:.5,min:2,sc:[.8,1.2],slope:.6,vis:.65,anyGround:true,shape:true,tags:['ruins','desert','graveyard'],height:1.81,material:'carved',build(){return makeGeo([{g:new THREE.BoxGeometry(1,.22,1),m:mat4(0,.11,0,1,1,1,.2),cfn:stone,j:.015},{g:new THREE.CylinderGeometry(.43,.46,.10,24),m:mat4(0,.27,0,1,1,1),cfn:stone,j:.012},{g:shaft(1.65,.38,.30),m:new THREE.Matrix4(),cfn:stone,j:.015}],56,{ao:.20,smooth:45});}});
TDProps.add({id:'columnfragment',name:'折れた石柱・先端',r:.48,min:1.3,sc:[.8,1.2],slope:.5,vis:.65,anyGround:true,shape:true,tags:['ruins','desert','graveyard'],height:.73,material:'carved',build(){return makeGeo([{g:shaft(.9,.34,.32,true),m:mat4(0,.34,0,1,1,1,0,0,Math.PI/2),cfn:stone,j:.015}],57,{ao:.15,smooth:45});}});
})();
