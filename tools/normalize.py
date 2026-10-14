#!/usr/bin/env python3
"""Convert an AWS Skill Builder dump to the normalized v1 attempt format.

Usage:
    python3 tools/normalize.py .raw-attempt.json <certification-id> <exam-id> <attempt-id>

    python3 skillbuilder/tools/normalize.py --patch [attempt_id ...]

The dump comes from the GetUserAssessment GraphQL call the AWS front-end makes.
The data contract and local workflow are documented in docs/diataxis/.

This script never talks to AWS. It only normalizes JSON you already extracted.

--patch exists because the raw dump is disposable. Once an attempt is normalized
you can delete the dump. Patch mode re-links reports and Stories already on disk
to material IDs and question references without changing answers or scores.

This script never talks to AWS. It only normalizes JSON you already extracted.
"""

import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

try:
    from content import SEGMENT, SLUG
except ImportError:
    from tools.content import SEGMENT, SLUG

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")

STATUS = {"correct": "correct", "incorrect": "incorrect", "skipped": "skipped"}

# The four story screens, in the order the deck shows them. A card file has
# exactly these H2s, in this order, or tools/check.py fails.
CARD_SECTIONS = (
    "Topic",
    "Why you got it wrong",
    "Why the right answer was different",
    "Concepts to nail it next time",
)
CARD_DIR = "cards"


def slugify(text, maxlen=52):
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:maxlen].rstrip("-")


def find_notes(attempt_dir):
    """Maps question number -> report Markdown stored for one attempt."""
    notes = {}
    folder = os.path.join(attempt_dir, "reports")
    if not os.path.isdir(folder):
        return notes
    for name in os.listdir(folder):
        m = re.match(r"^q(\d+)-", name)
        if m and name.endswith(".md"):
            notes[int(m.group(1))] = name
    return notes


def find_cards(attempt_dir):
    """Maps question number -> story card file under cards/.

    Cards live in their own folder so the qNN- glob above cannot mistake one for
    a report, and so the folder listing reads as "reports / cards".
    """
    cards = {}
    folder = os.path.join(attempt_dir, CARD_DIR)
    if not os.path.isdir(folder):
        return cards
    for name in os.listdir(folder):
        m = re.match(r"^q(\d+)\.md$", name)
        if m:
            cards[int(m.group(1))] = f"{CARD_DIR}/{name}"
    return cards


def note_topic(path):
    """First H1 of the analysis, minus the leading 'QNN' prefix.

    The UI needs a short human label for each report, and the analysis already
    carries a good one in its title. Reading it keeps the label in one place
    instead of duplicating it in the data.
    """
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("# "):
                    return re.sub(r"^Q\d+\s*[—–-]\s*", "", line[2:].strip())
                if line and not line.startswith("#"):
                    return ""
    except OSError:
        pass
    return ""


def card_head(path):
    """H1 label plus the metadata bullets under it, from a card file.

    A card repeats three facts the app cannot derive from the API: the domain and
    task (which the front-end deliberately does not guess per question) and the
    signal in the stem that gave the answer away.
    """
    topic, meta = "", {}
    try:
        with open(path, encoding="utf-8") as fh:
            in_head = False
            for line in fh:
                line = line.rstrip("\n")
                if not in_head:
                    if line.startswith("# "):
                        topic = re.sub(r"^Q\d+\s*[—–-]\s*", "", line[2:].strip())
                        in_head = True
                    elif line.strip() and not line.startswith("#"):
                        return "", {}
                    continue
                m = re.match(r"^\s*[-*]\s+\*\*(\w+)\*\*\s*:\s*(.+?)\s*$", line)
                if m:
                    meta[m.group(1).lower()] = m.group(2)
                elif line.startswith("#"):
                    break
    except OSError:
        pass
    return topic, meta


