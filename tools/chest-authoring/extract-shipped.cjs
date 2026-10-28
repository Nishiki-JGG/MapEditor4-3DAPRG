const fs=require('fs'),path=require('path'),vm=require('vm');
const out=process.argv[2];if(!out)throw Error('Usage: node tools/chest-authoring/extract-shipped.cjs <new-output-directory>');fs.mkdirSync(out,{recursive:false});
const root=path.resolve(__dirname,'../..'),ctx={window:{}};vm.createContext(ctx);
for(const name of ['chest-gold-data.js','chest-part-data.js','chest-royal-data.js','chest-worn-data.js'])vm.runInContext(fs.readFileSync(path.join(root,'props',name),'utf8'),ctx);
let count=0;function visit(x,keys){if(!x||typeof x!=='object')return;if(typeof x.png==='string'){fs.writeFileSync(path.join(out,keys.join('-')+'.png'),Buffer.from(x.png,'base64'));count++;}for(const[k,v]of Object.entries(x))if(typeof v==='object')visit(v,[...keys,k]);}
for(const[k,v]of Object.entries(ctx.window))visit(v,[k]);console.log(JSON.stringify({images:count}));
