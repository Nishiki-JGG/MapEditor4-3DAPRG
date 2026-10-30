"""新版の原稿分離、取り込み、混在/欠損/改変の拒否。合成データのみ。"""
import sys, io, json, zipfile, tempfile, unittest, importlib.util
from pathlib import Path
ROOT=Path(sys.argv.pop(1)) if len(sys.argv)>1 and not sys.argv[1].startswith('-') else Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from map_assets import encode,sha,check_export,write_zip
spec=importlib.util.spec_from_file_location('receiver',ROOT/'tools/receive-room.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
def archive():
    raw=b'TDPS\x02\x00\x00\x00fixture'
    manifest={'format':'map-editor-archive','version':1,'file':'map.tdps','requiredFeatures':['affine-delta-v1','completed-state-v1'],'roomId':'test','bytes':len(raw),'sha256':sha(raw)}
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json',encode(manifest));z.writestr('map.tdps',raw)
    return out.getvalue()
def pack(source):
    files={'source_ref.json':encode({'format':'map-editor-source-reference','version':1,'roomId':'test','file':'map.map','bytes':len(source),'sha256':sha(source)}),
    'meta.json':encode({'format':'tdj-map-export','schemaVersion':3,'roomId':'test','ports':[{'id':'north'}]}),'validation.json':encode({'errors':[],'warnings':[]})}
    listing=[{'name':n,'bytes':len(b),'sha256':sha(b)} for n,b in files.items()]
    files['manifest.json']=encode({'format':'tdj-map-export-manifest','schemaVersion':5,'requiredFeatures':['separateAuthoringV1'],'exporterVersion':'test','roomId':'test','files':listing,'contentHash':sha('\n'.join(['test']+[f"{f['name']} {f['sha256']}" for f in listing]).encode())})
    return files
class Intake(unittest.TestCase):
    def test_archive_separate(self):
        source=archive();data=pack(source);self.assertEqual(check_export(data)['schemaVersion'],5)
        with tempfile.TemporaryDirectory() as td:
            parent=Path(td);folder=parent/'room';folder.mkdir();(folder/'map.map').write_bytes(source);write_zip(folder/'map_export_unity.zip',data)
            output=parent/'intake';report=r.receive(folder,output)
            self.assertEqual(report['roomId'],'test');self.assertEqual((output/'source.map').read_bytes(),source)
            self.assertFalse((output/'export/map.map').exists());self.assertFalse((output/'export/map.json').exists())
            (folder/'map.map').write_bytes(source+b'changed')
            with self.assertRaisesRegex(ValueError,'異なり'):r.receive(folder)
            (folder/'map.map').write_bytes(source);(folder/'map.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'1個'):r.receive(folder)
    def test_feature_fail_closed(self):
        data=pack(archive());m=json.loads(data['manifest.json']);m['requiredFeatures'].append('future');data['manifest.json']=encode(m)
        with self.assertRaisesRegex(ValueError,'必須機能'):check_export(data)
        data=pack(archive());data['map.json']=b'{}'
        with self.assertRaisesRegex(ValueError,'分離'):check_export(data)
if __name__=='__main__':unittest.main()