def clean_text(text):
    if not text:
        return ""
    # Question text arrives with blank lines used as block separators.
    text = text.replace("\\n", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()


def link_study_files(attempt, certification_id, exam_id, attempt_id):
    """Registers attempt-local reports and Stories as normalized materials.

    Reports only exist for questions you got wrong, so the status has to agree
    with the link. The card can exist for any question, since a card is the fast
    view of one item, and reading a question you already answered is still
    useful revision.
    """
    folder = os.path.join(DATA_DIR, certification_id, exam_id, "attempts", attempt_id)
    notes = find_notes(folder)
    cards = find_cards(folder)
    attempt["schemaVersion"] = 1
    attempt["certificationId"] = certification_id
    attempt["examId"] = exam_id
    attempt["attemptId"] = attempt_id
    kept_materials = [m for m in attempt.get("materials", [])
                     if not str(m.get("id", "")).startswith(("report-q", "story-q"))]
    attempt["materials"] = kept_materials

    for q in attempt["questions"]:
        n = q["n"]
        refs = [r for r in q.get("materials", [])
                if not (r.get("scope") == "attempt" and str(r.get("id", "")).startswith(("report-q", "story-q")))]
        note = notes.get(n) if q["status"] == "incorrect" else None
        if note:
            title = note_topic(os.path.join(folder, "reports", note)) or f"Report Q{n}"
            mid = f"report-q{n:02d}"
            attempt["materials"].append({"id": mid, "type": "report", "title": title,
                                         "path": f"reports/{note}", "questionNumber": n})
            refs.append({"scope": "attempt", "id": mid})
        card = cards.get(n)
        if card:
            title, _ = card_head(os.path.join(folder, card))
            mid = f"story-q{n:02d}"
            attempt["materials"].append({"id": mid, "type": "story", "title": title or f"Story Q{n}",
                                         "path": card, "questionNumber": n})
            refs.append({"scope": "attempt", "id": mid})
        q.pop("note", None)
        q.pop("topic", None)
        q.pop("card", None)
        q.pop("cardTopic", None)
        q.pop("cardMeta", None)
        q["materials"] = refs

    return attempt


def build(raw, attempt_id, certification_id, exam_id, certification_code=None):
    ua = {u["questionId"]: u for u in raw.get("userAnswers", [])}

    tasks = []
    domains = {}
    for lo in sorted(
        raw.get("scoresByLearningObjective", []),
        key=lambda x: (x.get("domainCode", 0), x.get("topicCode", "")),
    ):
        code = lo.get("topicCode") or ""
        name = lo.get("learningObjectiveName") or ""
        dom_code = lo.get("domainCode")
        dom_name = lo.get("domain") or ""
        domains.setdefault(dom_code, {"code": dom_code, "name": dom_name, "questions": 0, "correct": 0, "tasks": []})
        q = lo.get("numQuestions", 0)
        c = lo.get("numQuestionsCorrect", 0)
        domains[dom_code]["questions"] += q
        domains[dom_code]["correct"] += c
        tasks.append(
            {
                "code": code,
                "domainCode": dom_code,
                "domain": dom_name,
                "name": name,
                "questions": q,
                "correct": c,
                "skipped": lo.get("numSkipped", 0),
                "percent": round(100 * c / q, 1) if q else 0.0,
            }
        )

    questions = []
    for idx, q in enumerate(raw.get("questions", [])):
        answer = ua.get(q["id"], {})
        chosen = set(answer.get("selectedAnswerIds") or [])
        score = answer.get("score")
        if score is None:
            status = "skipped"
        elif score > 0:
            status = "correct"
        else:
            status = "incorrect"

        options = [
            {
                "id": a["id"],
                "text": clean_text(a.get("answerText")),
                "correct": bool(a.get("isCorrect")),
                "chosen": a["id"] in chosen,
            }
            for a in q.get("answers", [])
        ]

        matching = None
        if q.get("matchingData") and q["matchingData"].get("statements"):
            # In matching questions selectedAnswerIds uses the composite form
            # "statementId:optionId", one pair per statement.
            md = q["matchingData"]
            picked = {}
            for raw_id in chosen:
                if ":" in raw_id:
                    sid, oid = raw_id.split(":", 1)
                    picked[sid] = oid
            options = [
                {
                    "id": o["id"],
                    "text": clean_text(o.get("text")),
                    "correct": False,
                    "chosen": False,
                    "used": False,
                }
                for o in md.get("answerOptions", [])
            ]
            used = set(picked.values())
            for o in options:
                o["used"] = o["id"] in used
            matching = {
                "statements": [
                    {
                        "id": s["id"],
                        "text": clean_text(s.get("text")),
                        "correctOptionId": s.get("correctAnswerId"),
                        "chosenOptionId": picked.get(s["id"]),
                    }
                    for s in md["statements"]
                ]
            }

        n = idx + 1
        questions.append(
            {
                "n": n,
                "id": q["id"],
                "type": q.get("type") or "Multiple Choice",
                "text": clean_text(q.get("questionText")),
                "options": options,
                "matching": matching,
                "status": status,
                "correctCount": q.get("numCorrect", 1),
                "confidence": answer.get("confidenceLevel"),
                "seconds": answer.get("timeSpentInSeconds"),
                "flagged": bool(answer.get("isFlagged")),
            }
        )

    totals_questions = len(questions)
    correct = sum(1 for q in questions if q["status"] == "correct")
    incorrect = sum(1 for q in questions if q["status"] == "incorrect")
    skipped = sum(1 for q in questions if q["status"] == "skipped")
    total_seconds = sum(q["seconds"] or 0 for q in questions)
    percent = round(100 * correct / totals_questions, 2) if totals_questions else 0.0
    passing = raw.get("passingScore") or 80

    started = raw.get("startTime")
    finished = raw.get("endTime")
    attempt = {
        "schemaVersion": 1,
        "certificationId": certification_id,
        "examId": exam_id,
        "attemptId": attempt_id,
        "date": attempt_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "exam": {
            "title": raw.get("title") or "Skill Builder assessment",
            "certification": certification_code,
            "language": raw.get("language") or "en",
            "assessmentId": raw.get("assessmentId"),
            "version": raw.get("assessmentVersion"),
            "scoreDisplay": raw.get("scoreDisplay") or "Percentage",
            "url": raw.get("url"),
        },
        "score": {
            "percent": percent,
            "passingPercent": passing,
            "passed": percent >= passing,
        },
        "totals": {
            "questions": totals_questions,
            "correct": correct,
            "incorrect": incorrect,
            "skipped": skipped,
            "answered": totals_questions - skipped,
            "timeSpentSeconds": total_seconds,
            "avgSeconds": round(total_seconds / totals_questions, 1) if totals_questions else 0,
        },
        "window": {"startTime": started, "endTime": finished},
        "caveats": [
            "The API does not link each question to a domain or task. The domain and "
            "task figures are official aggregates; individual questions carry no such label."
        ],
        "domains": sorted(
            [
                {
                    **d,
                    "percent": round(100 * d["correct"] / d["questions"], 1) if d["questions"] else 0.0,
                }
                for d in domains.values()
            ],
            key=lambda x: x["code"],
        ),
        "tasks": tasks,
        "questions": questions,
    }
    return link_study_files(attempt, certification_id, exam_id, attempt_id)


def write_json(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


def report(attempt):
    t = attempt["totals"]
    reports = sum(m.get("type") == "report" for m in attempt.get("materials", []))
    cards = sum(m.get("type") == "story" for m in attempt.get("materials", []))
    print(
        f"{attempt['attemptId']}: {t['correct']}/{t['questions']} ({attempt['score']['percent']}%) "
        f"| {t['incorrect']} incorrect | {len(attempt['domains'])} domains | "
        f"{reports} reports | {cards} Stories"
    )


def refresh_manifest(attempt):
    """Adds this attempt path to the certification/exam entry in the catalog."""
    index_path = os.path.join(DATA_DIR, "index.json")
    with open(index_path, encoding="utf-8") as fh:
        index = json.load(fh)
    cert = next((c for c in index.get("certifications", []) if c.get("id") == attempt["certificationId"]), None)
    exam = next((e for e in cert.get("exams", []) if e.get("id") == attempt["examId"]), None) if cert else None
    if not exam:
        raise ValueError(f"index.json does not declare {attempt['certificationId']}/{attempt['examId']}")
    aid = attempt["attemptId"]
    if any(a.get("id") == aid for a in exam.get("attempts", [])):
        raise ValueError(f"attempt ID already exists: {aid}; refusing to overwrite")
    exam.setdefault("attempts", []).append({
        "id": aid,
        "path": f"{attempt['certificationId']}/{attempt['examId']}/attempts/{aid}/attempt.json",
    })
    write_json(index_path, index)


def patch(attempt_ids):
    """Re-link conventionally named reports/Stories without recalculating scores."""
    with open(os.path.join(DATA_DIR, "index.json"), encoding="utf-8") as fh:
        index = json.load(fh)
    wanted = set(attempt_ids)
    for cert in index.get("certifications", []):
        for exam in cert.get("exams", []):
            for entry in exam.get("attempts", []):
                if wanted and entry.get("id") not in wanted:
                    continue
                path = os.path.join(DATA_DIR, entry["path"])
                with open(path, encoding="utf-8") as fh:
                    attempt = json.load(fh)
                link_study_files(attempt, cert["id"], exam["id"], entry["id"])
                write_json(path, attempt)
                report(attempt)
    return 0


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--patch":
        return patch(sys.argv[2:])

    if len(sys.argv) != 5:
        print(__doc__)
        return 1
    raw_path, certification_id, exam_id, attempt_id = sys.argv[1:]
    if not SLUG.fullmatch(certification_id) or not SLUG.fullmatch(exam_id) or not SEGMENT.fullmatch(attempt_id):
        raise SystemExit("certification, exam and attempt IDs must follow the content contract")
    with open(os.path.join(DATA_DIR, "index.json"), encoding="utf-8") as fh:
        index = json.load(fh)
    cert = next((c for c in index.get("certifications", []) if c.get("id") == certification_id), None)
    exam = next((e for e in cert.get("exams", []) if e.get("id") == exam_id), None) if cert else None
    if not exam:
        raise SystemExit(f"index.json must declare {certification_id}/{exam_id} before conversion")
    target = os.path.join(DATA_DIR, certification_id, exam_id, "attempts", attempt_id)
    if not os.path.realpath(target).startswith(os.path.realpath(DATA_DIR) + os.sep):
        raise SystemExit("attempt output path escapes data/")
    if os.path.exists(os.path.join(target, "attempt.json")):
        raise SystemExit(f"attempt already exists; refusing to overwrite: {target}/attempt.json")
    os.makedirs(target, exist_ok=True)
    code = cert.get("code") or certification_id.upper()
    with open(raw_path, encoding="utf-8") as fh:
        raw = json.load(fh)

    attempt = build(raw, attempt_id, certification_id, exam_id, code)
    write_json(os.path.join(target, "attempt.json"), attempt)
    refresh_manifest(attempt)
    report(attempt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
