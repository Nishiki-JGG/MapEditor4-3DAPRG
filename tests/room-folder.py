import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('receiver', ROOT / 'tools/receive-room.py')
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


class RoomFolderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.folder = self.root / '森の部屋'
        self.folder.mkdir()
        with zipfile.ZipFile(ROOT / 'samples/sample_export_unity.zip') as z:
            self.files = {n: z.read(n) for n in z.namelist()}
        self.original = json.loads(self.files['map.json'])
        self.write()

    def tearDown(self):
        self.temp.cleanup()

    def write(self, rehash=False):
        if rehash:
            m = json.loads(self.files['manifest.json'])
            m['files'] = [{'name': n, 'bytes': len(b), 'sha256': receiver.sha(b)} for n, b in self.files.items() if n != 'manifest.json']
            text = '\n'.join([m['exporterVersion']] + [f"{f['name']} {f['sha256']}" for f in m['files']])
            m['contentHash'] = receiver.sha(text.encode())
            self.files['manifest.json'] = json.dumps(m).encode()
        (self.folder / '森.json').write_text(json.dumps(self.original), encoding='utf-8')
        with zipfile.ZipFile(self.folder / '森_export_unity.zip', 'w') as z:
            for n, b in self.files.items():
                z.writestr(n, b)

    def test_real_sample_and_atomic_output(self):
        output = self.root / 'intake'
        report = receiver.receive(self.folder, output)
        self.assertEqual(report['status'], 'source_ready')
        self.assertEqual(len(report['portIds']), 2)
        self.assertEqual((output / 'export/map.json').read_bytes(), self.files['map.json'])
        with self.assertRaisesRegex(ValueError, '既存'):
            receiver.receive(self.folder, output)

    def test_bookkeeping_does_not_change_authoring(self):
        self.original['revision'] = 123
        self.original['lastExportHash'] = 'old'
        self.write()
        receiver.receive(self.folder)

    def test_mismatched_edit_refused_without_output(self):
        self.original['waterLevel'] = 999
        self.write()
        output = self.root / 'intake'
        with self.assertRaisesRegex(ValueError, '編集内容'):
            receiver.receive(self.folder, output)
        self.assertFalse(output.exists())

    def test_tampered_file(self):
        self.files['meta.json'] += b' '
        self.write()
        with self.assertRaisesRegex(ValueError, '破損'):
            receiver.receive(self.folder)

    def test_unsafe_path(self):
        self.files['../outside.txt'] = b'invalid'
        self.write(True)
        with self.assertRaisesRegex(ValueError, '展開先'):
            receiver.receive(self.folder, self.root / 'intake')
        self.assertFalse((self.root / 'outside.txt').exists())

    def test_validation_error(self):
        self.files['validation.json'] = json.dumps({'errors': ['blocked'], 'warnings': []}).encode()
        self.write(True)
        with self.assertRaisesRegex(ValueError, '検証'):
            receiver.receive(self.folder)

    def test_no_exit(self):
        meta = json.loads(self.files['meta.json']); meta['ports'] = []
        self.files['meta.json'] = json.dumps(meta).encode(); self.write(True)
        with self.assertRaisesRegex(ValueError, '出入口がありません'):
            receiver.receive(self.folder)

    def test_multiple_originals(self):
        (self.folder / 'old.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, '1個'):
            receiver.receive(self.folder)


if __name__ == '__main__':
    unittest.main()
