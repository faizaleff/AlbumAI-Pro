# Local Auto Events

Auto Events uses image content, not time gaps. SigLIP provides scene embeddings
and matches a fixed set of wedding-scene descriptions. Scene similarity splits
visually different settings within the same label. Suggested names are editable;
uncertain and unreadable photos remain in existing events. Only Apply moves
approved groups, via the existing project save and Undo path. Existing source
images, event names, origin memberships and unrelated assignments are preserved.

## This computer

Python 3.12 runtime and dependencies are installed in `local-ai/.venv`.
The model is installed in `local-ai/model`; weights and dependencies are ignored
by Git and are not bundled into the Photoshop plugin. The model is approximately
778 MB; the isolated runtime is approximately 701 MB.

Start `scripts/local-ai/start.command` before using Auto Events. Leave its process
running; Ctrl+C stops it. No login item, scheduled task or network listener is
installed. The single-worker lock prevents duplicate workers after restart.
The helper currently targets macOS (file locking uses fcntl).

In Library → Events → Auto Events, connect once to `local-ai/connection` and
click Analyze photos. The connection is remembered in Photoshop's plugin data.
The current computer was connected through the native folder picker.

## Privacy and operation

Setup downloads dependencies and model weights. Runtime inference is offline
(Hugging Face offline and telemetry-disable flags enabled). No cloud endpoint,
API key, network permission or face-identity classification is used. Photoshop
stages one local photo copy at a time in a private connection folder, writes an
atomic request and reads the local response. The copy is deleted after each
request; abandoned copies/responses expire after three minutes while the helper
is running. Originals are never edited. No source-folder access is required by
the helper. Temporary copies can remain after a force-quit until next startup.

Progress counts completed photos. Cancel stops further requests and cleans the
current request/copy. A stopped helper or timeout is an error, not a successful
empty result. Unsupported image formats remain for review. A changed library or
changed photo metadata invalidates applying an old proposal. Event capacity is
checked before saving to avoid truncation.

## Model provenance and limits

[Google SigLIP base patch16 224](https://huggingface.co/google/siglip-base-patch16-224)
revision `7fd15f0689c79d79e38b1c2e2e2370a7bf2761ed`, Apache-2.0 as declared by the
model repository. Its purpose includes image/text matching and zero-shot image
classification. Downloaded files, byte counts and SHA-256 digests are recorded in
`local-ai/model-lock.json`. Dependency versions are recorded in
`scripts/local-ai/requirements-lock.txt`.

The model is general-purpose, not a wedding-ritual specialist. Matching thresholds
are conservative heuristics, not calibrated probabilities. No confidence
percentages are presented to users. This implementation requires review before
applying and does not claim a measured accuracy across wedding traditions.
Specific ceremony naming and commercial release acceptance need a representative
labelled evaluation set; this is not release approval or model redistribution.

## Reproducible setup on another development machine

From the plugin directory, with Python 3.12 installed:

```sh
python3.12 -m venv local-ai/.venv
local-ai/.venv/bin/python -m pip install -r scripts/local-ai/requirements-lock.txt
local-ai/.venv/bin/python scripts/local-ai/setup_model.py
scripts/local-ai/start.command
```

Setup is the only online step. `setup_model.py` pins the model revision and never
reads photos. UXP file copying/renaming follows the documented
[Entry API](https://developer.adobe.com/photoshop/uxp/2022/uxp/reference-js/Modules/uxp/Persistent%20File%20Storage/Entry/).
