"""実エディタの前後画像を軽量JPEGへまとめる。参照写真は含めない。"""
import argparse, json
from pathlib import Path
from PIL import Image

args = argparse.ArgumentParser()
args.add_argument('before', type=Path)
args.add_argument('after', type=Path)
a = args.parse_args()
repo = Path(__file__).resolve().parents[2]
dest = repo/'tests/natural-broadleaf'
dest.mkdir(exist_ok=True)
report = json.loads((a.after/'source-validation.json').read_text(encoding='utf8'))
names = {x['id']:x['name'] for x in json.loads((a.after/'root-source.json').read_text(encoding='utf8'))}
ids = ['oak','nara','zelkova','maple','cherry','islandash','olive','eucalyptus','birch','willow','rowan','hazel','elftree','worldtree']
def jpeg(source, target):
    with Image.open(source) as im:
        im = im.convert('RGB')
        im.thumbnail((900,684))
        im.save(target, quality=79, optimize=True)
for id in ids:
    for view in ['side','walk','top','wood']:
        for label, source in [('before',a.before),('after',a.after)]:
            jpeg(source/f'{id}-{view}.png',dest/f'{id}-{view}-{label}.jpg')
for density in ['normal','dense']:
    for view in ['walk','top']:
        for label in ['before','after']:
            jpeg(a.after/f'{label}-forest-{density}-{view}.png',dest/f'forest-{density}-{view}-{label}.jpg')
stats = {r['id']:{'name':names[r['id']], 'before':r['beforeTriangles'], 'after':r['triangles']} for r in report['targets']}
page = '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>広葉樹の枝と葉の分布・変更前後</title>
<style>body{margin:0;padding:20px;background:#192023;color:#eee;font:16px/1.6 sans-serif}main{max-width:1500px;margin:auto}a{color:#b9d7a4}select{padding:5px;margin:4px}figure{margin:0}img{display:block;width:100%;height:auto}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figcaption{padding:4px 0}small{color:#c0c9cd}@media(max-width:700px){.pair{grid-template-columns:1fr}body{padding:10px}}</style>
<main><h1>広葉樹の枝と葉の分布</h1>
<p>変更前は9ee71c2の樹木。地面と主人公は両方ともed9f711の状態です。実エディタで同じカメラ・光・縮尺を使った比較です。骨格表示では診断のため葉を取り除いています。</p>
<label>対象<select id="tree"></select></label><label>視点<select id="view"><option value="top">真上90度</option><option value="walk">歩行の補助視点</option><option value="side">真横</option><option value="wood">枝骨格のみ</option></select></label>
<p id="count"></p><div class="pair"><figure><figcaption>変更前</figcaption><img id="before" alt="変更前の樹木"></figure><figure><figcaption>変更後</figcaption><img id="after" alt="変更後の樹木"></figure></div>
<p><a id="live" href="root_reference_view.html">実エディタで樹木を確認</a> ・ <a href="tree_view.html">木の一覧と風</a> ・ <a href="../index.html?v=natural-crowns2#size=64">マップエディタ</a></p>
<h2>林の比較</h2><p>6種類を同数ずつ置いた計測用の配置です。通常144本、高密度576本。並びは負荷を比較するために固定しています。</p>
<select id="density"><option value="normal">144本</option><option value="dense">576本</option></select><select id="forestview"><option value="walk">歩行の補助視点</option><option value="top">真上</option></select>
<div class="pair"><figure><figcaption>変更前</figcaption><img id="forestbefore" loading="lazy" alt="変更前の林"></figure><figure><figcaption>変更後</figcaption><img id="forestafter" loading="lazy" alt="変更後の林"></figure></div>
<h2>範囲と制限</h2><p>枝を一律に上向きにする制約を外し、主枝・側枝・細枝の役割と葉の位置を改めました。木を全て下向きの枝に置き換える変更ではありません。根・幹の形、既存ID、設置寸法、画像、丸い茂みは維持しています。</p>
<p>実写をそのまま再現した資産ではなく、既存寸法内のゲーム用表現です。樹種・樹齢・環境による差があり、ユーカリなど厳密な種が未指定のものも含みます。小縮尺の枝下、急斜面、近接時の葉面の見え方には制限があります。スマホ実機の性能は未測定です。</p>
<p><a href="../docs/NATURAL_BROADLEAF.md">診断・参照資料・負荷と検証の記録</a></p><small>比較画像はこのエディタの描画です。資料写真や透かしを素材へ転用していません。</small>
</main><script>
const data=DATA,byId=id=>document.getElementById(id);
for(const id of IDS)byId('tree').add(new Option(data[id].name,id));
function update(){const id=byId('tree').value,view=byId('view').value,r=data[id];for(const label of ['before','after'])byId(label).src='natural-broadleaf/'+id+'-'+view+'-'+label+'.jpg';byId('count').textContent=r.name+'：'+r.before.toLocaleString()+' → '+r.after.toLocaleString()+' 三角形（各1材質、画像増分なし）';byId('live').href='root_reference_view.html?id='+id+'&view='+view;}
function forest(){for(const label of ['before','after'])byId('forest'+label).src='natural-broadleaf/forest-'+byId('density').value+'-'+byId('forestview').value+'-'+label+'.jpg';}
for(const id of ['tree','view'])byId(id).onchange=update;for(const id of ['density','forestview'])byId(id).onchange=forest;update();forest();
</script></html>'''
page=page.replace('DATA',json.dumps(stats,ensure_ascii=False)).replace('IDS',json.dumps(ids))
(repo/'tests/natural_broadleaf_compare.html').write_text(page,encoding='utf8')
print(json.dumps({'images':len(list(dest.glob('*.jpg'))),'bytes':sum(p.stat().st_size for p in dest.glob('*.jpg'))}))
