import unittest
from evaluate_events import evaluate


def row(i, label, event, predicted_event, predicted_label=None, review=False):
    return dict(id=i, expectedLabel=label, expectedEvent=event, predictedLabel=predicted_label or label,
                predictedEvent=predicted_event, requiresReview=review)


class EventEvaluationTests(unittest.TestCase):
    def test_perfect_labels_can_still_merge_distinct_events(self):
        result = evaluate([row(0, 'Portraits', 'session1', 'one'), row(1, 'Portraits', 'session2', 'one')])
        self.assertEqual(result['labelAccuracy'], 1)
        self.assertEqual(result['boundaries']['falseNegative'], 1)

    def test_missing_predictions_are_not_false_perfection(self):
        rows = [row(0, 'Ceremony', 'one', None), row(1, 'Reception', 'two', None, review=True)]
        rows[1]['predictedLabel'] = None
        result = evaluate(rows)
        self.assertEqual(result['boundaries']['unknown'], 1)
        self.assertIsNone(result['boundaries']['recallOnKnown'])
        self.assertEqual(result['labelAccuracy'], .5)
        self.assertEqual(result['acceptedCoverage'], .5)

    def test_split_and_merge_errors(self):
        result = evaluate([row(0, 'Ceremony', 'a', 'x'), row(1, 'Ceremony', 'a', 'y'), row(2, 'Reception', 'b', 'y')])
        self.assertEqual(result['boundaries']['falsePositive'], 1)
        self.assertEqual(result['boundaries']['falseNegative'], 1)

    def test_requires_verified_order_and_ground_truth(self):
        with self.assertRaises(ValueError):
            evaluate([row(0, 'A', 'a', 'x'), row(1, 'B', 'b', 'y'), row(2, 'A', 'a', 'z')])
        with self.assertRaises(ValueError):
            evaluate([row(0, '', 'a', 'x'), row(1, 'B', 'b', 'y')])


if __name__ == '__main__':
    unittest.main()
