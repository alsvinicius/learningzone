"""Validation for the Skill Builder content catalog (schema version 1).

The validator only reads files below the supplied data directory. It has no
third-party dependencies so the same contract can be checked before the app is
opened and by the local authoring workflow.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
STORY_SECTIONS = (
    "Topic",
    "Why you got it wrong",
    "Why the right answer was different",
    "Concepts to nail it next time",
)


class ContentError(ValueError):
    """Raised when a catalog or one of its referenced files violates v1."""


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ContentError(f"{path}: arquivo não encontrado") from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ContentError(f"{path}: JSON inválido: {exc}") from exc


def _object(value, path: Path, label: str):
    if not isinstance(value, dict):
        raise ContentError(f"{path}: {label} deve ser um objeto JSON")
    return value


def _array(value, path: Path, label: str):
    if not isinstance(value, list):
        raise ContentError(f"{path}: {label} deve ser uma lista")
    return value


def _text(value, path: Path, label: str):
    if not isinstance(value, str) or not value.strip():
        raise ContentError(f"{path}: {label} deve ser texto não vazio")
    return value


def _id(value, path: Path, label: str, *, slug=True):
    _text(value, path, label)
    pattern = SLUG if slug else SEGMENT
    if not pattern.fullmatch(value):
        expected = "slug minúsculo com hífens" if slug else "segmento sem separadores de caminho"
        raise ContentError(f"{path}: {label} inválido {value!r}; esperado {expected}")
    return value


def _unique(items, path: Path, label: str):
    seen = set()
    for item in items:
        if item in seen:
            raise ContentError(f"{path}: {label} duplicado: {item!r}")
        seen.add(item)


def _safe_file(base: Path, relative: str, source: Path, label: str) -> Path:
    _text(relative, source, label)
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts or "\\" in relative:
        raise ContentError(f"{source}: {label} deve ser relativo e não pode conter '..': {relative!r}")
    resolved_base = base.resolve()
    target = (base / candidate).resolve()
    if not target.is_relative_to(resolved_base):
        raise ContentError(f"{source}: {label} escapa da pasta de conteúdo: {relative!r}")
    if target.suffix.lower() != ".md":
        raise ContentError(f"{source}: {label} deve apontar para um arquivo .md: {relative!r}")
    if not target.is_file():
        raise ContentError(f"{source}: {label} não encontrado: {relative!r}")
    return target


def _materials(value, owner_file: Path, owner_dir: Path, label: str):
    materials = _array(value, owner_file, label)
    ids = []
    result = {}
    for i, raw in enumerate(materials):
        item = _object(raw, owner_file, f"{label}[{i}]")
        mid = _id(item.get("id"), owner_file, f"{label}[{i}].id")
        _unique(ids + [mid], owner_file, f"ID em {label}")
        ids.append(mid)
        typ = item.get("type")
        if typ not in ("report", "story"):
            raise ContentError(f"{owner_file}: {label}[{i}].type deve ser 'report' ou 'story'")
        _text(item.get("title"), owner_file, f"{label}[{i}].title")
        md = _safe_file(owner_dir, item.get("path"), owner_file, f"{label}[{i}].path")
        question = item.get("questionNumber")
        if question is not None and (not isinstance(question, int) or isinstance(question, bool) or question < 1):
            raise ContentError(f"{owner_file}: {label}[{i}].questionNumber deve ser inteiro positivo")
        if typ == "story":
            _validate_story(md, question)
        result[mid] = {**item, "_file": md}
    return result


def _validate_story(path: Path, question_number=None):
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise ContentError(f"{path}: não foi possível ler Story: {exc}") from exc
    headings = re.findall(r"^##\s+(.+?)\s*$", text, re.MULTILINE)
    if tuple(headings) != STORY_SECTIONS:
        raise ContentError(f"{path}: seções Story devem ser {list(STORY_SECTIONS)!r}; encontradas {headings!r}")
    parts = re.split(r"^##\s+.+?\s*$", text, flags=re.MULTILINE)[1:]
    for name, body in zip(STORY_SECTIONS, parts):
        if not body.strip():
            raise ContentError(f"{path}: seção Story vazia: {name}")
    lines = text.splitlines()
    if not lines or not re.match(r"^#\s+Q\d+\b", lines[0]):
        raise ContentError(f"{path}: Story deve começar com título H1 no formato '# Q<n> — título'")
    title_number = int(re.match(r"^#\s+Q(\d+)\b", lines[0]).group(1))
    if question_number is not None and title_number != question_number:
        raise ContentError(f"{path}: título Q{title_number} não corresponde a questionNumber {question_number}")
    metadata = set(re.findall(r"^\s*[-*]\s+\*\*(Domain|Task|Signal)\*\*\s*:", text, re.MULTILINE))
    missing = {"Domain", "Task", "Signal"} - metadata
    if missing:
        raise ContentError(f"{path}: metadados Story ausentes: {', '.join(sorted(missing))}")


def _validate_attempt(attempt_path: Path, certification_id: str, exam_id: str, attempt_id: str,
                      exam_materials: dict):
    attempt = _object(_read_json(attempt_path), attempt_path, "tentativa")
    if attempt.get("schemaVersion") != 1:
        raise ContentError(f"{attempt_path}: schemaVersion deve ser 1")
    expected = {"certificationId": certification_id, "examId": exam_id, "attemptId": attempt_id}
    for key, value in expected.items():
        if attempt.get(key) != value:
            raise ContentError(f"{attempt_path}: {key} deve ser {value!r}, recebido {attempt.get(key)!r}")
    for key in ("score", "totals", "window"):
        _object(attempt.get(key), attempt_path, key)
    attempt_materials = _materials(attempt.get("materials"), attempt_path, attempt_path.parent, "materials")
    questions = _array(attempt.get("questions"), attempt_path, "questions")
    qnums = []
    for i, qraw in enumerate(questions):
        q = _object(qraw, attempt_path, f"questions[{i}]")
        n = q.get("n")
        if not isinstance(n, int) or isinstance(n, bool) or n < 1:
            raise ContentError(f"{attempt_path}: questions[{i}].n deve ser inteiro positivo")
        qnums.append(n)
        refs = _array(q.get("materials", []), attempt_path, f"questions[{i}].materials")
        seen = set()
        for ri, refraw in enumerate(refs):
            ref = _object(refraw, attempt_path, f"questions[{i}].materials[{ri}]")
            scope, mid = ref.get("scope"), ref.get("id")
            if scope not in ("exam", "attempt"):
                raise ContentError(f"{attempt_path}: referência de material deve ter scope 'exam' ou 'attempt'")
            if not isinstance(mid, str) or not mid:
                raise ContentError(f"{attempt_path}: referência de material sem ID")
            key = (scope, mid)
            if key in seen:
                raise ContentError(f"{attempt_path}: referência de material duplicada na questão {n}: {key}")
            seen.add(key)
            available = exam_materials if scope == "exam" else attempt_materials
            if mid not in available:
                raise ContentError(f"{attempt_path}: questão {n} referencia material {scope}:{mid} inexistente")
    _unique(qnums, attempt_path, "número de questão")
    for mid, material in {**exam_materials, **attempt_materials}.items():
        qn = material.get("questionNumber")
        if qn is not None and qn not in qnums:
            raise ContentError(f"{material['_file']}: questionNumber {qn} não existe em {attempt_path}")
    return attempt


def validate_catalog(data_dir: str | Path) -> dict:
    """Validate the complete catalog and return the parsed index."""
    root = Path(data_dir).resolve()
    index_path = root / "index.json"
    index = _object(_read_json(index_path), index_path, "catálogo")
    if index.get("schemaVersion") != 1:
        raise ContentError(f"{index_path}: schemaVersion deve ser 1")
    certifications = _array(index.get("certifications"), index_path, "certifications")
    cert_ids = []
    for ci, craw in enumerate(certifications):
        cert = _object(craw, index_path, f"certifications[{ci}]")
        cid = _id(cert.get("id"), index_path, f"certifications[{ci}].id")
        cert_ids.append(cid)
        _text(cert.get("name"), index_path, f"certifications[{ci}].name")
        exams = _array(cert.get("exams"), index_path, f"certifications[{ci}].exams")
        exam_ids = []
        for ei, eraw in enumerate(exams):
            entry = _object(eraw, index_path, f"certifications[{ci}].exams[{ei}]")
            eid = _id(entry.get("id"), index_path, f"exam[{ei}].id")
            exam_ids.append(eid)
            exam_path = _index_path(root, entry.get("path"), index_path, "exam.path", "exam.json")
            if exam_path.parent.name != eid or exam_path.parent.parent.name != cid:
                raise ContentError(f"{index_path}: exam.path {entry.get('path')!r} deve estar em {cid}/{eid}/")
            exam = _object(_read_json(exam_path), exam_path, "simulado")
            if exam.get("schemaVersion") != 1 or exam.get("id") != eid:
                raise ContentError(f"{exam_path}: schemaVersion/id não correspondem ao contrato e ao índice")
            _text(exam.get("title"), exam_path, "title")
            exam_materials = _materials(exam.get("materials"), exam_path, exam_path.parent, "materials")
            attempts = _array(entry.get("attempts"), index_path, f"{eid}.attempts")
            attempt_ids = []
            for ai, araw in enumerate(attempts):
                aentry = _object(araw, index_path, f"{eid}.attempts[{ai}]")
                aid = _id(aentry.get("id"), index_path, f"{eid}.attempts[{ai}].id", slug=False)
                attempt_ids.append(aid)
                attempt_path = _index_path(root, aentry.get("path"), index_path, "attempt.path", "attempt.json")
                if (attempt_path.parent.name != aid or attempt_path.parent.parent.name != "attempts"
                        or attempt_path.parent.parent.parent.name != eid
                        or attempt_path.parent.parent.parent.parent.name != cid):
                    raise ContentError(f"{index_path}: attempt.path {aentry.get('path')!r} deve estar em {cid}/{eid}/attempts/{aid}/")
                _validate_attempt(attempt_path, cid, eid, aid, exam_materials)
            _unique(attempt_ids, index_path, f"IDs de tentativa em {cid}/{eid}")
        _unique(exam_ids, index_path, f"IDs de simulado em {cid}")
    _unique(cert_ids, index_path, "ID de certificação")
    return index


def _index_path(root: Path, relative: str, source: Path, label: str, filename: str) -> Path:
    _text(relative, source, label)
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts or "\\" in relative:
        raise ContentError(f"{source}: {label} deve ser relativo e não pode conter '..': {relative!r}")
    target = (root / candidate).resolve()
    if not target.is_relative_to(root) or target.name != filename:
        raise ContentError(f"{source}: {label} deve apontar para {filename} dentro de data/: {relative!r}")
    if not target.is_file():
        raise ContentError(f"{source}: {label} não encontrado: {relative!r}")
    return target
