(function (root) {
  'use strict';
  function safeName(value) {
    let name = String(value || 'map').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80).replace(/[. ]+$/, '');
    if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = 'map_' + name;
    return name;
  }
  function authoringState(map) {
    const { revision, lastExportHash, completedState, ...content } = map;
    return JSON.stringify(content);
  }
  async function create({ name, snapshot, buildExport, makeZip }) {
    const before = authoringState(snapshot());
    const result = await buildExport();
    if (before !== authoringState(snapshot())) throw Error('書き出し中に地図が変更されました。編集を止めて、もう一度保存してください。');
    const map = result.files.find(f => f.name === 'map.json');
    if (result.authoring ? result.sourceState !== before : !map || authoringState(JSON.parse(map.data)) !== before) throw Error('原稿と書き出しが一致しません。もう一度保存してください。');
    const base = safeName(name), folder = base + '/';
    const zip = await (await makeZip(result.files)).arrayBuffer();
    const sharedNote = result.sharedName ? '共通資産: '+result.sharedName+'\n同じ版は全ての部屋で1個だけ保管してください。エディタの「詳細な書き出し」→「共通素材（ZIP）」から入手できます。\n\n' : '';
    const note = sharedNote + 'ゲーム用の部屋セット\n\nこのフォルダのJSONとUnity用ZIPを一緒に保管してください。\nJSONはエディタで再編集する原稿です。ZIPは同じ原稿から書き出したUnity用データです。\n再編集後は「詳細な書き出し」→「編集データ＋Unityデータ（ZIP）」で両方を書き出し直してください。\nゲームへの取り込みを依頼する際は、このフォルダを指定してください。\n\n' +
      (result.validation.errors.length ? '検証エラーがあります。本体への取り込み前にエディタで修正が必要です。\n' : 'エディタ検証にエラーはありません。本体の素材対応と実プレイ確認は別途必要です。\n');
    return { name: base + '_room.zip', validation: result.validation, blob: await makeZip([
      { name: folder + (result.authoring?'map.map':base+'.json'), data: result.authoring?.data||map.data },
      { name: folder + base + '_export_unity.zip', data: new Uint8Array(zip) },
      { name: folder + '保存について.txt', data: result.authoring?note.replaceAll('JSON','編集用MAP（.map）'):note }
    ]) };
  }
  const api = { create, safeName, authoringState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TDMapPackage = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
