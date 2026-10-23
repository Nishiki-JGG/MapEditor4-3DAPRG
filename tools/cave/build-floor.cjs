// 同じ計算をブラウザGLSL/Unity HLSLへ出力。外部画像なし。
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),glsl=fs.readFileSync(path.join(__dirname,'floor-surface.glsl'),'utf8').replace(/\r\n?/g,'\n'),sha=crypto.createHash('sha256').update(glsl).digest('hex');
const data={version:1,id:'cave-limestone-floor/1',sourceSha256:sha,encodedColorSpace:'sRGB',decodeExponent:2.2,units:'metres',paintChannel:'rubble',maxReliefMetres:.0035};
const outputs={
 'terrain/cave-floor.js':'// 自作の洞窟床。生成元: tools/cave/floor-surface.glsl\nwindow.TDCaveFloor={data:'+JSON.stringify(data)+',active:{value:0},GLSL:'+JSON.stringify(glsl)+'};\n',
 'unity/Assets/MapSharedProps/Runtime/SharedCaveFloor.hlsl':'// 生成元: tools/cave/floor-surface.glsl SHA256 '+sha+'\n'+glsl.replace(/\bvec([234])\b/g,'float$1').replace(/\bfract\b/g,'frac').replace(/\bmix\b/g,'lerp'),
 'unity/Assets/MapSharedProps/Runtime/SharedCaveFloorContract.cs':'// 自動生成。床の見た目の版を照合する。\nnamespace MapSharedProps { public static class SharedCaveFloorContract { public const string Hash="'+sha+'"; } }\n'
};
for(const [file,text]of Object.entries(outputs)){if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n?/g,'\n'),text,file);else fs.writeFileSync(path.join(root,file),text);}
console.log(JSON.stringify({pass:true,sha256:sha,check:process.argv.includes('--check')}));
