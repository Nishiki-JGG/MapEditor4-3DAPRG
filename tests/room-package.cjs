const assert = require('node:assert/strict');
const { create, safeName } = require('../map-package.js');
const fs = require('node:fs');
const vm = require('node:vm');
// 製品のZIP実装を使用し、外側と内側の双方を独立したZIP読取で確認する。
const app = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const ctx = { Blob, TextEncoder, Uint8Array, Uint32Array, DataView, ArrayBuffer, Response, CompressionStream };
vm.runInNewContext(app.slice(app.indexOf('const CRC ='), app.indexOf('// SHA-256')) + '\nthis.zip = makeZip;', ctx);
function readZip(buffer) {
  const files = {};
  for (let offset = 0; buffer.readUInt32LE(offset) === 0x04034b50;) {
    const size = buffer.readUInt32LE(offset + 18), n = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + n).toString();
    const start = offset + 30 + n + extra;
    files[name] = buffer.readUInt16LE(offset+8) === 8 ? require('node:zlib').inflateRawSync(buffer.subarray(start,start+size)) : buffer.subarray(start,start+size); offset = start + size;
  }
  return files;
}
(async () => {
  const map = { format: 'map-editor-proto', version: 2, roomId: 'room-a', heightsF32: 'abc', revision: 3 };
  const embedded = JSON.stringify({ format: map.format, version: 2, roomId: map.roomId, heightsF32: 'abc' });
  const result = { files: [{ name: 'map.json', data: embedded }], validation: { errors: [] } };
  const options = { name: '森の部屋', snapshot: () => ({ ...map }), makeZip: ctx.zip, buildExport: async () => { map.revision++; return result; } };
  const pack = await create(options), outer = readZip(Buffer.from(await pack.blob.arrayBuffer()));
  const inner = readZip(outer['森の部屋/森の部屋_export_unity.zip']);
  assert.deepEqual(outer['森の部屋/森の部屋.json'], inner['map.json']);
  assert.equal(JSON.parse(inner['map.json']).roomId, 'room-a');
  await assert.rejects(create({ ...options, buildExport: async () => { map.heightsF32 = 'changed'; return result; } }), /変更/);
  map.heightsF32 = 'abc';
  await assert.rejects(create({ ...options, buildExport: async () => ({ ...result, files: [{ name: 'map.json', data: '{"roomId":"other"}' }] }) }), /一致/);
  await assert.rejects(create({ ...options, buildExport: async () => { throw Error('export failed'); } }), /export failed/);
  const archive=new Uint8Array([80,75,1,2]),compact={files:[{name:'source_ref.json',data:'{}'}],authoring:{name:'map.map',data:archive},sourceState:require('../map-package.js').authoringState(map),validation:{errors:[]}};
  const compactPack=await create({...options,buildExport:async()=>compact}),compactFiles=readZip(Buffer.from(await compactPack.blob.arrayBuffer()));
  assert.deepEqual(compactFiles['森の部屋/map.map'],Buffer.from(archive));assert(!readZip(compactFiles['森の部屋/森の部屋_export_unity.zip'])['map.json']);
  await assert.rejects(create({...options,buildExport:async()=>({...compact,sourceState:'different'})}),/一致/);
  assert.equal(safeName('../CON.'), '.._CON'); assert.equal(safeName('CON'), 'map_CON');
  assert.equal(safeName('..'), 'map_');
  console.log('PASS: 原稿一致、日本語ZIP、編集中断、不一致拒否、失敗伝播、ファイル名');
})().catch(e => { console.error(e); process.exitCode = 1; });
