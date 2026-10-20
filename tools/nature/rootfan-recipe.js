// 自作の露出根。幹・切株・倒木を含まない地表のアクセント。
TDProps.add({id:'rootfan',name:'露出根',r:0,min:1.2,sc:[.8,1.2],slope:.6,vis:1.1,tags:['forest','grassland'],height:.24,
 build(){const {limb,makeGeo,col,mixc,ATLAS}=TDGeo;const parts=[];
 const bark=(y,ny,R)=>mixc(col(0x664d34),col(0x94734d),R());
 for(let k=0;k<5;k++){const a=k*1.23+.3,L=.65+(k%3)*.19;
 const p=[Math.cos(a)*L*.48,.13,Math.sin(a)*L*.48],q=[Math.cos(a)*L,.045,Math.sin(a)*L];
 limb(parts,[0,.16,0],p,.085,.06,5,bark,{uvr:ATLAS.uvr('bark')});limb(parts,p,q,.06,.012,5,bark,{uvr:ATLAS.uvr('bark')});}
 return makeGeo(parts,812,{ao:.25,uv:ATLAS.white});}});
