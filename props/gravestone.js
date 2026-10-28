// Gravestone: worn slab on a low dressed-stone footing.
TDProps.add({
  id:'gravestone',name:'墓石',r:.3,min:1.1,sc:[.8,1.2],slope:.5,vis:.45,anyGround:true,
  tags:['graveyard'],height:1.13,material:'carved',surface:'grave-stone-grain-v1',
  build(){
    const {col,mixc,mat4,makeGeo}=TDGeo;
    const cf=(y,ny,R)=>mixc(col(0x77736b),col(0xaaa597),.27+Math.min(1,y)*.17);
    // A dressed stone footing with a worn upper arris and clipped corners.
    const v=[],ix=[],N=8,outline=(x,z,c)=>[[-x+c,-z],[x-c,-z],[x,-z+c],[x,z-c],[x-c,z],[-x+c,z],[-x,z-c],[-x,-z+c]];
    for(const[x,z,y,c]of [[.4,.25,0,.012],[.4,.25,.100,.012],[.388,.238,.12,.012]])for(const[a,b]of outline(x,z,c))v.push([a,y,b]);
    for(let k=0;k<2;k++)for(let j=0;j<N;j++){const a=k*N+j,b=k*N+(j+1)%N;ix.push(a,a+N,b,b,a+N,b+N);}
    for(let j=1;j<N-1;j++)ix.push(0,j,j+1,16,16+j+1,16+j);
    const parts=[{g:TDSmallParts.mesh(v,ix),m:mat4(0,0,.15,1,1,1),cfn:cf,j:.008}];
    const pose=mat4(0,0,-.05,1,1,1,0,-.06);
    const slabOutline=TDMarkerParts.arch(.3,.12,.83,16);slabOutline[5][0]*=.965;slabOutline[5][1]-=.012;slabOutline[12][1]-=.008;
    for(const q of TDMarkerParts.wornSlab(slabOutline,.14,cf,{outline:TDMarkerParts.arch(.19,.29,.64,8),depth:.036,bevel:.012,marks:[[.40,.235],[.51,.21],[.62,.16]]})){q.m=pose.clone().multiply(q.m);parts.push(q);}
    return TDSmallPropSurface.apply(makeGeo(parts,62,{ao:.18,smooth:8}));
  },
});
