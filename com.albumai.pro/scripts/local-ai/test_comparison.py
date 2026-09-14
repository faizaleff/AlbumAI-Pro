import unittest
from compare_models import group, representatives

class ComparisonTests(unittest.TestCase):
    def test_separates_scenes_and_review(self):
        rows = [{'id':0,'label':'Ceremony','embedding':[1.,0.],'requiresReview':False},
                {'id':1,'label':'Ceremony','embedding':[0.,1.],'requiresReview':False},
                {'id':2,'label':'Ceremony','embedding':[1.,0.],'requiresReview':True},
                {'id':3,'label':'Ceremony','embedding':[1.,0.],'requiresReview':False}]
        self.assertEqual([g['ids'] for g in group(rows)],[[0,3],[1]])
    def test_representatives_cover_group(self):
        self.assertEqual(representatives([4]),[4])
        self.assertEqual(representatives([4,5]),[4,5])
        self.assertEqual(representatives([4,5,6,7,8]),[4,6,8])

if __name__=='__main__':unittest.main()
