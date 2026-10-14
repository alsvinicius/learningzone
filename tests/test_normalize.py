import tempfile
import unittest
from pathlib import Path
import sys
import json

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools import normalize


CARD = """# Q1 — Fixture story

- **Domain**: 1 — Sample
- **Task**: 1.1 — Sample
- **Signal**: \"fixture\"

## Topic
Topic body.
## Why you got it wrong
Misconception.
## Why the right answer was different
Discriminator.
## Concepts to nail it next time
Reusable rule.
"""


class NormalizeTests(unittest.TestCase):
    def test_skill_builder_adapter_emits_normalized_material_references(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = normalize.DATA_DIR
            normalize.DATA_DIR = tmp
            try:
                base = Path(tmp) / "sample-cert/mock-1/attempts/source-1"
                (base / "reports").mkdir(parents=True)
                (base / "cards").mkdir()
                (base / "reports/q01-explanation.md").write_text("# Q1 — Report title\n\nAnalysis.\n", encoding="utf-8")
                (base / "cards/q01.md").write_text(CARD, encoding="utf-8")
                attempt = {
                    "questions": [{"n": 1, "status": "incorrect", "note": "old.md", "card": "old-card.md", "topic": "old"}],
                }
                result = normalize.link_study_files(attempt, "sample-cert", "mock-1", "source-1")
                self.assertEqual(result["certificationId"], "sample-cert")
                self.assertEqual(result["examId"], "mock-1")
                self.assertEqual(result["attemptId"], "source-1")
                self.assertEqual(
                    result["questions"][0]["materials"],
                    [{"scope": "attempt", "id": "report-q01"}, {"scope": "attempt", "id": "story-q01"}],
                )
                self.assertEqual([m["type"] for m in result["materials"]], ["report", "story"])
                self.assertNotIn("note", result["questions"][0])
            finally:
                normalize.DATA_DIR = original

    def test_adapter_accepts_catalog_context_and_keeps_source_attempt_id(self):
        raw = {
            "title": "A sample assessment",
            "passingScore": 80,
            "questions": [{"id": "source-q1", "type": "Multiple Choice", "questionText": "Pick one.",
                           "answers": [{"id": "a", "answerText": "Correct", "isCorrect": True},
                                       {"id": "b", "answerText": "Other", "isCorrect": False}]}],
            "userAnswers": [{"questionId": "source-q1", "selectedAnswerIds": ["a"], "score": 1,
                             "confidenceLevel": "CONFIDENT", "timeSpentInSeconds": 15}],
            "scoresByLearningObjective": [],
        }
        result = normalize.build(raw, "source-attempt-7", "sample-cert", "mock-set", "SAMPLE")
        self.assertEqual(result["certificationId"], "sample-cert")
        self.assertEqual(result["examId"], "mock-set")
        self.assertEqual(result["attemptId"], "source-attempt-7")
        self.assertEqual(result["exam"]["certification"], "SAMPLE")
        self.assertEqual(result["questions"][0]["status"], "correct")


if __name__ == "__main__":
    unittest.main()
