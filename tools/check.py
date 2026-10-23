#!/usr/bin/env python3
"""Validate the v1 content catalog, normalized attempts, Stories and PWA shell."""

import json
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

problems = []


def fail(msg):
    problems.append(msg)


def check_pwa():
    """The front-end is installable and the deck works offline: manifest,
    icons, service worker and the wiring between index.html and app.js."""
    manifest_path = os.path.join(ROOT, "manifest.webmanifest")
    if not os.path.exists(manifest_path):
        fail("manifest.webmanifest is missing")
        return
    try:
        with open(manifest_path, encoding="utf-8") as fh:
            manifest = json.load(fh)
    except json.JSONDecodeError as err:
        fail(f"manifest.webmanifest is not valid JSON: {err}")
        return

    for key in ("name", "short_name", "start_url", "display", "icons"):
        if not manifest.get(key):
            fail(f"manifest.webmanifest has no {key}")
    if manifest.get("display") != "standalone":
        fail(f"manifest display is {manifest.get('display')!r}, expected 'standalone'")

    sizes = {}
    for icon in manifest.get("icons", []):
        src = icon.get("src", "")
        path = os.path.join(ROOT, src)
        if not os.path.exists(path):
            fail(f"manifest icon {src} is missing from disk")
            continue
        sizes[icon.get("sizes", "")] = icon.get("purpose", "any")
    if "192x192" not in sizes:
        fail("manifest has no 192x192 icon")
    if "512x512" not in sizes or "any" not in sizes.values():
        fail("manifest has no 512x512 installable icon")
    if not any("maskable" in str(icon.get("purpose", "")) for icon in manifest.get("icons", [])):
        fail("manifest has no maskable icon")

    sw_path = os.path.join(ROOT, "sw.js")
    if not os.path.exists(sw_path):
        fail("sw.js is missing")
    else:
        with open(sw_path, encoding="utf-8") as fh:
            sw = fh.read()
    for needle in ("index.html", "app.js", "progress.js", "cache-utils.js", "app.css", "navigationPreload", "CACHE_URLS", "SKIP_WAITING"):
            if needle not in sw:
                fail(f"sw.js does not mention {needle}")

    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as fh:
        html = fh.read()
    for needle in ("manifest.webmanifest", "progress.js", "sw.js", "installBtn", "offlineBtn", "apple-touch-icon", 'name="theme-color"'):
        if needle not in html:
            fail(f"index.html does not mention {needle}")

    with open(os.path.join(ROOT, "app.js"), encoding="utf-8") as fh:
        js = fh.read()
    for needle in ("wirePwa", "storyUrls", "saveOffline", "beforeinstallprompt", "refreshOfflineUi"):
        if needle not in js:
            fail(f"app.js does not mention {needle}")


