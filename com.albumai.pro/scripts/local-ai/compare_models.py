"""Offline, read-only experiment; never imports or writes an AlbumAI project.
Run prepare, baseline, siglip2, qwen and report in separate processes.
"""
import os
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
import argparse
import base64
import hashlib
import html
import json
import resource
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'local-ai'
RUN = ROOT / 'comparison' / 'run'
LABELS = ['Getting Ready', 'Ceremony', 'Couple Portraits', 'Individual Portraits',
          'Family & Guests', 'Reception', 'Dance & Celebration', 'Details & Venue', 'Other']

def save(name, data):
    path = RUN / name
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, indent=2, allow_nan=False))
    temp.replace(path)

def read(name): return json.loads((RUN / name).read_text())

def prepare(folder, limit):
    from PIL import Image, ImageOps
    if (RUN / 'manifest.json').exists():
        raise ValueError('This run already exists. Preserve it before preparing a new sample.')
    paths = sorted(p for p in folder.rglob('*') if p.suffix.lower() in {'.jpg','.jpeg','.png','.webp','.tif','.tiff'} and p.is_file())
    if not paths: raise ValueError('No supported photos found')
    if limit and len(paths) > limit:
        paths = [paths[round(i*(len(paths)-1)/(limit-1))] for i in range(limit)] if limit > 1 else paths[:1]
    RUN.mkdir(parents=True, exist_ok=True)
    photos = []
    for i, path in enumerate(paths):
        with Image.open(path) as raw:
            raw.draft('RGB', (1024,1024))
            image = ImageOps.exif_transpose(raw).convert('RGB')
            image.thumbnail((768,768))
            target = RUN / f'photo-{i:03}.jpg'
            image.save(target, quality=92)
        photos.append({'id':i, 'name':path.name, 'image':target.name,
                       'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    save('manifest.json', {'photos':photos, 'selection':'uniform filename-order sample',
                          'groundTruth':None, 'note':'Not an accuracy benchmark; labels need photographer review.'})

def group(evidence, threshold=.80):
    groups = []
    for item in evidence:
        if item.get('requiresReview', True) or not item.get('label'): continue
        vector = item['embedding']
        matches = [(sum(a*b for a,b in zip(vector,g['anchor'])),g) for g in groups if g['label']==item['label']]
        best = max(matches, key=lambda p:p[0]) if matches else None
        if best and best[0] >= threshold: best[1]['ids'].append(item['id'])
        else: groups.append({'id':len(groups), 'label':item['label'], 'anchor':vector, 'ids':[item['id']]})
    return [{k:v for k,v in g.items() if k!='anchor'} for g in groups]

def encoder(kind):
    import torch
    import worker
    from transformers import AutoModel, AutoProcessor
    from PIL import Image
    started = time.perf_counter()
    torch.set_num_threads(4)
    path = ROOT/'model' if kind=='baseline' else ROOT/'comparison'/'siglip2'
    model = AutoModel.from_pretrained(path, local_files_only=True, use_safetensors=True).eval()
    processor = AutoProcessor.from_pretrained(path, local_files_only=True, use_fast=False)
    texts = [text for label in worker.PROMPTS for text in worker.PROMPTS[label]]
    assert list(worker.PROMPTS) == LABELS, 'Label order changed'
    counts = [len(v) for v in worker.PROMPTS.values()]
    with torch.inference_mode():
        features = model.get_text_features(**processor(text=texts, padding='max_length', max_length=model.config.text_config.max_position_embeddings, truncation=True, return_tensors='pt'))
        features = features / features.norm(dim=-1, keepdim=True)
    loaded = time.perf_counter()
    evidence = []
    for photo in read('manifest.json')['photos']:
        start = time.perf_counter()
        with Image.open(RUN/photo['image']) as image:
            inputs = processor(images=image.convert('RGB'), return_tensors='pt')
        with torch.inference_mode():
            vector = model.get_image_features(**inputs)
            vector = vector / vector.norm(dim=-1,keepdim=True)
            logits = (vector @ features.T)[0] * model.logit_scale.exp() + model.logit_bias
        scores, offset = [], 0
        for count in counts:
            scores.append(float(logits[offset:offset+count].max())); offset += count
        ranked = sorted(range(len(scores)),key=lambda i:scores[i],reverse=True)
        first, second = ranked[:2]
        margin = scores[first]-scores[second]
        label = LABELS[first]
        accepted = label!='Other' and margin>=1 and scores[first]>=-5
        evidence.append({'id':photo['id'],'label':label if accepted else '', 'bestMatch':label,
                         'requiresReview':not accepted,'margin':margin, 'score':scores[first],
                         'embedding':vector[0].tolist(), 'seconds':time.perf_counter()-start})
        print(f'{kind} {len(evidence)} photos',flush=True)
    lock = read_lock(kind)
    save(f'{kind}.json',{'model':lock['model'],'revision':lock['revision'], 'evidence':evidence,
         'groups':group(evidence), 'loadSeconds':loaded-started,'analysisSeconds':time.perf_counter()-loaded,
         'peakProcessGB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1e9,
         'prompts':worker.PROMPTS, 'thresholds':{'margin':1,'scoreFloor':-5,'similarity':.80},
         'thresholdNote':'Same provisional thresholds for comparison, not calibrated between models.'})

