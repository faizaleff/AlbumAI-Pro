import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from worker import atomic_json, validate_request, PROTOCOL, cleanup_abandoned

class WorkerTests(unittest.TestCase):
    def test_request_bounds(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'photo.jpg'; path.write_bytes(b'jpeg')
            self.assertEqual(validate_request({'protocol':PROTOCOL,'path':str(path)}),path)
            for value in [{'protocol':'other','path':str(path)}, {'protocol':PROTOCOL,'path':'relative.jpg'}, {'protocol':PROTOCOL,'path':str(path.with_suffix('.exe'))}]:
                with self.assertRaises(ValueError): validate_request(value)
    def test_cleanup_tolerates_consumed_response(self):
        bridge = Mock()
        consumed, stale = Mock(), Mock()
        consumed.stat.side_effect = FileNotFoundError()
        stale.stat.return_value.st_mtime = 0
        bridge.glob.side_effect = [[consumed, stale], [], []]
        cleanup_abandoned(bridge)
        stale.unlink.assert_called_once_with(missing_ok=True)
        consumed.unlink.assert_not_called()

    def test_atomic_response(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'response.json'
            atomic_json(path,{'status':'complete','embedding':[.1,.2]})
            self.assertEqual(json.loads(path.read_text())['embedding'],[.1,.2])
            self.assertFalse(path.with_suffix('.tmp').exists())

if __name__=='__main__': unittest.main()
