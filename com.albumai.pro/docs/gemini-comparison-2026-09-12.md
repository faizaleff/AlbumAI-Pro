# Gemini comparison preparation — 2026-09-12

Prepared an optional online experiment using the same 24 local comparison previews. No Google request has been made, no API key was supplied, and no Events or original photographs were changed. The production Local AI provider is unchanged.

## Review and run

1. Open `local-ai/comparison/run/gemini-review.html`. It is an offline, self-contained page showing every exact 768px-or-smaller JPEG to be sent, total size, destination, model, pricing and data terms.
2. Check billing for the API key's project in Google AI Studio and read Google's linked terms. Billing cannot be inferred from an API key. This experiment requires the user to confirm that check; it does not enable billing.
3. Open `scripts/local-ai/start-gemini-comparison.command` in Terminal. The hidden key prompt keeps the key out of source, browser pages, command arguments, logs and saved results. Do not paste a key into chat.
4. After reviewing, explicitly type `SEND 24` to authorize sending these previews. No original names, paths or EXIF are included in API requests.
5. Results are saved incrementally to `gemini-results.json` and a side-by-side `gemini-comparison.html` beside the existing comparison. Existing local-model results are preserved.

The tool sends one image per request to Gemini 2.5 Flash, with fixed broad labels, zero thinking budget and a 512-output-token limit. It uses HTTPS, an API-key header, no redirects, no environment proxies, and no automatic retries. An exclusive journal prevents an accidental repeat run. A failed/uncertain request stops the experiment; review the journal before deciding whether a new experiment is appropriate. Missing usage or failed requests may still incur charges.

Cost is an estimate from reported tokens using the September 11 checked standard rates ($0.30/M input, $2.50/M output including thinking). It is not an invoice or a spending cap. Paid-service data terms do not mean zero retention. See https://ai.google.dev/gemini-api/terms and https://ai.google.dev/gemini-api/docs/pricing.

## Scope and remaining work

This is a developer comparison utility, not a shipped online feature. Live API compatibility, quality, latency and cost remain untested until the user provides a key in the hidden prompt, checks project billing and approves the preview upload. Mocked tests do not establish live API success. The portrait-heavy sample has no photographer-verified ground truth and cannot establish full professional event automation accuracy.

After the live comparison, review disagreements against photographs, then test a diverse labelled album before choosing a production provider. Commercial integration needs separate secure key handling and explicit online-photo consent in the product UI; do not embed a shared key in the plugin.

Validation: all 10 local comparison/worker tests passed (including 5 Gemini tests for consent, changed files/path escape, uncertain requests, payload privacy, usage and output validation). Production build passed. No commit, push, merge, packaging or version change.

## First live attempt and diagnostic follow-up

The user entered billing confirmation, their hidden key and SEND 24. Photo 0 stopped after about 1.95 seconds; no classification or usage was saved. The original error handling discarded the HTTP/error category, so the cause and server outcome cannot be recovered from this journal. No retry or deletion was performed.

Added `check-gemini-connection.command`: hidden key entry followed by a model-metadata GET only, without photographs or generation. Records only HTTP status, fixed explanatory text and allowlisted reason/error categories in `gemini-diagnostic.json`. This checks connectivity/model access, not generation quota or billing. Future image failures now also record sanitized diagnostics. Existing comparison stays intact. All 12 tests, production build, bundle verification and diff checks pass. Await user-run connection check; key is not retained.

The user's metadata diagnostic returned HTTP 200. This confirms model-metadata access only; the initial image failure remains unexplained. Added `continue-gemini-comparison.command` to process only unattempted photos under the already confirmed upload scope. It preserves the uncertain first entry, validates the existing model/sample/hashes, and holds a process lock to prevent concurrent duplicate submissions. No live images were resent during development. The hidden key must be entered again because it is not stored. The report continues to show the unresolved first result rather than claiming 24 successes. All 14 tests pass, including resume/no-resend and mismatched-history checks; production build and bundle verification pass.

The next live image attempt (photo 1) returned HTTP 404; zero classifications succeeded. Do not keep consuming unattempted photos for diagnosis. Added `check-gemini-generation.command`: paginated model list filtered by generateContent support, followed by exactly one tiny text-only request to the existing model. No photos, names or project data are sent; a small token charge may apply. Saves sanitized metadata/status in `gemini-generation-diagnostic.json`, preserving the comparison. Metadata access does not prove generation access. Official model documentation supports listing supportedGenerationMethods (https://ai.google.dev/api/models); current key documentation describes the standard-to-auth key transition (https://ai.google.dev/gemini-api/docs/api-key), but the user's key type is unknown and must not be assumed. Await this diagnostic before switching models or making further image requests. All 15 tests, production build, bundle verification and diff checks passed.

The user's model list advertised gemini-2.5-flash/generateContent, but the text-only probe also returned 404. Google support's August 31 response to the identical symptom explains that 2.5 generation access is limited to prior users and recommends 3.1 Flash-Lite or 3.5 Flash for new projects: https://discuss.ai.google.dev/t/auth-key-can-list-models-but-generatecontent-returns-http-404-not-found-for-gemini-2-5-flash/180197/2. This is a strong explanation, not independently verified account state. Changed only the text diagnostic to stable gemini-3.1-flash-lite, with a small output limit and no 2.5-only thinkingBudget. Saves a model-specific diagnostic file, preserving the old diagnostic. Existing photo comparison, consent/review/model/cost settings are still 2.5 and must be updated together after a successful new-model probe, before resuming image work. No image or live text calls made by the agent. All 15 tests and build/bundle checks pass.

Gemini 3.1 Flash-Lite text probe returned HTTP 200. Updated the photo runner to this model, minimal thinking level, temperature 1, 512 output tokens, and standard $0.25/M input plus $1.50/M output/thinking rates verified September 12 (https://ai.google.dev/gemini-api/docs/pricing). This does not establish image classification success yet.

Current review/results/report use separate `gemini-3.1-*` filenames. On continue, the old 2.5 journal is validated and copied with per-entry original model attribution. The old file stays unchanged; both previously attempted photos are skipped, leaving 22 unattempted previews. The process lock still prevents parallel resends. Existing user billing/upload approval persists; only the hidden key needs entering again. Current report can show at most 22/24 successes until the two old attempts are separately addressed. No live requests from the agent. All 16 tests, production build, bundle verification and diff checks pass.

## Live comparison completed

User ran the updated launcher: all 22 remaining previews completed with Gemini 3.1 Flash-Lite. Verified from `gemini-3.1-results.json`: 11 Couple Portraits, 11 Individual Portraits, zero model-requested reviews; all 22 broad labels agree with the per-photo local Qwen run. This is agreement, not verified accuracy. The two old attempts remain unresolved and were not resent.

Sum of the 22 Gemini request times: 58.257479 seconds (includes API/network latency). Qwen inference on these same 22 photos: 145.096025 seconds (excludes model loading). Gemini was about 2.49 times faster under these test conditions. Recorded token-usage cost estimate: USD 0.00756075, with usage present for all 22 successful responses; excludes earlier attempts and text diagnostics, and is not an invoice.

The existing local comparison is preserved. No Events were applied, originals modified, or release actions performed. Next: photographer-verified, diverse ceremony/reception/getting-ready sequences and event-boundary evaluation before promoting optional Online AI to the production workflow. This result establishes working cloud photo classification, not full automatic event grouping.
