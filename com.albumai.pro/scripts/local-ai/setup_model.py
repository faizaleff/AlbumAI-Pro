"""One-time model download. Never reads any user photographs."""
import hashlib
import json
from pathlib import Path
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[2] / 'local-ai'
MODEL_ID = 'google/siglip-base-patch16-224'
if __name__ == '__main__':
    ROOT.mkdir(exist_ok=True)
    revision = '7fd15f0689c79d79e38b1c2e2e2370a7bf2761ed'
    snapshot_download(MODEL_ID, revision=revision, local_dir=ROOT / 'model',
                      allow_patterns=['*.json', '*.safetensors', '*.model', 'README.md'])
    files = {}
    for path in sorted((ROOT / 'model').glob('*')):
        if path.is_file():
            digest = hashlib.sha256()
            with path.open('rb') as source:
                for block in iter(lambda: source.read(1024 * 1024), b''):
                    digest.update(block)
            files[path.name] = {'bytes':path.stat().st_size, 'sha256':digest.hexdigest()}
    (ROOT / 'model-lock.json').write_text(json.dumps({'model':MODEL_ID, 'revision':revision,
        'license':'Apache-2.0', 'files':files}, indent=2))
    print(f'Local model downloaded and checksummed: {revision}', flush=True)
