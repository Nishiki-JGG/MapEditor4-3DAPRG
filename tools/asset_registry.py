"""凸ダンの共通素材ソース台帳。モデル・画像単位の内容IDで重複を保存しない。"""
import json
import re
from pathlib import Path
from map_assets import require, sha, encode, verify_listing, check_reference, SHARED, LIMIT

HEX = re.compile('[0-9a-f]{64}')

def make_recipe(name, data):
    s=data.decode('utf-8');json.loads(s);decoder=json.JSONDecoder();spans=[]
    def skip(i):
        while i<len(s) and s[i].isspace():i+=1
        return i
    i=skip(0)+1
    while (i:=skip(i))<len(s) and s[i]!='}':
        key,k=decoder.raw_decode(s,i);i=skip(k);require(s[i]==':','JSON key');i=skip(i+1)
        value,end=decoder.raw_decode(s,i)
        if key in ('assets','textures') and isinstance(value,list):
            j=skip(i+1);index=0
            while j<end-1:
                v,q=decoder.raw_decode(s,j);spans.append((j,q,name+'/'+key+'/'+str(v.get('id',index))));index+=1
                j=skip(q)
                if s[j]==',':j=skip(j+1)
        elif end-i>1024 or isinstance(value,dict):spans.append((i,end,name+'/'+key))
        i=skip(end)
        if i<len(s) and s[i]==',':i+=1
    parts=[];objects={};pos=0
    for a,b,id in spans:
        if a>pos:parts.append({'text':s[pos:a]})
        raw=s[a:b].encode();h=sha(raw);objects[h]=raw;parts.append({'sha256':h,'bytes':len(raw),'id':id});pos=b
    if pos<len(s):parts.append({'text':s[pos:]})
    return {'format':'tdj-source-recipe','schemaVersion':1,'name':name,'sha256':sha(data),'bytes':len(data),'parts':parts},objects

def regular(path):
    require(path.is_file() and not path.is_symlink(), '素材ファイルが無いかリンクです: '+str(path))
    require(path.stat().st_size<=LIMIT, '素材が大きすぎます')
    return path.read_bytes()

def materialize(base, recipe, expected):
    require(recipe.get('format')=='tdj-source-recipe' and recipe.get('schemaVersion')==1,'素材レシピ形式')
    require(all(recipe.get(k)==expected.get(k) for k in ('name','bytes','sha256')), '素材レシピの参照不一致')
    parts=recipe.get('parts');require(isinstance(parts,list) and len(parts)<=8192,'素材分割数')
    result=bytearray()
    for p in parts:
        if 'text' in p:
            require(isinstance(p['text'],str) and 'sha256' not in p,'素材断片が不正');data=p['text'].encode()
        else:
            h=p.get('sha256');require(isinstance(h,str) and HEX.fullmatch(h),'素材IDが不正')
            data=regular(base/'objects'/(h+'.json'));require(len(data)==p['bytes'] and sha(data)==h,'素材の改変: '+h)
        result.extend(data);require(len(result)<=expected['bytes']<=LIMIT,'素材の長さ不一致')
    data=bytes(result);require(len(data)==expected['bytes'] and sha(data)==expected['sha256'],'素材の復元不一致')
    return data

def read_set(base,ref):
    base=Path(base);require(not base.is_symlink(),'共通保存先のリンク')
    target=base/ref['bundleHash'];require(not target.is_symlink(),'共通版のリンク')
    require(json.loads(regular(target/'shared_assets.json'))==ref,'共通参照が違います')
    result={}
    for f in ref['files']:
        old=target/f['name'];rp=target/(f['name']+'.recipe.json')
        require(not(old.exists() and rp.exists()),'旧素材とレシピが競合')
        result[f['name']]=regular(old) if old.exists() else materialize(base,json.loads(regular(rp)),f)
    verify_listing(result,ref['files']);return result

def put(path,data):
    if path.exists():
        require(regular(path)==data,'保存済み素材が異なります: '+str(path));return False
    # A short-lived sibling is never a valid registry entry, even if writing is interrupted.
    import tempfile,os
    fd,temp=tempfile.mkstemp(prefix='.asset-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as out:out.write(data)
        if path.exists():require(regular(path)==data,'同時保存で不一致');return False
        os.rename(temp,path);return True
    finally:
        if os.path.exists(temp):os.unlink(temp)

def install(parent,ref,assets):
    check_reference(ref);verify_listing(assets,ref['files'])
    base=Path(parent)/'_shared';base.mkdir(exist_ok=True);require(not base.is_symlink(),'共通保存先のリンク')
    target=base/ref['bundleHash']
    if (target/'shared_assets.json').exists():read_set(base,ref);return target
    objects=base/'objects';objects.mkdir(exist_ok=True);require(not objects.is_symlink(),'素材保存先のリンク')
    target.mkdir(exist_ok=True);require(not target.is_symlink(),'共通版のリンク')
    for n,b in assets.items():
        recipe,items=make_recipe(n,b)
        for h,data in items.items():put(objects/(h+'.json'),data)
        put(target/(n+'.recipe.json'),encode(recipe))
    put(target/'shared_assets.json',encode(ref));read_set(base,ref)
    return target