def read_lock(kind):
    path = ROOT/'model-lock.json' if kind=='baseline' else ROOT/'comparison'/f'{kind}-lock.json'
    return json.loads(path.read_text())

def representatives(ids):
    return list(dict.fromkeys([ids[0],ids[len(ids)//2],ids[-1]]))

def qwen(single=False):
    from mlx_vlm import load, generate
    from mlx_vlm.prompt_utils import apply_chat_template
    from mlx_vlm.utils import load_config
    import mlx.core as mx
    path = str(ROOT/'comparison'/'qwen')
    started = time.perf_counter()
    model, processor = load(path)
    config = load_config(path)
    loaded = time.perf_counter()
    photos = {p['id']:p for p in read('manifest.json')['photos']}
    groups = [] if single else list(read('siglip2.json')['groups'])
    output_name = 'qwen-single' if single else 'qwen'
    assigned = {i for g in groups for i in g['ids']}
    # Also inspect unassigned photos; keep them separate, never silently merge.
    for i in photos:
        if i not in assigned: groups.append({'id':len(groups), 'ids':[i], 'label':'Needs review'})
    results = []
    for g in groups:
        ids = representatives(g['ids'])
        prompt = ('These are representative photos from one proposed album group. Judge only visible content, '
                  'not filenames or assumed wedding traditions. Choose a broad label from: '+', '.join(LABELS)+'. '
                  'Return only JSON with keys label, coherent (boolean), needs_review (boolean), reason (one short sentence). '
                  'Use Other and needs_review true if uncertain. Do not invent a specific ritual. '
                  'coherent is false if the pictures show different activities/settings. No markdown.')
        formatted = apply_chat_template(processor, config, prompt, num_images=len(ids))
        start = time.perf_counter()
        output = generate(model, processor, formatted, [str(RUN/photos[i]['image']) for i in ids],
                          max_tokens=160, temperature=0.0, verbose=False)
        raw = output.text if hasattr(output,'text') else str(output)
        try:
            value = json.loads(raw[raw.index('{'):raw.rindex('}')+1])
            if value.get('label') not in LABELS or type(value.get('coherent')) is not bool or type(value.get('needs_review')) is not bool:
                raise ValueError('Invalid model response')
        except (ValueError,TypeError):
            value = {'label':'Other','coherent':False,'needs_review':True,'reason':'Invalid structured response'}
        results.append({'groupId':g['id'],'photoIds':g['ids'],'sampleIds':ids,'seconds':time.perf_counter()-start, 'result':value,'raw':raw})
        print(f'qwen group {len(results)}/{len(groups)}: {value}',flush=True)
        save(f'{output_name}-partial.json',results)
    lock=read_lock('qwen')
    save(f'{output_name}.json',{'model':lock['model'],'revision':lock['revision'],'results':results,
                    'prompt':prompt, 'loadSeconds':loaded-started,'analysisSeconds':time.perf_counter()-loaded,
                    'peakProcessGB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1e9,
                    'peakMetalGB':mx.get_peak_memory()/1e9,
                    'note':'Representative-only naming/coherence check. Does not repair or validate every group member.'})

def report():
    baseline, google, hybrid = read('baseline.json'),read('siglip2.json'),read('qwen.json')
    single = read('qwen-single.json')
    def esc(value): return html.escape(str(value))
    h = ['<!doctype html><meta charset="utf-8"><title>AlbumAI local model comparison</title>',
         '<style>body{background:#101820;color:#e6edf5;font:16px system-ui;margin:32px}table{border-collapse:collapse;width:100%}td,th{padding:12px;border-bottom:1px solid #354350;text-align:left}img{width:150px;height:150px;object-fit:contain}small{color:#afbfcd}</style>',
         '<h1>Local model comparison</h1><p>Preliminary experiment. No verified ground truth; these results do not measure accuracy. Existing Library Events were not changed.</p><table><tr><th>Stage</th><th>Analysis seconds</th><th>Peak process GB</th><th>Groups / review photos</th></tr>']
    for name,data in [('Current SigLIP',baseline),('Google SigLIP 2',google),('Qwen each photo',single),('Google + Qwen group review',hybrid)]:
        details = f"{len(data['groups'])} / {sum(e['requiresReview'] for e in data['evidence'])}" if 'groups' in data else f"{sum(r['result']['needs_review'] or not r['result']['coherent'] for r in data['results'])} review flags / {len(data['results'])} checks"
        h.append(f"<tr><td>{name}</td><td>{data['analysisSeconds']:.1f}</td><td>{data['peakProcessGB']:.2f}</td><td>{details}</td></tr>")
    h.append('</table>')
    if (RUN/'observations.json').exists():
        observed=read('observations.json')
        h.append('<h2>Observed limitations</h2><small>'+esc(observed['reviewer'])+'</small>')
        for note in observed['notes']: h.append('<p>'+esc(note)+'</p>')
    h.append('<p>Google stages run on CPU with the same uncalibrated thresholds; Qwen runs on Metal. Times cover inference on prepared 768px copies; model loading, original-file copying and Photoshop UI are excluded. This is not a controlled hardware speed ranking.</p><h2>Photo-by-photo suggestions</h2><table><tr><th>Photo</th><th>Current</th><th>Google</th><th>Qwen each photo</th><th>Google group + Qwen review</th></tr>')
    by_group={i:g for g in google['groups'] for i in g['ids']}
    q={i:r for r in hybrid['results'] for i in r['photoIds']}
    singles={i:r['result'] for r in single['results'] for i in r['photoIds']}
    for photo,b,g in zip(read('manifest.json')['photos'],baseline['evidence'],google['evidence']):
        image=base64.b64encode((RUN/photo['image']).read_bytes()).decode()
        grp=by_group.get(photo['id']); result=q.get(photo['id'])
        text='Needs review'
        if result:
            r=result['result']; text=f"{'Group '+str(grp['id']+1) if grp else 'Unassigned photo'}: {r['label']} — {r['reason']}"
            if r['needs_review'] or not r['coherent']: text+=' [REVIEW]'
        direct=singles[photo['id']]
        direct_text=direct['label'] + (' [REVIEW]' if direct['needs_review'] else '')
        h.append(f"<tr><td><img src='data:image/jpeg;base64,{image}'><br>{esc(photo['name'])}</td><td>{esc(b['label'] or 'Needs review')}</td><td>{esc(g['label'] or 'Needs review')}</td><td>{esc(direct_text)}</td><td>{esc(text)}</td></tr>")
    h.append('</table>')
    (RUN/'comparison.html').write_text(''.join(h))
    print(RUN/'comparison.html')

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['prepare','baseline','siglip2','qwen','qwen-single','report']);parser.add_argument('--folder',type=Path);parser.add_argument('--limit',type=int,default=24)
    args=parser.parse_args()
    if args.stage=='prepare':
        if not args.folder or args.limit<0: parser.error('prepare requires --folder and a nonnegative --limit')
        prepare(args.folder,args.limit)
    elif args.stage in ('baseline','siglip2'):encoder(args.stage)
    elif args.stage in ('qwen','qwen-single'):qwen(single=args.stage=='qwen-single')
    else:report()
