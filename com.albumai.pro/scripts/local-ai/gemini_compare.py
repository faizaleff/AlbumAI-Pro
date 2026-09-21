"""Explicit-consent Gemini experiment. Never writes an AlbumAI project."""
import argparse
import base64
import getpass
import fcntl
import hashlib
import html
import io
import json
import re
import sys
import time
import warnings
from pathlib import Path

from PIL import Image

RUN = Path(__file__).resolve().parents[2] / 'local-ai/comparison/run'
MODEL = 'gemini-3.1-flash-lite'
PROBE_MODEL = 'gemini-3.1-flash-lite'
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent'
LABELS = ['Getting Ready', 'Ceremony', 'Couple Portraits', 'Individual Portraits',
          'Family & Guests', 'Reception', 'Dance & Celebration', 'Details & Venue', 'Other']


def sample(folder):
    photos = json.loads((folder / 'manifest.json').read_text())['photos']
    if len(photos) != 24 or len({p['id'] for p in photos}) != 24:
        raise ValueError('Expected the original 24-photo comparison sample.')
    result = []
    for photo in photos:
        path = (folder / photo['image']).resolve()
        if path.parent != folder.resolve():
            raise ValueError('Preview must be inside the comparison folder.')
        data = path.read_bytes()
        if len(data) > 2_000_000 or hashlib.sha256(data).hexdigest() != photo['sha256']:
            raise ValueError('Preview changed; prepare and review again.')
        with Image.open(io.BytesIO(data)) as image:
            if image.format != 'JPEG' or max(image.size) > 768 or image.getexif():
                raise ValueError('Expected a small JPEG preview without EXIF.')
        result.append((photo, data))
    return result


def fingerprint(photos):
    return hashlib.sha256(json.dumps([(p['id'], p['sha256']) for p, _ in photos]).encode()).hexdigest()


def write_json(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, indent=2, allow_nan=False))
    tmp.replace(path)


def prepare(folder):
    photos = sample(folder)
    cards = ''.join('<figure><img src="data:image/jpeg;base64,' + base64.b64encode(data).decode() +
                    '"><figcaption>' + html.escape(str(p['name'])) + '</figcaption></figure>' for p, data in photos)
    page = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>AlbumAI · Gemini preview review</title><style>