def check_normalized_attempt(path, attempt):
    questions = attempt.get("questions", [])
    if not questions:
        fail(f"{path}: tentativa sem questões")
        return
    numbers = [q.get("n") for q in questions]
    if len(numbers) != len(set(numbers)):
        fail(f"{path}: números de questão duplicados")
    statuses = {status: sum(q.get("status") == status for q in questions)
                for status in ("correct", "incorrect", "skipped")}
    if any(not q.get("text") for q in questions):
        fail(f"{path}: questão sem enunciado")
    if any(q.get("status") not in statuses for q in questions):
        fail(f"{path}: status de questão deve ser correct, incorrect ou skipped")

    totals = attempt["totals"]
    expected = {"questions": len(questions), **statuses,
                "answered": len(questions) - statuses["skipped"]}
    for key, got in expected.items():
        if totals.get(key) != got:
            fail(f"{path}: totals.{key}={totals.get(key)!r}, esperado {got}")
    seconds = sum(q.get("seconds") or 0 for q in questions)
    if totals.get("timeSpentSeconds") != seconds:
        fail(f"{path}: totals.timeSpentSeconds={totals.get('timeSpentSeconds')!r}, esperado {seconds}")
    avg = round(seconds / len(questions), 1)
    if totals.get("avgSeconds") != avg:
        fail(f"{path}: totals.avgSeconds={totals.get('avgSeconds')!r}, esperado {avg}")

    score = attempt["score"]
    percent = score.get("percent")
    calculated = round(100 * statuses["correct"] / len(questions), 2)
    if percent != calculated:
        fail(f"{path}: score.percent={percent!r}, esperado {calculated}")
    passing = score.get("passingPercent")
    if passing is not None and score.get("passed") is not None and score["passed"] != (percent >= passing):
        fail(f"{path}: score.passed não corresponde ao passingPercent")

    for domain in attempt.get("domains", []):
        tasks = [task for task in attempt.get("tasks", []) if task.get("domainCode") == domain.get("code")]
        if domain.get("questions") != sum(task.get("questions", 0) for task in tasks):
            fail(f"{path}: total de questões do domínio {domain.get('code')} diverge das tasks")
        if domain.get("correct") != sum(task.get("correct", 0) for task in tasks):
            fail(f"{path}: total de corretas do domínio {domain.get('code')} diverge das tasks")

    for q in questions:
        options = q.get("options", [])
        if not isinstance(options, list):
            fail(f"{path}: questão {q.get('n')} options deve ser lista")
            continue
        option_ids = [option.get("id") for option in options]
        if len(option_ids) != len(set(option_ids)):
            fail(f"{path}: questão {q.get('n')} tem IDs de opção duplicados")
        if q.get("matching"):
            matching = q["matching"]
            statements = matching.get("statements", [])
            if len(options) < len(statements):
                fail(f"{path}: questão {q.get('n')} tem menos opções do que statements")
            if any(not s.get("chosenOptionId") for s in statements):
                fail(f"{path}: questão {q.get('n')} tem statement sem par selecionado")
        elif q.get("status") in ("correct", "incorrect"):
            chosen = [o for o in options if o.get("chosen")]
            correct = [o for o in options if o.get("correct")]
            if not chosen:
                fail(f"{path}: questão {q.get('n')} respondida sem opção selecionada")
            if q["status"] == "correct" and not any(o.get("correct") and o.get("chosen") for o in options):
                fail(f"{path}: questão {q.get('n')} marcada correta sem seleção correta")
            if q["status"] == "incorrect" and correct and not any(o.get("chosen") for o in options):
                fail(f"{path}: questão {q.get('n')} incorreta sem resposta marcada")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', default=os.path.join(DATA, 'index.json'))
    parser.add_argument('--quiet', action='store_true', help='Print only aggregate results, without private paths or error details')
    args = parser.parse_args()
    problems.clear()
    index_path = args.index
    if not os.path.exists(index_path):
        print('Catalog index unavailable' if args.quiet else f"nothing at {index_path}")
        return 1

    with open(index_path, encoding="utf-8") as fh:
        manifest = json.load(fh)

    if manifest.get("schemaVersion") == 1:
        try:
            from content import ContentError, validate_catalog

            catalog = validate_catalog(DATA, index_path=index_path)
        except ContentError as err:
            fail(str(err))
            catalog = {"certifications": []}
        except ImportError:
            from tools.content import ContentError, validate_catalog

            try:
                catalog = validate_catalog(DATA, index_path=index_path)
            except ContentError as err:
                fail(str(err))
                catalog = {"certifications": []}

        count = 0
        for certification in catalog["certifications"]:
            for exam in certification["exams"]:
                for entry in exam["attempts"]:
                    attempt_path = os.path.join(DATA, entry["path"])
                    with open(attempt_path, encoding="utf-8") as fh:
                        attempt = json.load(fh)
                    questions = attempt.get("questions", [])
                    check_normalized_attempt(attempt_path, attempt)
                    if not questions:
                        continue
                    status_counts = {status: sum(q.get("status") == status for q in questions)
                                     for status in ("correct", "incorrect", "skipped")}
                    score = attempt["score"]
                    percent = score.get("percent")
                    count += 1
                    if not args.quiet:
                        print(f"  {certification['id']}/{exam['id']}/{entry['id']}  "
                              f"{status_counts['correct']}/{len(questions)} ({percent}%)")
        check_pwa()
        if problems:
            if args.quiet:
                print(f'Catalog check failed: {len(problems)} problem(s); inspect privately')
                return 1
            print("\nproblems found:")
            for problem in problems:
                print(f"  - {problem}")
            return 1
        print(f"\nok: {count} attempt(s), {len(catalog['certifications'])} certification(s)")
        return 0

    fail(f"{index_path}: catálogo legado não é aceito; use schemaVersion 1")
    if problems:
        if args.quiet:
            print(f'Catalog check failed: {len(problems)} problem(s); inspect privately')
            return 1
        print("\nproblems found:")
        for problem in problems:
            print(f"  - {problem}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
