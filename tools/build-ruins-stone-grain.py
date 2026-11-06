"""Restore the reviewed generated grain exactly. Local files only; no network."""
from pathlib import Path
import argparse,base64,hashlib,json,re
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);args=ap.parse_args()
folder=args.root/'art-source/ruins';target=args.root/'ruins-surface.js'
record=json.loads((folder/'limestone-grain-provenance.json').read_text(encoding='utf-8'))
sample=(folder/'limestone-grain-256.bin').read_bytes()
assert len(sample)==256*256*8
assert hashlib.sha256(sample).hexdigest()==record['embeddedSampleSha256']
code=target.read_text(encoding='utf8');code,n=re.subn(r'const ROCK64=[^;]+;',lambda _: 'const ROCK64='+json.dumps(base64.b64encode(sample).decode())+';',code,count=1);assert n==1
target.write_bytes(code.encode('utf8'))
print(json.dumps({'sampleSha256':hashlib.sha256(sample).hexdigest(),'sampleBytes':len(sample),'network':False}))
