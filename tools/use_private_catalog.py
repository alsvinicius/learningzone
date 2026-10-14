#!/usr/bin/env python3
"""Activate a locally saved catalog; never included in the white-label release."""

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRIVATE_INDEX = ROOT / ".local" / "private-data" / "index.personal.json"
PUBLIC_INDEX = ROOT / "data" / "index.json"


def main() -> int:
    if not PRIVATE_INDEX.is_file():
        print(
            "No local catalog backup found. Add content using the Diátaxis guide; "
            "this command only works when .local/private-data/index.personal.json exists.",
            file=sys.stderr,
        )
        return 1
    shutil.copyfile(PRIVATE_INDEX, PUBLIC_INDEX)
    print("Activated the ignored local catalog in data/index.json.")
    print("Run make check-public before creating a public source distribution.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
