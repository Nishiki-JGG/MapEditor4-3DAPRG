const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.argv[2]||path.resolve(__dirname,'..'),THREE=require(path.join(root,'three.min.js'));
const c={THREE,window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'props/common.js'),'utf8'),c);c.TDGeo=c.window.TDGeo;
vm.runInContext(fs.readFileSync(path.join(root,'terrain/cliff-placement.js'),'utf8'),c);
const generate=c.window.TDCliffPlacement.generate;
const config={size:32,heightAt:(x,z)=>2+2*(1+Math.tanh(x*3)),water:.8,seed:12345,cliffType:4,rockType:2,cliffHeight:2.2541,cliffWidth:2.4885,cliffDepth:1.3235,rockHeight:1.1,protectedAt:()=>false,blockedAt:()=>false};
const rocks=generate(config),main=rocks.filter(p=>p[0]===4);assert(main.length>0&&main.length<14,'no sparse cliff dressing: '+main.length);
assert.deepEqual(rocks,generate(config),'seed is not repeatable');assert.notDeepEqual(rocks,generate({...config,seed:6789}));
for(const p of rocks){assert(p.every(Number.isFinite));assert.equal(p[5],1);assert.equal(p[6],1,'vertical stretching');assert(p[4]<=1.12);}
for(let i=0;i<main.length;i++)for(let j=i+1;j<main.length;j++)assert(Math.hypot(main[i][1]-main[j][1],main[i][2]-main[j][2])>2.5,'stacked/packed centres');
for(const p of main){const r=config.cliffWidth*p[4]*.55;assert(Math.max(Math.abs(p[1]),Math.abs(p[2]))+r<=15);assert(p[7]+config.cliffHeight*p[4]<=6.22);}
const protectedRocks=generate({...config,protectedAt:(x,z,r)=>Math.abs(z)<2+r});for(const p of protectedRocks)assert(Math.abs(p[2])>=2+(p[0]===4?config.cliffWidth*p[4]*.55:.8*p[4]));
assert.equal(generate({...config,blockedAt:()=>true}).length,0);
assert.equal(generate({...config,heightAt:x=>3+x*.2}).length,0,'gentle hills dressed as cliffs');
assert.equal(generate({...config,water:10}).length,0,'submerged/unsupported decoration');
console.log(JSON.stringify({pass:true,main:main.length,total:rocks.length,deterministic:true,noStackOrStretch:true,protectedCorridor:true,obstacles:true,gentleSlope:true,submerged:true}));
