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
- **Signal**: "fixture"

## Topic
The fixture asks something.

**Your answer (incorrect):** The option that was chosen.

**Correct answer:** The option that was keyed.

## Why you got it wrong
Misconception body.
## Why the right answer was different
Discriminator body.
## Concepts to nail it next time
- A reusable rule.
- Another reusable rule.
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

    def test_rejects_story_without_task_code(self):
        path = self.root / "cert-one/exam-one/attempts/try-1/cards/q1.md"
        path.write_text(story().replace("1.1 — Sample", "architecture decision"), encoding="utf-8")
        with self.assertRaisesRegex(ContentError, "código numérico oficial"):
            validate_catalog(self.root)

    def test_rejects_story_without_answer_disclosure(self):
        path = self.root / "cert-one/exam-one/attempts/try-1/cards/q1.md"
        path.write_text(story().replace("**Correct answer:** The option that was keyed.\n", ""),
                        encoding="utf-8")
        with self.assertRaisesRegex(ContentError, "Correct answer"):
            validate_catalog(self.root)

    def test_rejects_story_without_memorisation_list(self):
        path = self.root / "cert-one/exam-one/attempts/try-1/cards/q1.md"
        path.write_text(story().replace("- A reusable rule.\n- Another reusable rule.\n", "A rule.\n"),
                        encoding="utf-8")
        with self.assertRaisesRegex(ContentError, "itens de lista"):
            validate_catalog(self.root)

    def test_accepts_optional_study_catalog_with_domains_and_lessons(self):
        study_dir = self.root / "sample-study"
        study_dir.mkdir()
        (study_dir / "lesson.md").write_text("# Synthetic lesson\n", encoding="utf-8")
        (study_dir / "story.md").write_text("""# Story — Synthetic decision

- **Story mode**: learning
- **Domain**: backend — Backend
- **Task**: Capacity choice
- **Signal**: The database pool is saturated.

## Topic

**Initial model:** Add unbounded workers.\n**Improved model:** Bound concurrency and shed load.

## Where the initial model breaks

Unbounded workers increase contention.

## A more complete model

Admission control protects the dependency.

## Concepts to nail it next time

- Bound work in flight.
- The sentence to keep: **Protect the bottleneck.**
""", encoding="utf-8")
        write_json(study_dir / "study.json", {
            "schemaVersion": 1, "id": "sample-study", "title": "Synthetic study",
            "domains": [{"id": "backend", "name": "Backend"}],
            "modules": [{"id": "capacity", "title": "Capacity", "domainId": "backend", "lessons": [
                {"id": "deep-dive", "title": "Deep dive", "type": "deep-dive", "path": "lesson.md"},
                {"id": "story", "title": "Story", "type": "story", "path": "story.md"},
            ]}],
        })
        index_path = self.root / "index.json"
        index = json.loads(index_path.read_text())
        index["studies"] = [{"id": "sample-study", "path": "sample-study/study.json"}]
        write_json(index_path, index)
        catalog = validate_catalog(self.root)
        self.assertEqual(catalog["studies"][0]["id"], "sample-study")
        second_story = study_dir / "story-2.md"
        second_story.write_text((study_dir / "story.md").read_text().replace(
            "Synthetic decision", "Synthetic second decision"), encoding="utf-8")
        study = json.loads((study_dir / "study.json").read_text())
        study["modules"][0]["lessons"].append({
            "id": "story-2", "title": "Second story", "type": "story", "path": "story-2.md",
        })
        write_json(study_dir / "study.json", study)
        validate_catalog(self.root)
        self.assertEqual(len(study["modules"][0]["lessons"]), 3)
        story_path = study_dir / "story.md"
        story_text = story_path.read_text(encoding="utf-8")
        story_path.write_text(story_text.replace(
            "- The sentence to keep: **Protect the bottleneck.**",
            "- Protect the bottleneck.",
        ), encoding="utf-8")
        with self.assertRaisesRegex(ContentError, "deve terminar com 'The sentence to keep:'"):
            validate_catalog(self.root)

    def test_rejects_study_story_without_domain_metadata(self):
        study_dir = self.root / "sample-study"
        study_dir.mkdir()
        (study_dir / "story.md").write_text("""# Story — Synthetic decision

- **Task**: Capacity choice
- **Signal**: The database pool is saturated.

## Topic

**Your answer:** Add workers.\n**Correct answer:** Bound concurrency.

## Why you got it wrong

An explanation.

## Why the right answer was different

An explanation.

## Concepts to nail it next time

- Bound work in flight.
- The sentence to keep: **Protect the bottleneck.**
""", encoding="utf-8")
        write_json(study_dir / "study.json", {
            "schemaVersion": 1, "id": "sample-study", "title": "Synthetic study",
            "domains": [{"id": "backend", "name": "Backend"}],
            "modules": [{"id": "capacity", "title": "Capacity", "domainId": "backend", "lessons": [
                {"id": "story", "title": "Story", "type": "story", "path": "story.md"},
            ]}],
        })
        write_json(self.root / "index.json", {"schemaVersion": 1, "certifications": [], "studies": [
            {"id": "sample-study", "path": "sample-study/study.json"},
        ]})
        with self.assertRaisesRegex(ContentError, "metadado Story ausente ou vazio: Domain"):
            validate_catalog(self.root)

    def test_accepts_study_only_catalog_and_domainless_legacy_catalog(self):
        study_dir = self.root / "study-only"
        study_dir.mkdir()
        (study_dir / "lesson.md").write_text("# Lesson\n", encoding="utf-8")
        write_json(study_dir / "study.json", {
            "schemaVersion": 1, "id": "study-only", "title": "Only study",
            "domains": [{"id": "backend", "name": "Backend"}],
            "modules": [{"id": "module-one", "title": "Module", "domainId": "backend", "lessons": [
                {"id": "lesson-one", "title": "Lesson", "type": "case", "path": "lesson.md"},
            ]}],
        })
        write_json(self.root / "index.json", {"schemaVersion": 1, "certifications": [], "studies": [
            {"id": "study-only", "path": "study-only/study.json"},
        ]})
        self.assertEqual(len(validate_catalog(self.root)["certifications"]), 0)

    def test_accepts_study_report_without_question_or_attempt(self):
        self.test_accepts_study_only_catalog_and_domainless_legacy_catalog()
        path = self.root / "study-only" / "study.json"
        study = json.loads(path.read_text())
        study["modules"][0]["lessons"][0]["type"] = "report"
        write_json(path, study)
        validate_catalog(self.root)
        study["modules"][0]["lessons"][0]["path"] = "../cert-one/exam-one/shared/guide.md"
        write_json(path, study)
        with self.assertRaises(ContentError):
            validate_catalog(self.root)

    def test_rejects_unknown_study_domain_and_traversing_lesson_path(self):
        study_dir = self.root / "invalid-study"
        study_dir.mkdir()
        write_json(study_dir / "study.json", {
            "schemaVersion": 1, "id": "invalid-study", "title": "Invalid",
            "domains": [{"id": "backend", "name": "Backend"}],
            "modules": [{"id": "module-one", "title": "Module", "domainId": "missing", "lessons": [
                {"id": "lesson-one", "title": "Lesson", "type": "case", "path": "../outside.md"},
            ]}],
        })
        write_json(self.root / "index.json", {"schemaVersion": 1, "certifications": [], "studies": [
            {"id": "invalid-study", "path": "invalid-study/study.json"},
        ]})
        with self.assertRaisesRegex(ContentError, "domínio inexistente"):
            validate_catalog(self.root)

    def test_validates_explicit_certification_domain_associations(self):
        index_path = self.root / "index.json"
        index = json.loads(index_path.read_text())
        cert = index["certifications"][0]
        cert["domains"] = [{"id": "backend", "name": "Backend"}]
        write_json(index_path, index)
        attempt_path = self.root / "cert-one/exam-one/attempts/try-1/attempt.json"
        attempt = json.loads(attempt_path.read_text())
        attempt["questions"][0]["domainId"] = "backend"
        write_json(attempt_path, attempt)
        validate_catalog(self.root)
        attempt["questions"][0]["domainId"] = "unknown"
        write_json(attempt_path, attempt)
        with self.assertRaisesRegex(ContentError, "domainId referencia domínio inexistente"):
            validate_catalog(self.root)


if __name__ == "__main__":
    unittest.main()