body{background:#141c26;color:#e6edf5;font:16px system-ui;margin:32px auto;max-width:1100px;padding:0 20px}
h1{font-size:26px}p{line-height:1.6;color:#c0cbd9}a{color:#8ec3ff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
figure{margin:0;background:#202c39;padding:10px;border-radius:8px}img{width:100%;height:230px;object-fit:contain}figcaption{font-size:13px;padding-top:8px;overflow-wrap:anywhere}</style>
<h1>Review the 24 photos for Gemini</h1><p>This page is offline. Previously attempted photos are skipped when continuing; old results are preserved.</p>
<p>Only these JPEG previews (maximum 768 pixels) and a classification prompt will be sent to Google's Gemini API.
Original files, filenames, folder paths and EXIF are not included in the request. Existing Events will not change.</p>
<p>Model: gemini-3.1-flash-lite. One request per photo, no automatic retries. This compares broad photo labels, not complete event automation or verified accuracy.</p>
<p>Before sending, check that billing is enabled for the API key's project in AI Studio. An API key alone cannot verify billing.
Paid-service data is not used to improve Google's products under the linked terms; this does not mean zero retention.
Unpaid-service data may be used for improvement and human review.</p>
<p><a href="https://aistudio.google.com/">Google AI Studio</a> · <a href="https://ai.google.dev/gemini-api/terms">Data terms</a> ·
<a href="https://ai.google.dev/gemini-api/docs/pricing">Pricing</a></p>
<p>Estimated token cost uses $0.25 per million input tokens and $1.50 per million output/thinking tokens (checked September 12, 2026).
Actual billing may differ. Usage and elapsed time will be recorded after each response.</p>
<p>Use the launcher provided for this sample. Enter your key only in its hidden prompt. For a new sample, review these exact previews and confirm upload consent before sending. Continue launchers skip all previously attempted photos.
Do not paste your key into chat. Closing the terminal cancels before sending.</p>'''
    page += f'<p>Total preview size: {sum(len(d) for _, d in photos)/1_000_000:.2f} MB.</p><div class="grid">{cards}</div>'
    (folder / 'gemini-3.1-review.html').write_text(page)
    write_json(folder / 'gemini-3.1-review.json', {'fingerprint': fingerprint(photos), 'model': MODEL})
    return folder / 'gemini-3.1-review.html'


def payload(data):
    return {'contents': [{'role': 'user', 'parts': [
        {'text': 'Judge only visible content, not assumed wedding traditions. Choose a broad photo label. '
         'Use Other and needs_review true if uncertain. Do not infer specific rituals. Give a short reason.'},
        {'inlineData': {'mimeType': 'image/jpeg', 'data': base64.b64encode(data).decode()}}]}],
        'generationConfig': {'temperature': 1, 'maxOutputTokens': 512,
            'thinkingConfig': {'thinkingLevel': 'minimal'}, 'responseMimeType': 'application/json',
            'responseJsonSchema': {'type': 'object', 'properties': {
                'label': {'type': 'string', 'enum': LABELS},
                'needs_review': {'type': 'boolean'}, 'reason': {'type': 'string'}},
                'required': ['label', 'needs_review', 'reason'], 'additionalProperties': False}}}


def parse_response(body):
    candidates = body.get('candidates', [])
    if not candidates or candidates[0].get('finishReason') != 'STOP':
        raise ValueError('No complete classification received.')
    text = ''.join(p.get('text', '') for p in candidates[0].get('content', {}).get('parts', []) if not p.get('thought'))
    result = json.loads(text)
    if result.get('label') not in LABELS or type(result.get('needs_review')) is not bool or not isinstance(result.get('reason'), str):
        raise ValueError('Invalid classification received.')
    return {k: result[k] for k in ('label', 'needs_review', 'reason')}


def estimate_cost(usage):
    if 'promptTokenCount' not in usage or 'candidatesTokenCount' not in usage:
        return None
    return (usage['promptTokenCount'] * .25 + (usage['candidatesTokenCount'] + usage.get('thoughtsTokenCount', 0)) * 1.50) / 1_000_000


HTTP_HINTS = {
    400: 'Request rejected: check API key and request settings.',
    401: 'Authentication failed: check the API key.',
    403: 'Access denied: check API key restrictions and project API access.',
    404: 'Model unavailable for this API key or endpoint.',
    429: 'Quota or rate limit reached: check project quota and billing.',
    500: 'Google service error.', 503: 'Google service temporarily unavailable.'}


def safe_http_error(response):
    # Only emit known codes/reasons, never arbitrary server messages or request data.
    info = {'httpStatus': response.status_code,
            'hint': HTTP_HINTS.get(response.status_code, 'Unexpected HTTP response.')}
    allowed = {'API_KEY_INVALID', 'API_KEY_EXPIRED', 'API_KEY_SERVICE_BLOCKED',
               'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED',
               'SERVICE_DISABLED', 'BILLING_DISABLED', 'CONSUMER_INVALID'}
    try:
        reasons = [d.get('reason') for d in response.json().get('error', {}).get('details', [])]
        info['reasons'] = [r for r in reasons if r in allowed]
    except Exception:
        pass
    return info


def diagnose(folder, key, get=None):
    """Read model availability only. No photo, prompt or generation request."""
    if get is None:
        import requests
        session = requests.Session()
        session.trust_env = False
        get = session.get
    try:
        response = get(URL.removesuffix(':generateContent'), headers={'x-goog-api-key': key},
                       timeout=(15, 30), allow_redirects=False)
        info = ({'httpStatus': 200, 'hint': 'Key can access model metadata. This does not verify generation quota, billing or image requests.'}
                if response.status_code == 200 else safe_http_error(response))
    except Exception as error:
        kind = type(error).__name__
        info = {'hint': 'Connection failed before a usable response.',
                'category': kind if kind in {'SSLError', 'Timeout', 'ConnectTimeout', 'ReadTimeout', 'ConnectionError'} else 'Connection error'}
    write_json(folder / 'gemini-diagnostic.json', info)
    print(json.dumps(info, indent=2))
    return info


def diagnose_generation(folder, key, get=None, post=None):
    """List supported models and send one tiny text probe, never a photograph."""
    if get is None or post is None:
        import requests
        session = requests.Session()
        session.trust_env = False
        get, post = session.get, session.post
    info = {'model': PROBE_MODEL, 'photosSent': 0, 'generationModels': []}
    options = {'headers': {'x-goog-api-key': key}, 'timeout': (15, 30), 'allow_redirects': False}
    try:
        token = None
        for _ in range(10):
            params = {'pageSize': 100}
            if token:
                params['pageToken'] = token
            response = get('https://generativelanguage.googleapis.com/v1beta/models', params=params, **options)
            if response.status_code != 200:
                info['modelListError'] = safe_http_error(response)
                break
            body = response.json()
            for model in body.get('models', []):
                name = model.get('name', '')
                if ('generateContent' in model.get('supportedGenerationMethods', [])
                        and re.fullmatch(r'models/gemini-[a-z0-9.-]{1,100}', name) and key not in name):
                    info['generationModels'].append(name)
            token = body.get('nextPageToken')
            if not token:
                break
        else:
            info['modelListTruncated'] = True
        # Exactly one small generation probe: no private data, schema or image.
        response = post(f'https://generativelanguage.googleapis.com/v1beta/models/{PROBE_MODEL}:generateContent',
                        json={'contents': [{'parts': [{'text': 'Reply OK.'}]}],
                              'generationConfig': {'maxOutputTokens': 32}}, **options)
        info['textProbe'] = ({'httpStatus': 200, 'hint': 'Text generation endpoint works; image/schema handling still needs verification.'}
                             if response.status_code == 200 else safe_http_error(response))
    except Exception as error:
        kind = type(error).__name__
        info['error'] = kind if kind in {'SSLError', 'Timeout', 'ConnectTimeout', 'ReadTimeout', 'ConnectionError'} else 'Diagnostic error'
    write_json(folder / f'gemini-generation-diagnostic-{PROBE_MODEL}.json', info)
    print(json.dumps(info, indent=2))
    return info


def migrate_legacy(folder, photos):
    old_path = folder / 'gemini-results.json'
    old = json.loads(old_path.read_text())
    expected = {p['id']: p['sha256'] for p, _ in photos}
    if (old.get('model') != 'gemini-2.5-flash' or old.get('fingerprint') != fingerprint(photos)
            or len({r['id'] for r in old['results']}) != len(old['results'])
            or any(r['id'] not in expected or r.get('sha256') != expected[r['id']] for r in old['results'])):
        raise ValueError('Legacy results do not match reviewed photos.')
    state = {**old, 'model': MODEL, 'previousModel': old['model'],
             'results': [{**r, 'model': old['model']} for r in old['results']]}
    with (folder / 'gemini-3.1-results.json').open('x') as out:
        json.dump(state, out, indent=2)


def run(folder, key, consent, post=None, resume=False):
    # Kernel lock is released even after interruption; parallel launches cannot resend.
    with (folder / 'gemini-run.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return run_locked(folder, key, consent, post, resume)


def run_locked(folder, key, consent, post=None, resume=False):
    if consent != 'SEND 24':
        raise ValueError('Upload approval was not provided.')
    photos = sample(folder)
    review = json.loads((folder / 'gemini-3.1-review.json').read_text())
    if review != {'fingerprint': fingerprint(photos), 'model': MODEL}:
        raise ValueError('Sample changed; prepare and review again.')
    # Exclusive creation prevents duplicate sends after a crash or repeated launch.
    journal = folder / 'gemini-3.1-results.json'
    if resume:
        if not journal.exists():
            migrate_legacy(folder, photos)
        state = json.loads(journal.read_text())
        expected = {p['id']: p['sha256'] for p, _ in photos}
        prior = state['results']
        if (state.get('model') != MODEL or state.get('fingerprint') != fingerprint(photos)
                or len({r['id'] for r in prior}) != len(prior)
                or any(r['id'] not in expected or r.get('sha256') != expected[r['id']] for r in prior)):
            raise ValueError('Saved run does not match the reviewed sample.')
    else:
        if (folder / 'gemini-results.json').exists():
            raise ValueError('Use continue to preserve previous attempts.')
        state = {'model': MODEL, 'fingerprint': fingerprint(photos), 'results': [],
                 'note': 'Broad labels only. Cost is an estimate; accuracy requires human review.'}
        with journal.open('x') as out:
            json.dump(state, out)
    attempted = {r['id'] for r in state['results']}
    if post is None:
        import requests
        session = requests.Session()
        session.trust_env = False  # Do not forward the key through environment proxies.
        post = session.post
    for photo, data in photos:
        if photo['id'] in attempted:
            continue
        item = {'id': photo['id'], 'sha256': photo['sha256'], 'status': 'attempted', 'model': MODEL}
        state['results'].append(item)
        write_json(journal, state)  # Persist before sending; unknown outcomes are never retried.
        start = time.perf_counter()
        try:
            response = post(URL, headers={'x-goog-api-key': key}, json=payload(data), timeout=(15, 90), allow_redirects=False)
            if response.status_code != 200:
                item['error'] = safe_http_error(response)
                raise ValueError('Request unsuccessful.')
            body = response.json()
            usage = {k: body.get('usageMetadata', {})[k] for k in
                     ('promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount')
                     if k in body.get('usageMetadata', {})}
            item.update(usage=usage, estimatedUSD=estimate_cost(usage), modelVersion=body.get('modelVersion'))
            item.update(classification=parse_response(body), status='complete')
        except Exception as error:
            if 'error' not in item:
                kind = type(error).__name__
                item['error'] = {'category': kind if kind in {'SSLError', 'Timeout', 'ConnectTimeout', 'ReadTimeout', 'ConnectionError', 'ValueError', 'JSONDecodeError'} else 'Request error'}
            print(json.dumps(item['error']))
            item['status'] = 'stopped; outcome may be unknown'
            print('Stopped after a request error. No automatic retry; existing results are preserved.')
        item['seconds'] = time.perf_counter() - start
        write_json(journal, state)
        report(folder, state, photos)
        print(f"{len(state['results'])}/24: {item['status']}", flush=True)
        if item['status'] != 'complete':
            return False
    return True



def report(folder, state, photos):
    qwen_path = folder / 'qwen-single.json'
    qwen = {r['photoIds'][0]: r.get('result', {}).get('label', 'Needs review')
            for r in json.loads(qwen_path.read_text())['results']} if qwen_path.exists() else {}
    google_path = folder / 'siglip2.json'
    google = {r['id']: r.get('label') or 'Needs review'
              for r in json.loads(google_path.read_text())['evidence']} if google_path.exists() else {}
    results = {r['id']: r for r in state['results']}
    rows = []
    for photo, data in photos:
        item = results.get(photo['id'], {})
        prediction = item.get('classification', {})
        values = [photo['name'], google.get(photo['id'], '—'), qwen.get(photo['id'], '—'),
                  prediction.get('label', item.get('status', 'Not sent')),
                  'Review' if prediction.get('needs_review') else '', prediction.get('reason', '')]
        rows.append('<tr><td><img width="100" src="data:image/jpeg;base64,' + base64.b64encode(data).decode() +
                    '"></td>' + ''.join('<td>' + html.escape(str(v)) + '</td>' for v in values) + '</tr>')
    complete = sum(r['status'] == 'complete' for r in state['results'])
    cost = sum(r.get('estimatedUSD') or 0 for r in state['results'])
    seconds = sum(r.get('seconds', 0) for r in state['results'])
    page = '<!doctype html><meta charset="utf-8"><title>Gemini comparison</title>'
    page += "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'\">"
    page += '<style>body{font:15px system-ui;background:#141c26;color:#e6edf5;padding:24px}td,th{text-align:left;padding:12px;border-bottom:1px solid #354353}img{max-height:120px;object-fit:contain}</style>'
    page += f'<h1>Gemini comparison · {complete}/24 complete</h1><p>Elapsed requests: {seconds:.1f}s · Recorded usage estimate: ${cost:.6f} USD.</p>'
    page += '<p>Failed requests or missing usage may still incur charges. This is not an invoice. Broad photo labels are not complete Events; photographer review is needed. This sample has no photographer-verified ground truth. Label predictions alone do not establish event boundaries.</p>'
    page += '<table><tr><th>Photo</th><th>Name</th><th>Local SigLIP2</th><th>Local Qwen</th><th>Gemini</th><th>Review</th><th>Reason</th></tr>' + ''.join(rows) + '</table>'
    (folder / 'gemini-3.1-comparison.html').write_text(page)


def main():
    global RUN
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'run', 'diagnose', 'resume', 'probe'])
    parser.add_argument('--folder', type=Path, help='Separate prepared comparison folder; originals are never modified.')
    args = parser.parse_args()
    if args.folder:
        RUN = args.folder.resolve()
    if args.action == 'prepare':
        print(prepare(RUN))
        return
    if not sys.stdin.isatty():
        raise ValueError('Use the launcher in an interactive terminal for hidden key entry.')
    if args.action == 'probe':
        print(f'Check {PROBE_MODEL} with one tiny test text (Reply OK). No photos are sent. Minimal token charges may apply.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            key = getpass.getpass('Google AI Studio API key (hidden, not saved): ').strip()
        if key:
            diagnose_generation(RUN, key)
        return
    if args.action == 'diagnose':
        print('Connection check only: no photos will be sent and the saved comparison will not change.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            key = getpass.getpass('Google AI Studio API key (hidden, not saved): ').strip()
        if key:
            diagnose(RUN, key)
        return
    if args.action == 'resume':
        print(f'Continue with {MODEL}: $0.25/M input, $1.50/M output tokens. Previously attempted photos are skipped, including uncertain outcomes.')
        print('Only remaining previews will be sent. Close this terminal to cancel.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            key = getpass.getpass('Google AI Studio API key (hidden, not saved): ').strip()
        if key:
            run(RUN, key, 'SEND 24', resume=True)
            state = json.loads((RUN / 'gemini-3.1-results.json').read_text())
            count = sum(r['status'] == 'complete' for r in state['results'])
            print(f'{count}/24 successful classifications. Previously uncertain results remain unresolved.')
            print('Report: ' + str(RUN / 'gemini-3.1-comparison.html'))
        return
    if (RUN / 'gemini-3.1-results.json').exists():
        raise ValueError('A Gemini run already exists. Review its results before any new requests.')
    print('Review gemini-3.1-review.html first. 24 small previews will be sent to Google; originals and Events stay unchanged.')
    print('Check billing for your API key project in AI Studio and read the linked data terms. The key cannot verify billing.')
    if input('Type BILLING CHECKED to confirm: ').strip() != 'BILLING CHECKED':
        return
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        key = getpass.getpass('Google AI Studio API key (hidden, not saved): ').strip()
    if not key:
        return
    consent = input('After reviewing all 24 previews, type SEND 24 to upload them: ').strip()
    if not run(RUN, key, consent):
        raise ValueError('Comparison incomplete. Review gemini-3.1-results.json before continuing.')
    print('Complete. Results: ' + str(RUN / 'gemini-3.1-results.json'))


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt):
        # Never echo network exceptions, response bodies or credentials.
        print('Comparison stopped. Check the review and saved results; no requests will be retried automatically.')
        sys.exit(1)
