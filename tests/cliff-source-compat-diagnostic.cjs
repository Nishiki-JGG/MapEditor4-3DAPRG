// Read-only compatibility probe. No asset, save, or source hash is rewritten.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict'),THREE=require('../three.min.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/night-props/batch18-final');fs.mkdirSync(out,{recursive:true});
const c={THREE,window:{},TextEncoder,btoa,atob};vm.createContext(c);
for(const file of ['props/common.js','props/cliff.js','terrain/cliff-fits.js']){if(file==='props/cliff.js'){c.TDGeo=c.window.TDGeo;c.TDProps=c.window.TDProps;}vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);}
const original=c.TDProps.build()[0],hash=b=>crypto.createHash('sha256').update(b).digest('hex'),Store=c.window.TDCliffFits.Store;
const p=[0,0,0,0,1,0,1,null,'compat-cliff'];const store=new Store([original],hash);store.set(p,original.geo.clone(),'unchanged-map');const save=store.save();store.validate(save,[p],'unchanged-map');
// A 1 mm vertex edit alone already changes the geometry identity. This is a
// compatibility counterexample, not an adopted visual repair.
const altered=original.geo.clone();altered.attributes.position.setY(0,altered.attributes.position.getY(0)+.001);
const next=new Store([{...original,geo:altered}],hash);let rejection=null;try{next.validate(save,[p],'unchanged-map');}catch(e){rejection=e.message;}
assert.notEqual(store.sourceHash(0),next.sourceHash(0));assert(rejection?.includes('compat-cliff'));
const result={pass:true,baselineAccepted:true,oneMillimetreEditRejected:!!rejection,rejection,originalHash:store.sourceHash(0),alteredHash:next.sourceHash(0),productionModified:false};fs.writeFileSync(path.join(out,'cliff-save-compat.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
