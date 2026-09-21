"""Score photographer-reviewed, chronologically ordered events without network access.
Input JSON: {"photos": [{"id": ..., "expectedLabel": ..., "expectedEvent": ...,
"predictedLabel": ..., "predictedEvent": ..., "requiresReview": boolean}, ...]}.
Order must be verified by the photographer; event ids identify occurrences, not labels.
"""
import argparse
from collections import Counter
import json
from pathlib import Path


def evaluate(photos):
    if len(photos) < 2 or len({p['id'] for p in photos}) != len(photos):
        raise ValueError('Need at least two uniquely identified photos in verified sequence.')
    for p in photos:
        for key in ('expectedLabel', 'expectedEvent'):
            if not isinstance(p.get(key), str) or not p[key].strip():
                raise ValueError('Photographer labels and event occurrences are required.')
        for key in ('predictedLabel', 'predictedEvent'):
            if p.get(key) is not None and not isinstance(p[key], str):
                raise ValueError('Predictions must be strings or null.')
        if type(p.get('requiresReview')) is not bool:
            raise ValueError('Review status must be explicit.')
    # Reusing an occurrence id after leaving it would invalidate boundary scoring.
    finished, last = set(), None
    for p in photos:
        event = p['expectedEvent']
        if event != last:
            if event in finished:
                raise ValueError('Expected event occurrences must be contiguous in verified sequence.')
            if last is not None:
                finished.add(last)
            last = event
    accepted = [p for p in photos if not p['requiresReview'] and p.get('predictedLabel')]
    correct = sum(p['expectedLabel'] == p.get('predictedLabel') for p in photos)
    accepted_correct = sum(p['expectedLabel'] == p['predictedLabel'] for p in accepted)
    tp = fp = fn = unknown = 0
    boundaries = []
    for a, b in zip(photos, photos[1:]):
        expected = a['expectedEvent'] != b['expectedEvent']
        predicted = None if not a.get('predictedEvent') or not b.get('predictedEvent') else a['predictedEvent'] != b['predictedEvent']
        if predicted is None:
            unknown += 1
        elif predicted and expected:
            tp += 1
        elif predicted:
            fp += 1
        elif expected:
            fn += 1
        if predicted is None or predicted != expected:
            boundaries.append({'after': a['id'], 'before': b['id'], 'expectedBoundary': expected, 'predictedBoundary': predicted})
    coverage = Counter(p['expectedLabel'] for p in photos)
    return {'photoCount': len(photos), 'expectedLabels': dict(coverage),
            'expectedEventCount': len({p['expectedEvent'] for p in photos}),
            'labelAccuracy': correct / len(photos),
            'acceptedLabelAccuracy': accepted_correct / len(accepted) if accepted else None,
            'acceptedCoverage': len(accepted) / len(photos),
            'reviewCount': sum(p['requiresReview'] for p in photos),
            'missingLabelCount': sum(not p.get('predictedLabel') for p in photos),
            'labelErrors': [p['id'] for p in photos if p.get('predictedLabel') != p['expectedLabel']],
            'boundaries': {'truePositive': tp, 'falsePositive': fp, 'falseNegative': fn,
                           'unknown': unknown, 'coverage': (len(photos)-1-unknown)/(len(photos)-1),
                           'precisionOnKnown': tp/(tp+fp) if tp+fp else None,
                           'recallOnKnown': tp/(tp+fn) if tp+fn else None,
                           'issues': boundaries},
            'note': 'Sample metrics only; unknown boundaries are excluded from known-only precision/recall. Check coverage. Labels alone do not establish event grouping.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    args = parser.parse_args()
    print(json.dumps(evaluate(json.loads(args.input.read_text())['photos']), indent=2))


if __name__ == '__main__':
    main()
