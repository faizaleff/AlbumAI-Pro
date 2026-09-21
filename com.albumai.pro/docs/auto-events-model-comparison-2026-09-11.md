# Local model comparison experiment

Approved scope: compare current SigLIP with Google SigLIP 2 and a Google/Qwen
combination before choosing a production replacement. No changes to Library
memberships, version, packaging or production model selection.

Hardware: Apple M4 MacBook Air, 16 GB unified memory. The experiment uses CPU
for the two encoders and Metal for quantized Qwen, in separate processes. Thus
speed numbers measure inference on prepared copies, not controlled model speed
or end-to-end Photoshop performance. Photo preparation, original-file bridge
copying and UI time are excluded; model load time is recorded separately.

Candidates:
- Current google/siglip-base-patch16-224.
- google/siglip2-so400m-patch16-384 (larger Google encoder).
- mlx-community/Qwen3-VL-4B-Instruct-4bit (MLX conversion of Qwen's 4B model),
  chosen instead of 8B for the first 16 GB Mac experiment.

Downloads resolve immutable revisions, preserve them for retries, and record
SHA-256/size in ignored local-ai/comparison/*-lock.json. Python/MLX dependencies
are isolated from the production helper in local-ai/.eval-venv and recorded in
scripts/local-ai/comparison-requirements-lock.txt. Inference is offline. No
remote-code loading or network server is used. The MLX GPU needs normal host
access; sandboxed Metal access fails on this machine.

Input: 24 evenly spaced photos in filename order from the user's 72-photo copy
in Documents/AlbumAI Comparison. Originals are read-only; reduced 768px JPEGs,
checksums and all results stay in ignored local-ai/comparison/run. Downloads
access failed even outside the command sandbox due to macOS permissions; the
Documents copy is readable. Reduced evaluation photos are intentionally retained
for repeatability and the private HTML report, unlike production bridge copies.

Method:
1. Identical prompts, provisional score/margin/similarity cutoffs for both Google
   encoders. These cutoffs are NOT calibrated between model families.
2. Group by same accepted scene label and >=0.80 anchor similarity, mirroring
   the existing broad-scene grouping. This is not yet chronological event splitting.
3. Qwen reviews first/middle/last representatives of each Google group and each
   unassigned photo separately. Returns a broad label, coherence/review flags and
   a short reason. It does not silently repair memberships or merge singletons.
4. Local HTML report shows all sampled photos and results side by side. Logs
   capture model load time, analysis time and process/Metal peak memory.

No photographer-verified labels are available. The sample is dominated by bridal
and couple portraits plus a collage, with little ceremony/activity diversity.
No wedding-event accuracy percentage or full-automation readiness can be inferred.

Reproduce after model setup:

```sh
local-ai/.venv/bin/python scripts/local-ai/setup_comparison.py
local-ai/.venv/bin/python scripts/local-ai/compare_models.py prepare --folder '/path/to/sample' --limit 24
local-ai/.venv/bin/python scripts/local-ai/compare_models.py baseline
local-ai/.venv/bin/python scripts/local-ai/compare_models.py siglip2
local-ai/.eval-venv/bin/python scripts/local-ai/compare_models.py qwen-single
local-ai/.eval-venv/bin/python scripts/local-ai/compare_models.py qwen
local-ai/.venv/bin/python scripts/local-ai/compare_models.py report
```

Prepare refuses to replace an existing sample. Archive the ignored run directory
before starting another sample. Model setup is online; the evaluation is offline.

Initial baseline: 2 broad portrait groups, 9 accepted photos, 15 review photos;
1.4 seconds analysis excluding load and preparation on CPU. Not an accuracy score.

Checks: 2 comparison tests (scene separation, review exclusion, representative
selection), 3 worker regressions, production build and bundle verification pass.
The production JavaScript bundle is unchanged by this experiment: 757687 bytes,
SHA256 b436d37c00a21492fb03cac4da54c31b07f6242e3f85858e24923a79895b9355.

Download note: Google weights are 4,544,267,488 bytes; Qwen weights are
3,093,767,283 bytes. Standard transfers were slow. A temporary bounded parallel
range downloader is resuming the same pinned repositories, validating each
Content-Range and the assembled file against the repository LFS SHA-256.
It writes only ignored experiment files. Never use partial model weights.

Qwen standalone comparison was added for all 24 photos, alongside the hybrid
representative review. MLX-VLM 0.3.12 had an mx.repeat scalar compatibility
error; upgrading the isolated runtime to 0.7.0 resolved it. Torch 2.8.0 and
torchvision 0.23.0 satisfy the processor requirements. Dependency check passed.
Qwen standalone: 157.72 seconds analysis, 1.83 seconds load, 3.87 GB peak Metal
allocation and 1.42 GB peak process RSS (different memory measures; not total
computer memory). These are one-run measurements.

## Completed result — do not promote this hybrid

Both weights passed repository LFS SHA-256 verification; full file manifests are
recorded. Google revision dd658faac399427308559e2c3ac1e99cbe43845d;
Qwen MLX revision 2fd8dacbdb8f1e54b8c005f081ec5bf79c56376b.
SigLIP 2 tokenizer required explicit text-model maximum length (64) and truncation;
implicit max_length padding was undefined. The baseline's existing 64-token
padding is unchanged by the explicit setting.

| Stage | Measured inference seconds | Result on 24 photos |
| --- | ---: | --- |
| Current SigLIP | 1.4 | 9 accepted, 15 review; 2 groups |
| SigLIP 2 | 15.0 | 16 accepted, 8 review; 3 groups |
| Qwen each photo | 157.7 | 12 individual / 12 couple labels; 0 model review flags |
| Google + Qwen representative review | 15.0 + 73.7 | 11 checks; failed to flag the mixed Google group |

Visual inspection of the sample (assistant, not photographer ground truth)
found three clear couple photos classified by Google as Individual Portraits:
12.jpg, DSC02134.jpg, DSC02272.jpg (sample IDs 1, 16, 18). The large Google
individual group contains those three. Qwen checked representatives 0, 8 and 18
but still described the whole group as individual portraits and coherent. Thus
representative group review cannot be trusted to catch these errors. Qwen's
single-image classification matched the visible broad portrait categories on
this sample; that is NOT evidence of ritual/event-boundary accuracy.

Decision: retain production model and explicit review. Do not promote the tested
hybrid. A next experiment should use per-photo labels, calibrated uncertainty,
sequence/time continuity for boundaries, and a photographer-labelled diverse
wedding album. Compare disagreement and event split/merge errors, not just
coverage. No model is declared a universal winner from this portrait-only test.

Private visual report: ../local-ai/comparison/run/comparison.html (self-contained
local photos; not uploaded). All predictions, prompt/evidence details and timing
are retained next to it. No Apply, source-photo changes, commit, push, merge,
package or version change occurred.
