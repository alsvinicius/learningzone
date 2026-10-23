import copy
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from tools.content import ContentError, validate_catalog
from tools.pretest import ReviewError, digest, reasons, snapshot, validate_review
from tools.normalize import learner_notes


FIXTURE = Path(__file__).parent / 'fixtures/pretest'


class PreTestReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        shutil.copytree(FIXTURE, self.root, dirs_exist_ok=True)
        self.index = json.loads((self.root / 'index.json').read_text())
        self.cert = self.index['certifications'][0]
        self.folder = self.root / 'sample-cert/pre-test-review'
        self.folder.mkdir()
        shutil.copy(self.root / 'review.md', self.folder / 'review.md')
        self.cert['preTestReview'] = {'path': 'pre-test-review/review.json'}
        inputs = snapshot(self.root, self.cert)
        self.review = {
            'schemaVersion': 1, 'certificationId': self.cert['id'],
            'updatedAt': '2026-10-20T12:00:00Z', 'contentPath': 'review.md',
            'contentSha256': digest((self.folder / 'review.md').read_bytes()),
            'inputs': inputs, 'gaps': [],
            'topics': [{'id': 'timeouts', 'heading': 'Timeout boundaries'}],
            'coverage': [{**{k: q[k] for k in ('examId', 'attemptId', 'questionNumber')},
                          'topicIds': ['timeouts']} for q in inputs['eligibleQuestions']],
        }
        self.write()

    def tearDown(self):
        self.temp.cleanup()

    def write(self):
        (self.root / 'index.json').write_text(json.dumps(self.index))
        (self.folder / 'review.json').write_text(json.dumps(self.review))

    def test_all_signals_including_correct_guesses_and_notes_are_covered(self):
        parsed = validate_review(self.root, self.cert)
        self.assertEqual(len(parsed['coverage']), 6)
        self.assertFalse(parsed['_stale'])
        validate_catalog(self.root)
        self.assertEqual(reasons({'status': 'correct', 'learnerNotes': 'Not a request', 'reviewRequested': False}), [])

    def test_legacy_catalog_without_review_is_valid(self):
        del self.cert['preTestReview']
        self.write()
        self.assertIsNone(validate_review(self.root, self.cert))
        validate_catalog(self.root)

    def test_missing_coverage_is_rejected(self):
        self.review['coverage'].pop()
        self.write()
        with self.assertRaisesRegex(ReviewError, 'every eligible'):
            validate_review(self.root, self.cert)

    def test_pending_is_explicit_not_silently_omitted(self):
        self.review['coverage'][0] = {**self.review['coverage'][0], 'topicIds': [], 'pending': 'Source explanation unavailable.'}
        self.write()
        validate_review(self.root, self.cert)
        del self.review['coverage'][0]['pending']
        self.write()
        with self.assertRaises(ReviewError):
            validate_review(self.root, self.cert)

    def test_unknown_topic_or_question_is_rejected(self):
        for change in ({'topicIds': ['unknown']}, {'examId': 'other-exam'}):
            original = copy.deepcopy(self.review['coverage'][0])
            self.review['coverage'][0].update(change)
            self.write()
            with self.assertRaises(ReviewError):
                validate_review(self.root, self.cert)
            self.review['coverage'][0] = original

    def test_changed_attempt_and_added_attempt_make_review_stale(self):
        path = self.root / 'sample-cert/mock-one/attempts/try-1/attempt.json'
        path.write_text(path.read_text() + '\n')
        with self.assertRaisesRegex(ReviewError, 'stale'):
            validate_review(self.root, self.cert)
        self.assertTrue(validate_review(self.root, self.cert, allow_stale=True)['_stale'])

    def test_same_question_number_in_different_attempts_has_distinct_identity(self):
        exam = self.cert['exams'][0]
        source = self.root / exam['attempts'][0]['path']
        target = source.parent.parent / 'try-2/attempt.json'
        target.parent.mkdir()
        data = json.loads(source.read_text()); data['attemptId'] = 'try-2'
        target.write_text(json.dumps(data))
        exam['attempts'].append({'id': 'try-2', 'path': target.relative_to(self.root).as_posix()})
        with self.assertRaisesRegex(ReviewError, 'stale'):
            validate_review(self.root, self.cert)
        snap = snapshot(self.root, self.cert)
        self.assertEqual(len(snap['eligibleQuestions']), 12)

    def test_changed_shared_material_is_detected(self):
        ep = self.root / self.cert['exams'][0]['path']
        guide = ep.parent / 'guide.md'; guide.write_text('Synthetic guide')
        exam = json.loads(ep.read_text())
        exam['materials'] = [{'id': 'guide', 'type': 'report', 'title': 'Guide', 'path': 'guide.md'}]
        ep.write_text(json.dumps(exam))
        self.review['inputs'] = snapshot(self.root, self.cert); self.write()
        guide.write_text('Updated synthetic guide')
        with self.assertRaisesRegex(ReviewError, 'stale'):
            validate_review(self.root, self.cert)

    def test_content_hash_and_heading_are_checked(self):
        path = self.folder / 'review.md'; path.write_text('Changed')
        with self.assertRaisesRegex(ReviewError, 'fingerprint'):
            validate_review(self.root, self.cert)
        self.review['contentSha256'] = digest(path.read_bytes()); self.write()
        with self.assertRaisesRegex(ReviewError, 'priorities'):
            validate_review(self.root, self.cert)

    def test_traversal_and_symlink_escape_are_rejected(self):
        for path in ('../other/review.json', '/tmp/review.json', 'pre-test-review/%2e%2e/review.json', 'pre-test-review\\review.json'):
            self.cert['preTestReview']['path'] = path
            with self.assertRaises(ReviewError):
                validate_review(self.root, self.cert)
        outside = Path(self.temp.name).parent / 'review-outside.json'
        outside.write_text('{}')
        try:
            (self.folder / 'escape.json').symlink_to(outside)
            self.cert['preTestReview']['path'] = 'pre-test-review/escape.json'
            with self.assertRaises(ReviewError):
                validate_review(self.root, self.cert)
        finally:
            outside.unlink()

    def test_errors_do_not_include_personal_notes(self):
        self.review['coverage'] = []; self.write()
        with self.assertRaises(ContentError) as caught:
            validate_catalog(self.root)
        self.assertNotIn('timeout rule', str(caught.exception))

    def test_notes_are_preserved_without_confusing_rationale_with_annotations(self):
        source = json.loads((FIXTURE / 'annotations.json').read_text())
        self.assertEqual(learner_notes(source['answer']), source['expected'])

    def test_reviewed_status_cannot_hide_editorial_pending_items(self):
        self.review['editorialStatus'] = 'reviewed'
        self.review['coverage'][0].update({'topicIds': [], 'pending': 'Explanation unavailable.'})
        self.write()
        with self.assertRaisesRegex(ReviewError, 'cannot be marked reviewed'):
            validate_review(self.root, self.cert)

    def test_private_index_can_be_validated_without_replacing_public_index(self):
        private = self.root / 'private-index.json'
        private.write_text(json.dumps(self.index))
        public = {'schemaVersion': 1, 'certifications': []}
        (self.root / 'index.json').write_text(json.dumps(public))
        self.assertEqual(len(validate_catalog(self.root, index_path=private)['certifications']), 1)
        self.assertEqual(json.loads((self.root / 'index.json').read_text()), public)

    def test_invalid_report_reference_is_rejected(self):
        self.review['coverage'][0]['reportId'] = 'missing-report'
        self.write()
        with self.assertRaisesRegex(ReviewError, 'report reference'):
            validate_review(self.root, self.cert)

    def test_optional_primary_references_require_safe_https_urls(self):
        topic = self.review['topics'][0]
        topic['references'] = [{'title': 'Synthetic reference', 'url': 'https://example.org/reference'}]
        self.write()
        validate_review(self.root, self.cert)
        for url in ('javascript:alert(1)', 'http://example.org', 'https://user:secret@example.org', None, 'https://[broken', 'https://example.org/a b'):
            topic['references'][0]['url'] = url
            self.write()
            with self.assertRaises(ReviewError):
                validate_review(self.root, self.cert)

    def test_standalone_validator_rejects_unsafe_catalogue_identity(self):
        self.cert['id'] = '../outside'
        with self.assertRaisesRegex(ReviewError, 'identity'):
            validate_review(self.root, self.cert)

    def test_reading_documents_validate_integrity_and_full_review_identity(self):
        self.review['readingVersions'] = []
        for minutes in (10, 30, 60):
            path = 'review.md' if minutes == 60 else f'review-{minutes}.md'
            if minutes != 60:
                (self.folder / path).write_text('# Review\n\n## Last-minute priorities\n\n- Check the synthetic boundary.\n')
            self.review['readingVersions'].append({'minutes': minutes, 'contentPath': path,
                'contentSha256': digest((self.folder / path).read_bytes())})
        self.write()
        validate_review(self.root, self.cert)
        (self.folder / 'review-10.md').write_text('Corrupt')
        with self.assertRaisesRegex(ReviewError, 'fingerprint'):
            validate_review(self.root, self.cert)
        self.review['readingVersions'][0]['contentPath'] = '../escape.md'
        self.write()
        with self.assertRaises(ReviewError):
            validate_review(self.root, self.cert)
