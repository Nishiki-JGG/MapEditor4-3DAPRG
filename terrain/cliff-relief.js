// Derived visual rock surface. The editable heightfield and its walking boundary stay authoritative.
// Subdivision is confined to steep faces; rim vertices and walkable shoulders are not moved.
(() => {
'use strict';
const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const noise=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),u=ease(0,1,x-i),v=ease(0,1,z-j),h=TDGeo.hash2;return (h(i,j)*(1-u)+h(i+1,j)*u)*(1-v)+(h(i,j+1)*(1-u)+h(i+1,j+1)*u)*v;};
const edge=(a,b)=>a<b?a+':'+b:b+':'+a;
// mask(x, z) (optional, 0..1) scales the relief down, e.g. to 0 behind a waterfall's sheet
function build(source,heightAt,half,mask) {
  const P=source.attributes.position,N=source.attributes.normal,I=source.index.array,faces=[],edges=new Map();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  for(let i=0;i<I.length;i+=3){
    const f=[I[i],I[i+1],I[i+2]];a.fromBufferAttribute(P,f[0]);b.fromBufferAttribute(P,f[1]);c.fromBufferAttribute(P,f[2]);
    ab.subVectors(b,a);ac.subVectors(c,a);const up=ab.cross(ac).normalize().y;
    if(up>=.72)continue;
    f.sourceFace=i/3;faces.push(f);for(const [u,v]of [[f[0],f[1]],[f[1],f[2]],[f[2],f[0]]]){const k=edge(u,v);edges.set(k,(edges.get(k)||0)+1);}
  }
  const rimVertices=new Set();
  for(const [key,count]of edges)if(count===1)for(const id of key.split(':'))rimVertices.add(+id);
  const steps=Math.max(1,Math.min(4,Math.floor(Math.sqrt(64000/Math.max(1,faces.length)))));
  const sizes={position:3,splatA:4,splatB:4,splatC:1,cliffT:3,cliffM:4,cliffW:2,reliefSlope:1};
  const arrays=Object.fromEntries(Object.keys(sizes).map(k=>[k,[]])),triangles=[],sourceFaceIds=[],cache=new Map();let maxOffset=0;
  for(const f of faces){
    const ids=[],bound=[edges.get(edge(f[1],f[2]))===1,edges.get(edge(f[2],f[0]))===1,edges.get(edge(f[0],f[1]))===1];
    for(let u=0;u<=steps;u++){
      ids[u]=[];
      for(let v=0;v<=steps-u;v++){
        const w=[1-(u+v)/steps,u/steps,v/steps];let x=0,y=0,z=0,nx=0,ny=0,nz=0;
        for(let q=0;q<3;q++){x+=P.getX(f[q])*w[q];y+=P.getY(f[q])*w[q];z+=P.getZ(f[q])*w[q];nx+=N.getX(f[q])*w[q];ny+=N.getY(f[q])*w[q];nz+=N.getZ(f[q])*w[q];}
        const key=Math.round(x*1e5)+':'+Math.round(y*1e5)+':'+Math.round(z*1e5);
        if(cache.has(key)){ids[u][v]=cache.get(key);continue;}
        let rim=1;for(let q=0;q<3;q++){if(bound[q])rim*=ease(0,.28,w[q]);if(w[q]===1&&rimVertices.has(f[q]))rim=0;}
        const heights=[heightAt(x-.9,z),heightAt(x+.9,z),heightAt(x,z-.9),heightAt(x,z+.9)];
        const foot=ease(.30,.85,y-Math.min(...heights)),crest=ease(.12,.65,Math.max(...heights)-y);
        const slope=ease(.20,.48,1-ny),frame=ease(0,.6,half-Math.max(Math.abs(x),Math.abs(z)));
        const grain=.60*noise(x*.75+y*.35,z*.75-y*.23)+.25*noise(x*1.9+y*.75,z*1.9-y*.5)+.15*noise(x*4.2-y*1.1,z*4.2+y*.7);
        const offset=(.045+.55*grain)*rim*foot*crest*slope*frame*(mask?mask(x,z):1),ln=Math.hypot(nx,ny,nz)||1;
        maxOffset=Math.max(maxOffset,offset);
        const id=arrays.position.length/3;cache.set(key,id);ids[u][v]=id;
        arrays.position.push(x+nx/ln*offset,y+ny/ln*offset,z+nz/ln*offset);
        arrays.reliefSlope.push(1-ny);
        for(const name of Object.keys(sizes))if(name!=='position'&&name!=='reliefSlope'){
          const attr=source.attributes[name];for(let k=0;k<sizes[name];k++)arrays[name].push(f.reduce((sum,index,q)=>sum+attr.array[index*sizes[name]+k]*w[q],0));
        }
      }
    }
    for(let u=0;u<steps;u++)for(let v=0;v<steps-u;v++){
      triangles.push(ids[u][v],ids[u+1][v],ids[u][v+1]);sourceFaceIds.push(f.sourceFace);
      if(v<steps-u-1){triangles.push(ids[u+1][v],ids[u+1][v+1],ids[u][v+1]);sourceFaceIds.push(f.sourceFace);}
    }
  }
  const g=new THREE.BufferGeometry();for(const name of Object.keys(sizes))g.setAttribute(name,new THREE.Float32BufferAttribute(arrays[name],sizes[name]));
  g.setIndex(triangles);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  g.userData={sourceFaces:faces.length,subdivision:steps,triangles:triangles.length/3,maxOffset,walkingHeightfieldChanged:false};
  Object.defineProperty(g.userData,'sourceFaceIds',{value:sourceFaceIds,enumerable:false});
  return g;
}
function exportMesh(g,half,yZero){
  const round=x=>+x.toFixed(5),p=g.attributes.position.array,n=g.attributes.normal.array,positions=[],normals=[],triangles=[];
  for(let i=0;i<p.length;i+=3){positions.push(round(p[i]+half),round(p[i+1]-yZero),round(half-p[i+2]));normals.push(round(n[i]),round(n[i+1]),round(-n[i+2]));}
  const ix=g.index.array;for(let i=0;i<ix.length;i+=3)triangles.push(ix[i],ix[i+2],ix[i+1]);
  return{format:'tdj-cliff-relief-mesh',schemaVersion:1,frame:'Unity world metres, same corner origin and y zero as meta.json',winding:'clockwise front faces (Unity)',role:'visual rock relief; walking heightfield unchanged',positions,normals,triangles,
    tint:Array.from(g.attributes.cliffT.array,round),moss:Array.from(g.attributes.cliffM.array,round),wetSnow:Array.from(g.attributes.cliffW.array,round),stats:g.userData};
}
window.TDCliffRelief={build,exportMesh};
})();
