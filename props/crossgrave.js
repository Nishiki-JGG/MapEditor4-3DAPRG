// 十字の墓（crossgrave）
TDProps.add({
  id: 'crossgrave', name: '十字の墓',
  r: .3, min: 1.2, sc: [.8, 1.2], slope: .5, vis: .5, anyGround: true,
  tags: ['graveyard'], height: 1.18, material: 'carved', surface:'grave-stone-grain-v1',
  build() {
    const { col, mixc, mat4, makeGeo } = TDGeo;
    const cf=(y,ny,R,pr)=>mixc(col(0x89867d),col(0xb0aba0),.18+pr*.25);
    // 一つの石材を切り抜いた十字。交差する箱の継ぎ目と重複面を作らない。
    const outline=[[-.065,0],[.065,0],[.065,.76],[.3,.76],[.3,.89],[.065,.89],[.065,1.15],[-.065,1.15],[-.065,.89],[-.3,.89],[-.3,.76],[-.065,.76]];
    // Small, uneven edge losses stay inside the old outline.
    const weathered=[];
    for(let i=0;i<outline.length;i++){const a=outline[(i+outline.length-1)%outline.length],b=outline[i],c=outline[(i+1)%outline.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],convex=u[0]*v[1]-u[1]*v[0]>0,d=[.008,.011,.007,.009][i%4];if(convex&&b[1]>.04){const l=Math.hypot(...u),m=Math.hypot(...v);weathered.push([b[0]-u[0]/l*d,b[1]-u[1]/l*d],[b[0]+v[0]/m*d*.8,b[1]+v[1]/m*d*.8]);}else weathered.push(b);}
    const tilt=mat4(0,.025,-.15,1,1,1,0,0,.05);
    const parts=TDMarkerParts.wornSlab(weathered,.13,cf,{outline:[[-.029,.27],[.029,.27],[.029,.795],[.23,.795],[.23,.855],[.029,.855],[.029,1.07],[-.029,1.07],[-.029,.855],[-.23,.855],[-.23,.795],[-.029,.795]],depth:.018,bevel:.007}).map(p=>({...p,m:tilt,j:.003}));
    // Keep the visible outline and placement root; bury only the lowest stone foot.
    for(const part of parts){const p=part.g.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)<.04)p.setY(i,p.getY(i)-.04);}
    // Preserve the stone colour sequence after removing the 80-triangle soil.
    return TDSmallPropSurface.apply(makeGeo(parts,2327942852,{ao:.16,smooth:32}));
  },
});
