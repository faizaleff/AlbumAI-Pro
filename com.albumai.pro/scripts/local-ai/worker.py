"""Offline scene inference. File bridge only; no listening network port."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import argparse
import hashlib
import json
import re
import signal
import time
from pathlib import Path

PROTOCOL = 'albumai-local-events-v1'
ROOT = Path(__file__).resolve().parents[2] / 'local-ai'
# Event activities/settings only. No face identity or demographic classification.
PROMPTS = {
    'Getting Ready': ['a wedding photo of bridal makeup and hair preparation', 'a wedding photo of a bride or groom getting dressed before the ceremony'],
    'Ceremony': ['a wedding ceremony in progress with a priest officiating rituals while the couple participates', 'a close-up photograph of hands exchanging wedding rings during the marriage ceremony'],
    'Couple Portraits': ['a posed wedding portrait of a bride and groom embracing and looking at each other in wedding clothing', 'a bride and groom posing together outdoors for wedding portraits'],
    'Individual Portraits': ['a close-up bridal portrait showing a bride wearing wedding jewellery', 'a posed wedding portrait of a groom alone'],
    'Family & Guests': ['a posed wedding group photograph of family and guests'],
    'Reception': ['a wedding reception with guests celebrating at a decorated stage or banquet'],
    'Dance & Celebration': ['a wedding party with people dancing and celebrating'],
    'Details & Venue': ['a photograph of wedding decorations flowers jewellery clothing or venue without people'],
    'Other': ['a photograph unrelated to a wedding', 'an unclear scene or a collage of multiple photographs'],
}


def atomic_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, allow_nan=False))
    temporary.replace(path)


def validate_request(value, allowed_folder=None):
    if value.get('protocol') != PROTOCOL:
        raise ValueError('Unsupported local model request')
    path = Path(value.get('path', ''))
    if not path.is_absolute() or path.suffix.lower() not in {'.jpg','.jpeg','.png','.webp','.tif','.tiff','.bmp'}:
        raise ValueError('This image format needs review')
    if allowed_folder is not None and (path.resolve().parent != allowed_folder.resolve() or not path.name.startswith("image-")):
        raise ValueError("Photo must be staged in the local connection folder")
    if not path.is_file():
        raise ValueError('Photo is unavailable')
    return path


class SceneModel:
    def __init__(self):
        import torch
        from transformers import AutoModel, AutoProcessor
        self.torch = torch
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        self.model = AutoModel.from_pretrained(ROOT / 'model', local_files_only=True,
                                               use_safetensors=True).eval()
        self.processor = AutoProcessor.from_pretrained(ROOT / 'model', local_files_only=True, use_fast=False)
        self.labels = list(PROMPTS)
        texts = [text for label in self.labels for text in PROMPTS[label]]
        self.text_counts = [len(PROMPTS[label]) for label in self.labels]
        inputs = self.processor(text=texts, padding='max_length', return_tensors='pt')
        with torch.inference_mode():
            self.text = self.model.get_text_features(**inputs)
            self.text = self.text / self.text.norm(dim=-1, keepdim=True)
        self.revision = json.loads((ROOT / 'model-lock.json').read_text())['revision']

    def analyze(self, path):
        from PIL import Image, ImageOps
        torch = self.torch
        before = path.stat()
        with Image.open(path) as raw:
            raw.draft('RGB', (512,512))
            image = ImageOps.exif_transpose(raw).convert('RGB')
            image.thumbnail((512,512))
            inputs = self.processor(images=image, return_tensors='pt')
        with torch.inference_mode():
            vector = self.model.get_image_features(**inputs)
            vector = vector / vector.norm(dim=-1, keepdim=True)
            logits = (vector @ self.text.T)[0] * self.model.logit_scale.exp() + self.model.logit_bias
            # Match alternative descriptions for each category; thresholds are review
            # heuristics, never presented as calibrated probabilities.
            scores, start = [], 0
            for count in self.text_counts:
                scores.append(float(logits[start:start+count].max()))
                start += count
            ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
            first, second = ranked[:2]
            margin = scores[first] - scores[second]
            label = self.labels[first]
            certain = label != 'Other' and margin >= 1.0 and scores[first] >= -5.0
            after = path.stat()
            if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
                raise ValueError('Photo changed during analysis')
            return {'status':'complete', 'embedding':vector[0].tolist(),
                    'label':label if certain else '', 'requiresReview':not certain,
                    'scoreKind':'uncalibrated-scene-match', 'matchMargin':margin,
                    'bestMatch':label, 'matchScore':scores[first],
                    'modelRevision':self.revision}


def cleanup_abandoned(bridge):
    # Photoshop may remove a completed response between glob and stat.
    for output in [*bridge.glob('response-*.json'), *bridge.glob('image-*'), *bridge.glob('pending-*.tmp')]:
        try:
            if time.time() - output.stat().st_mtime > 180:
                output.unlink(missing_ok=True)
        except FileNotFoundError:
            continue


def serve(bridge):
    bridge.mkdir(parents=True, exist_ok=True)
    os.chmod(bridge, 0o700)
    import fcntl
    lock = (bridge / 'worker.lock').open('a+')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print('Local Auto Events is already running', flush=True)
        return
    model = SceneModel()
    running = True
    def stop(*_):
        nonlocal running
        running = False
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    print('Local Auto Events model ready', flush=True)
    try:
        while running:
            atomic_json(bridge / 'ready.json', {'protocol':PROTOCOL, 'updatedAt':int(time.time()*1000),
                        'model':'SigLIP', 'revision':model.revision})
            for request in bridge.glob('request-*.json'):
                match = re.fullmatch(r'request-([a-zA-Z0-9-]{1,80})\.json', request.name)
                if not match or request.is_symlink():
                    continue
                output = bridge / f'response-{match[1]}.json'
                try:
                    if request.stat().st_size > 16384:
                        raise ValueError('Invalid request')
                    value = json.loads(request.read_text())
                    if abs(time.time()*1000 - value.get('createdAt', 0)) > 120000:
                        raise ValueError('Expired request')
                    result = model.analyze(validate_request(value, bridge))
                except Exception as error:
                    result = {'status':'failed', 'error':str(error)[:160]}
                if request.exists():
                    atomic_json(output, result)
                    request.unlink(missing_ok=True)
            # Clear abandoned responses and temporary photo copies after a crash.
            cleanup_abandoned(bridge)
            time.sleep(.15)
    finally:
        (bridge / 'ready.json').unlink(missing_ok=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--bridge', type=Path, default=ROOT / 'connection')
    args = parser.parse_args()
    serve(args.bridge)
