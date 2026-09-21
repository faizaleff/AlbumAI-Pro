"""Download pinned comparison candidates; no user image access."""
import argparse
import hashlib
import json
from pathlib import Path
from huggingface_hub import HfApi, snapshot_download

ROOT = Path(__file__).resolve().parents[2] / 'local-ai' / 'comparison'
CANDIDATES = {
    'siglip2': 'google/siglip2-so400m-patch16-384',
    'qwen': 'mlx-community/Qwen3-VL-4B-Instruct-4bit',
}

def main(only=None):
    ROOT.mkdir(parents=True, exist_ok=True)
    api = HfApi()
    for name, repo in CANDIDATES.items():
        if only and name != only: continue
        lock_path = ROOT / f'{name}-lock.json'
        revision = json.loads(lock_path.read_text())['revision'] if lock_path.exists() else api.model_info(repo).sha
        metadata = api.model_info(repo, revision=revision, files_metadata=True)
        expected = {item.rfilename:item.lfs.sha256 for item in metadata.siblings if item.lfs}
        # Save resolved immutable revision before downloading, for repeatability.
        lock = {'model':repo, 'revision':revision, 'license':'Apache-2.0', 'files':{}}
        lock_path.write_text(json.dumps(lock, indent=2))
        snapshot_download(repo, revision=revision, local_dir=ROOT / name,
                          allow_patterns=['*.json', '*.safetensors', '*.model', '*.txt', '*.jinja', 'README.md'])
        for path in sorted((ROOT / name).glob('*')):
            if path.is_file():
                digest = hashlib.sha256()
                with path.open('rb') as file:
                    for block in iter(lambda:file.read(1024*1024), b''): digest.update(block)
                if path.name in expected and digest.hexdigest() != expected[path.name]:
                    raise ValueError(f'Model checksum mismatch: {path.name}')
                lock['files'][path.name] = {'bytes':path.stat().st_size, 'sha256':digest.hexdigest()}
        lock_path.write_text(json.dumps(lock, indent=2))
        print(f'{name}: downloaded and verified {revision}', flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', choices=list(CANDIDATES))
    main(parser.parse_args().only)
