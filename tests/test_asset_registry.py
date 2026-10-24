import unittest,tempfile,json,sys,importlib.util
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from map_assets import *
from asset_registry import *
spec=importlib.util.spec_from_file_location('receive',Path(__file__).resolve().parents[1]/'tools/receive-room.py');receive=importlib.util.module_from_spec(spec);spec.loader.exec_module(receive)

class Registry(unittest.TestCase):
 def test_new_model_new_texture_old_rooms_and_missing(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)
   lib={'assets':[{'id':'rock','positions':[0,1,2]},{'id':'tree','positions':[2,3,4]}],'textures':[{'id':'rock-tx','png':'abc'}]}
   original=encode(lib);a={'shared_props.json':original};ra=descriptor(a);install(p,ra,a)
   before=set((p/'_shared/objects').iterdir());self.assertEqual(len(before),3)
   # A new map with the same library uses it without carrying another ZIP.
   found,assets=resolve_shared({'shared_assets.json':encode(ra)},p,installed_parent=p)
   self.assertEqual(assets,a);install(p,ra,a);self.assertEqual(set((p/'_shared/objects').iterdir()),before)
   lib['assets'].append({'id':'new-tree','positions':[1,3,5]});lib['textures'].append({'id':'new-tx','png':'def'})
   b={'shared_props.json':encode(lib)};rb=descriptor(b);install(p,rb,b)
   self.assertEqual(len(set((p/'_shared/objects').iterdir())-before),2)
   self.assertEqual(read_set(p/'_shared',ra),a)
   before=set((p/'_shared/objects').iterdir());lib['assets'][0]['positions'][0]=0.25
   c={'shared_props.json':encode(lib)};rc=descriptor(c);install(p,rc,c)
   self.assertEqual(len(set((p/'_shared/objects').iterdir())-before),1)
   self.assertEqual(read_set(p/'_shared',rb),b);self.assertEqual(read_set(p/'_shared',ra),a)
   recipe,_=make_recipe('shared_props.json',original);h=next(x['sha256'] for x in recipe['parts'] if 'sha256'in x)
   (p/'_shared/objects'/(h+'.json')).write_bytes(b'corrupt')
   with self.assertRaisesRegex(ValueError,'改変'):read_set(p/'_shared',ra)
 def test_preserve_whitespace_unicode_and_reject_paths(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);data=b'{ "assets" : [ {"id":"a", "note":"brace } quote \\\""} ], "extra": {"n":1} }'
   assets={'shared_props.json':data};ref=descriptor(assets);install(p,ref,assets)
   self.assertEqual(read_set(p/'_shared',ref),assets)
   path=p/'_shared'/ref['bundleHash']/'shared_props.json.recipe.json';r=json.loads(path.read_bytes())
   next(x for x in r['parts'] if 'sha256'in x)['sha256']='../../escape'
   path.write_bytes(encode(r))
   with self.assertRaisesRegex(ValueError,'素材ID'):read_set(p/'_shared',ref)

if __name__=='__main__':unittest.main()
