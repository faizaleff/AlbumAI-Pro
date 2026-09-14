import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from PIL import Image
import gemini_compare as gemini


class GeminiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        path = self.folder / 'preview.jpg'
        Image.new('RGB', (8, 8)).save(path)
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        (self.folder / 'manifest.json').write_text(json.dumps({'photos': [
            {'id': i, 'name': 'private-original.jpg', 'image': 'preview.jpg', 'sha256': sha} for i in range(24)]}))
        gemini.prepare(self.folder)

    def test_no_upload_without_consent(self):
        post = Mock()
        with self.assertRaises(ValueError):
            gemini.run(self.folder, 'secret-test-key', '', post)
        post.assert_not_called()
        self.assertFalse((self.folder / 'gemini-3.1-results.json').exists())

    def test_changed_preview_and_path_escape_fail_closed(self):
        (self.folder / 'preview.jpg').write_bytes(b'changed')
        post = Mock()
        with self.assertRaises(ValueError):
            gemini.run(self.folder, 'secret-test-key', 'SEND 24', post)
        post.assert_not_called()
        path = self.folder / 'manifest.json'
        data = json.loads(path.read_text())
        data['photos'][0]['image'] = '../outside.jpg'
        path.write_text(json.dumps(data))
        with self.assertRaises(ValueError):
            gemini.sample(self.folder)

    def test_uncertain_request_never_retried_or_leaks_key(self):
        post = Mock(side_effect=RuntimeError('secret-test-key'))
        self.assertFalse(gemini.run(self.folder, 'secret-test-key', 'SEND 24', post))
        with self.assertRaises(FileExistsError):
            gemini.run(self.folder, 'secret-test-key', 'SEND 24', post)
        self.assertEqual(post.call_count, 1)
        self.assertNotIn('secret-test-key', (self.folder / 'gemini-3.1-results.json').read_text())

    def test_success_records_usage_and_sends_only_preview(self):
        body = {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps({
            'label': 'Couple Portraits', 'needs_review': False, 'reason': '<script>test</script>'})}]}}],
            'usageMetadata': {'promptTokenCount': 100, 'candidatesTokenCount': 20}}
        post = Mock(return_value=Mock(status_code=200, json=lambda: body))
        self.assertTrue(gemini.run(self.folder, 'secret-test-key', 'SEND 24', post))
        self.assertEqual(post.call_count, 24)
        kwargs = post.call_args.kwargs
        self.assertFalse(kwargs['allow_redirects'])
        self.assertNotIn('private-original', json.dumps(kwargs['json']))
        self.assertNotIn('secret-test-key', (self.folder / 'gemini-3.1-results.json').read_text())
        self.assertNotIn('<script>', (self.folder / 'gemini-3.1-comparison.html').read_text())
        self.assertAlmostEqual(gemini.estimate_cost(body['usageMetadata']), .000055)
        self.assertIsNone(gemini.estimate_cost({}))

    def test_diagnostic_only_gets_metadata_and_preserves_run(self):
        journal = self.folder / 'gemini-3.1-results.json'
        journal.write_text('preserve this run')
        get = Mock(return_value=Mock(status_code=200))
        gemini.diagnose(self.folder, 'secret-test-key', get)
        self.assertEqual(get.call_args.args[0], gemini.URL.removesuffix(':generateContent'))
        self.assertNotIn('json', get.call_args.kwargs)
        self.assertEqual(journal.read_text(), 'preserve this run')
        self.assertNotIn('secret-test-key', (self.folder / 'gemini-diagnostic.json').read_text())

    def test_http_diagnostic_never_echoes_server_message(self):
        response = Mock(status_code=400, json=lambda: {'error': {
            'message': 'secret-test-key', 'details': [{'reason': 'API_KEY_INVALID'}, {'reason': 'secret-test-key'}]}})
        info = gemini.safe_http_error(response)
        self.assertEqual(info['reasons'], ['API_KEY_INVALID'])
        self.assertNotIn('secret-test-key', json.dumps(info))

    def test_resume_skips_uncertain_photo_and_preserves_journal(self):
        failure = Mock(side_effect=RuntimeError('unknown'))
        gemini.run(self.folder, 'key', 'SEND 24', failure)
        journal = self.folder / 'gemini-3.1-results.json'
        first = json.loads(journal.read_text())['results'][0]
        body = {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps({
            'label': 'Couple Portraits', 'needs_review': False, 'reason': 'Two people'})}]}}]}
        post = Mock(return_value=Mock(status_code=200, json=lambda: body))
        self.assertTrue(gemini.run(self.folder, 'key', 'SEND 24', post, resume=True))
        self.assertEqual(post.call_count, 23)
        self.assertEqual(json.loads(journal.read_text())['results'][0], first)
        post.reset_mock()
        gemini.run(self.folder, 'key', 'SEND 24', post, resume=True)
        post.assert_not_called()

    def test_resume_refuses_mismatched_history(self):
        gemini.run(self.folder, 'key', 'SEND 24', Mock(side_effect=RuntimeError()))
        journal = self.folder / 'gemini-3.1-results.json'
        state = json.loads(journal.read_text())
        state['results'][0]['sha256'] = 'changed'
        journal.write_text(json.dumps(state))
        post = Mock()
        with self.assertRaises(ValueError):
            gemini.run(self.folder, 'key', 'SEND 24', post, resume=True)
        post.assert_not_called()

    def test_generation_probe_lists_pages_and_sends_no_photos(self):
        get = Mock(side_effect=[
            Mock(status_code=200, json=lambda: {'models': [{'name': 'models/gemini-2.5-flash', 'supportedGenerationMethods': ['generateContent']}], 'nextPageToken': 'next'}),
            Mock(status_code=200, json=lambda: {'models': [{'name': 'secret-test-key', 'supportedGenerationMethods': ['generateContent']}]})])
        post = Mock(return_value=Mock(status_code=404, json=lambda: {'error': {'message': 'secret-test-key'}}))
        result = gemini.diagnose_generation(self.folder, 'secret-test-key', get, post)
        self.assertEqual(get.call_count, 2)
        self.assertEqual(post.call_count, 1)
        self.assertEqual(result['generationModels'], ['models/gemini-2.5-flash'])
        self.assertEqual(result['textProbe']['httpStatus'], 404)
        self.assertIn('/models/gemini-3.1-flash-lite:generateContent', post.call_args.args[0])
        self.assertNotIn('thinkingBudget', json.dumps(post.call_args.kwargs))
        self.assertEqual(post.call_args.kwargs['json']['contents'], [{'parts': [{'text': 'Reply OK.'}]}])
        self.assertNotIn('secret-test-key', json.dumps(result))
        self.assertFalse((self.folder / 'gemini-3.1-results.json').exists())

    def test_migration_preserves_legacy_and_does_not_resend(self):
        photos = gemini.sample(self.folder)
        old = {'model': 'gemini-2.5-flash', 'fingerprint': gemini.fingerprint(photos),
               'results': [{'id': i, 'sha256': p['sha256'], 'status': 'stopped; outcome may be unknown'}
                           for i, (p, _) in enumerate(photos)]}
        legacy = self.folder / 'gemini-results.json'
        legacy.write_text(json.dumps(old))
        before = legacy.read_bytes()
        post = Mock()
        gemini.run(self.folder, 'key', 'SEND 24', post, resume=True)
        post.assert_not_called()
        self.assertEqual(legacy.read_bytes(), before)
        new = json.loads((self.folder / 'gemini-3.1-results.json').read_text())
        self.assertEqual(new['model'], 'gemini-3.1-flash-lite')
        self.assertEqual(new['results'][0]['model'], 'gemini-2.5-flash')
        self.assertEqual(gemini.payload(b'preview')['generationConfig']['thinkingConfig'], {'thinkingLevel': 'minimal'})

    def test_blocked_or_invalid_output_not_accepted(self):
        with self.assertRaises(ValueError):
            gemini.parse_response({'candidates': []})
        with self.assertRaises(ValueError):
            gemini.parse_response({'candidates': [{'finishReason': 'MAX_TOKENS'}]})


if __name__ == '__main__':
    unittest.main()
