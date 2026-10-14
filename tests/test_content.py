import copy
import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.content import ContentError, validate_catalog


def story():
    return """# Q1 — Fixture story

- **Domain**: 1 — Sample
- **Task**: 1.1 — Sample
- **Signal**: \"fixture\"

## Topic
Topic body.
## Why you got it wrong
Misconception body.
## Why the right answer was different
Discriminator body.
## Concepts to nail it next time
Reusable rule.
"""


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def build_fixture(root):
    (root / "cert-one" / "exam-one" / "shared").mkdir(parents=True)
    (root / "cert-one" / "exam-one" / "attempts" / "try-1" / "reports").mkdir(parents=True)
    (root / "cert-one" / "exam-one" / "attempts" / "try-1" / "cards").mkdir(parents=True)
    (root / "cert-one" / "exam-one" / "attempts" / "try-2").mkdir(parents=True)
    (root / "cert-two" / "exam-two" / "attempts" / "try-1").mkdir(parents=True)
    (root / "cert-one" / "exam-one" / "shared" / "guide.md").write_text("# Shared\n", encoding="utf-8")
    (root / "cert-one" / "exam-one" / "attempts" / "try-1" / "reports" / "q1.md").write_text("# Report\n", encoding="utf-8")
    (root / "cert-one" / "exam-one" / "attempts" / "try-1" / "cards" / "q1.md").write_text(story(), encoding="utf-8")
    (root / "cert-two" / "exam-two" / "attempts" / "try-1" / "story.md").write_text(story(), encoding="utf-8")
    write_json(root / "cert-one" / "exam-one" / "exam.json", {
        "schemaVersion": 1, "id": "exam-one", "title": "Exam one",
        "materials": [{"id": "guide", "type": "report", "title": "Shared guide", "path": "shared/guide.md"}],
    })
    for cert, exam, aid, materials, refs in [
        ("cert-one", "exam-one", "try-1", [
            {"id": "report-q1", "type": "report", "title": "Question report", "path": "reports/q1.md", "questionNumber": 1},
            {"id": "story-q1", "type": "story", "title": "Question story", "path": "cards/q1.md", "questionNumber": 1},
        ], [{"scope": "exam", "id": "guide"}, {"scope": "attempt", "id": "report-q1"}, {"scope": "attempt", "id": "story-q1"}]),
        ("cert-one", "exam-one", "try-2", [], [{"scope": "exam", "id": "guide"}]),
    ]:
        write_json(root / cert / exam / "attempts" / aid / "attempt.json", {
            "schemaVersion": 1, "certificationId": cert, "examId": exam, "attemptId": aid,
            "score": {}, "totals": {}, "window": {}, "materials": materials,
            "questions": [{"n": 1, "materials": refs}],
        })
    write_json(root / "cert-two" / "exam-two" / "exam.json", {
        "schemaVersion": 1, "id": "exam-two", "title": "Exam two", "materials": [],
    })
    write_json(root / "cert-two" / "exam-two" / "attempts" / "try-1" / "attempt.json", {
        "schemaVersion": 1, "certificationId": "cert-two", "examId": "exam-two", "attemptId": "try-1",
        "score": {}, "totals": {}, "window": {},
        "materials": [{"id": "story-q1", "type": "story", "title": "Story", "path": "story.md", "questionNumber": 1}],
        "questions": [{"n": 1, "materials": [{"scope": "attempt", "id": "story-q1"}]}],
    })
    write_json(root / "index.json", {
        "schemaVersion": 1,
        "certifications": [
            {"id": "cert-one", "name": "Fixture One", "exams": [{"id": "exam-one", "path": "cert-one/exam-one/exam.json", "attempts": [
                {"id": "try-1", "path": "cert-one/exam-one/attempts/try-1/attempt.json"},
                {"id": "try-2", "path": "cert-one/exam-one/attempts/try-2/attempt.json"},
            ]}]},
            {"id": "cert-two", "name": "Fixture Two", "exams": [{"id": "exam-two", "path": "cert-two/exam-two/exam.json", "attempts": [
                {"id": "try-1", "path": "cert-two/exam-two/attempts/try-1/attempt.json"},
            ]}]},
        ],
    })


class ContentCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        build_fixture(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_accepts_multiple_certifications_exams_attempts_and_material_scopes(self):
        parsed = validate_catalog(self.root)
        self.assertEqual(len(parsed["certifications"]), 2)
        self.assertEqual(len(parsed["certifications"][0]["exams"][0]["attempts"]), 2)

    def test_reports_missing_material_reference_with_attempt_path(self):
        path = self.root / "cert-one/exam-one/attempts/try-1/attempt.json"
        attempt = json.loads(path.read_text())
        attempt["questions"][0]["materials"].append({"scope": "attempt", "id": "missing"})
        write_json(path, attempt)
        with self.assertRaisesRegex(ContentError, r"try-1/attempt.json.*missing"):
            validate_catalog(self.root)

    def test_rejects_traversal_and_missing_material_file(self):
        path = self.root / "cert-one/exam-one/exam.json"
        exam = json.loads(path.read_text())
        exam["materials"][0]["path"] = "../../outside.md"
        write_json(path, exam)
        with self.assertRaisesRegex(ContentError, r"não pode conter '\.\.'"):
            validate_catalog(self.root)

    def test_rejects_duplicate_exam_ids(self):
        path = self.root / "index.json"
        index = json.loads(path.read_text())
        index["certifications"][0]["exams"].append(copy.deepcopy(index["certifications"][0]["exams"][0]))
        write_json(path, index)
        with self.assertRaisesRegex(ContentError, "IDs de simulado"):
            validate_catalog(self.root)

    def test_rejects_duplicate_question_numbers(self):
        path = self.root / "cert-one/exam-one/attempts/try-1/attempt.json"
        attempt = json.loads(path.read_text())
        attempt["questions"].append({"n": 1, "materials": []})
        write_json(path, attempt)
        with self.assertRaisesRegex(ContentError, "número de questão duplicado"):
            validate_catalog(self.root)

    def test_rejects_index_path_that_does_not_match_hierarchy(self):
        path = self.root / "index.json"
        index = json.loads(path.read_text())
        index["certifications"][0]["exams"][0]["path"] = "cert-two/exam-two/exam.json"
        write_json(path, index)
        with self.assertRaisesRegex(ContentError, "deve estar em cert-one/exam-one"):
            validate_catalog(self.root)

    def test_rejects_story_title_that_does_not_match_question_number(self):
        path = self.root / "cert-one/exam-one/attempts/try-1/attempt.json"
        attempt = json.loads(path.read_text())
        attempt["materials"][1]["questionNumber"] = 2
        write_json(path, attempt)
        with self.assertRaisesRegex(ContentError, "não corresponde a questionNumber 2"):
            validate_catalog(self.root)


if __name__ == "__main__":
    unittest.main()
