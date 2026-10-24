import importlib.util,json,tempfile,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from map_assets import *
spec=importlib.util.spec_from_file_location('receive',Path(__file__).resolve().parents[1]/'tools/receive-room.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

def legacy(room):
    source={'format':'map-editor-proto','version':2,'roomId':room}
    meta={'format':'tdj-map-export','schemaVersion':3,'roomId':room,'ports':[{'id':'east'}]}
    files={'map.json':encode(source),'meta.json':encode(meta),'validation.json':encode({'errors':[],'warnings':[]}),
           'shared_props.json':encode({'model':[1,2,3]}),'pine_wind.json':b'{}','shared_ground.json':b'{}',
           'small_props.json':encode({'version':1,'units':'metres','axes':'Unity X/Y/Z','atlas':{},'assets':[],
                                    'instances':[{'instanceId':room}],'grounded':{'assets':[],'instances':[]}})}
    listing=[{'name':n,'bytes':len(b),'sha256':sha(b)} for n,b in files.items()]
    files['manifest.json']=encode({'format':'tdj-map-export-manifest','schemaVersion':3,'exporterVersion':'test','roomId':room,'files':listing,
      'contentHash':sha('\n'.join(['test']+[f"{f['name']} {f['sha256']}" for f in listing]).encode())})
    return files

class Intake(unittest.TestCase):
    def test_shared_and_legacy(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);dest=root/'intake';dest.mkdir()
            for id in ['a','b']:
                room=root/id;room.mkdir();old=legacy(id);(room/(id+'.json')).write_bytes(old['map.json'])
                local,shared,ref=lightweight(old);z=root/('tdj-shared-'+ref['bundleHash']+'.zip')
                if not z.exists():write_zip(z,shared)
                write_zip(room/(id+'.zip'),local);out=r.receive(room,dest/id)
                self.assertEqual(out['status'],'source_ready')
                self.assertFalse((dest/id/'export/shared_props.json').exists())
                self.assertEqual(json.loads(reconstruct(local,shared)['small_props.json']),json.loads(old['small_props.json']))
            self.assertEqual(len(list((dest/'_shared').iterdir())),1)
            with self.assertRaisesRegex(ValueError,'既存'):r.receive(root/'a',dest/'a')
            oldfolder=root/'old';oldfolder.mkdir();old=legacy('old');(oldfolder/'map.json').write_bytes(old['map.json']);write_zip(oldfolder/'old.zip',old)
            self.assertEqual(r.receive(oldfolder)['status'],'source_ready')
            z.unlink()
            with self.assertRaisesRegex(ValueError,'必要な共通'):r.receive(root/'a')
            shared['shared_props.json']=b'corrupt';write_zip(z,shared)
            with self.assertRaisesRegex(ValueError,'変更'):r.receive(root/'a')

    def test_zip_paths_and_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'bad.zip';write_zip(p,{'../bad':b'bad'})
            with self.assertRaises(ValueError):checked_zip(p)
        d=legacy('a');d['map.json']+=b' '
        with self.assertRaises(ValueError):check_export(d)
        d=legacy('a');local,shared,ref=lightweight(d);ref['bundleHash']='../bad'
        with self.assertRaises(ValueError):check_reference(ref)

if __name__=='__main__':unittest.main()
