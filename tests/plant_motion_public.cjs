const fs=require('fs'),path=require('path'),assert=require('assert'),{withPage}=require('./cdp');
const out=path.resolve(__dirname,'../../plant-motion-evidence');
const url=process.argv[2]||'file:///'+path.join(__dirname,'plant_set_view.html').replaceAll('\\','/');
(async()=>{
 const report=await withPage(url,async p=>{
  await p.screenshot(path.join(out,'motion-gallery-initial.png'));
  const initial=await p.eval(`({assets:TDSharedData.assets.length,objects:objects.length,ready:plantGalleryReady,gl:renderer.getContext().getError(),wind:motionPreview.wind,strength:TDPineWind.uniforms.uPineWind.value.z,top:camera.position.x===0&&camera.position.z===1.5,initialMatchesRender:(()=>{const a=renderer.domElement.toDataURL();renderer.render(scene,camera);return a===renderer.domElement.toDataURL();})()})`);
  assert(initial.assets===19&&initial.objects===10&&initial.ready&&initial.gl===0&&initial.wind&&initial.strength>0&&initial.top&&initial.initialMatchesRender,JSON.stringify(initial));
  const before=await p.eval('renderer.domElement.toDataURL()');await new Promise(r=>setTimeout(r,850));assert.notEqual(await p.eval('renderer.domElement.toDataURL()'),before,'Default wind must animate without a button press');
  await p.eval('motionPreview.run=false;document.getElementById("previewContact").click();for(let k=0;k<400;k++)stepPlantPreview(1/60);stepPlantPreview(0);1');
  const contact=await p.eval('objects.map((o,i)=>({id:ids[i],bend:Math.hypot(o.userData.spring.bx,o.userData.spring.bz)}))');assert(contact.every(r=>Number.isFinite(r.bend)));assert(contact.slice(0,3).every(r=>r.bend===0));assert(contact.slice(3).some(r=>r.bend>.001));
  await p.screenshot(path.join(out,'motion-gallery-contact.png'));
  await p.eval('document.getElementById("previewContact").click();document.getElementById("previewWind").click();for(let k=0;k<360;k++)stepPlantPreview(1/60);1');
  const rest=await p.eval('objects.every(o=>o.userData.spring.bx===0&&o.userData.spring.bz===0)');assert(rest);
  const still=await p.eval('renderer.domElement.toDataURL()');await p.eval('motionPreview.time+=2;stepPlantPreview(0);1');assert.equal(await p.eval('renderer.domElement.toDataURL()'),still,'Disabled plants must stay still');
  const shaderErrors=await p.eval('renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).map(p=>p.diagnostics.programLog)');assert.equal(shaderErrors.length,0);assert.equal(p.errors.length,0,JSON.stringify(p.errors));
  return{status:'Passed',url,initial,automaticWind:true,contact,restExact:rest,staticPixelExact:true,shaderErrors,errors:p.errors};
 },{wait:8000,w:1616,h:1095});
 fs.writeFileSync(path.join(out,'motion-gallery.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
