#!/usr/bin/env python3
"""Pre-publication gate for the white-label source distribution."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def main() -> int:
    problems = []
    try:
        catalog = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"public check failed: cannot read data/index.json: {exc}")
        return 1
    if not isinstance(catalog, dict) or catalog.get("schemaVersion") != 1 or catalog.get("certifications") != []:
        problems.append("data/index.json must use schemaVersion 1 and an empty certifications list")

    for path in DATA.iterdir():
        if path.name == "index.json":
            continue
        relative = path.relative_to(ROOT).as_posix()
        try:
            result = subprocess.run(
                ["git", "check-ignore", "--quiet", "--no-index", relative],
                cwd=ROOT,
                check=False,
            )
        except FileNotFoundError:
            problems.append("Git is required to verify local-content ignore rules")
            break
        if result.returncode != 0:
            problems.append(f"{relative} is not ignored; local content could enter a commit")

    if problems:
        print("public check failed:")
        for problem in problems:
            print(f"- {problem}")
        return 1
    print("public check passed: empty catalog; all other data/ entries are ignored")
    return 0


if __name__ == "__main__":
    sys.exit(main())
