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
LEARNING_STORY_SECTIONS = (
    "Topic",
    "Where the initial model breaks",
    "A more complete model",
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
    for label in ("Domain", "Task"):
        value = re.search(r"^\s*[-*]\s+\*\*%s\*\*\s*:\s*(.+)$" % label, text, re.MULTILINE)
        if value and not re.match(r"^\d", value.group(1).strip()):
            raise ContentError(
                f"{path}: {label} deve começar pelo código numérico oficial; "
                f"encontrado {value.group(1).strip()!r}")
    topic = parts[0]
    for label in ("Your answer", "Correct answer"):
        if not re.search(r"\*\*%s\b" % label, topic):
            raise ContentError(
                f"{path}: a secção Topic deve declarar '**{label}**' com a resposta do aluno "
                f"e a resposta gabaritada")
    concepts = parts[-1]
    if not re.search(r"^\s*[-*]\s+\S", concepts, re.MULTILINE):
        raise ContentError(
            f"{path}: a secção 'Concepts to nail it next time' precisa de itens de lista para memorização")


def _validate_attempt(attempt_path: Path, certification_id: str, exam_id: str, attempt_id: str,
                      exam_materials: dict, certification_domains: set[str] | None = None):
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
    if certification_domains is not None:
        _validate_material_domains(attempt_materials, certification_domains, attempt_path)
    questions = _array(attempt.get("questions"), attempt_path, "questions")
    qnums = []
    for i, qraw in enumerate(questions):
        q = _object(qraw, attempt_path, f"questions[{i}]")
        n = q.get("n")
        if not isinstance(n, int) or isinstance(n, bool) or n < 1:
            raise ContentError(f"{attempt_path}: questions[{i}].n deve ser inteiro positivo")
        qnums.append(n)
        domain_id = qraw.get("domainId")
        if domain_id is not None and certification_domains is not None and domain_id not in certification_domains:
            raise ContentError(f"{attempt_path}: questions[{i}].domainId referencia domínio inexistente")
        if 'learnerNotes' in q and not isinstance(q['learnerNotes'], str):
            raise ContentError('learnerNotes deve ser texto')
        if 'reviewRequested' in q and not isinstance(q['reviewRequested'], bool):
            raise ContentError('reviewRequested deve ser booleano')
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


def validate_catalog(data_dir: str | Path, *, index_path: str | Path | None = None) -> dict:
    """Validate the complete catalog and return the parsed index."""
    root = Path(data_dir).resolve()
    index_path = Path(index_path).resolve() if index_path is not None else root / "index.json"
    index = _object(_read_json(index_path), index_path, "catálogo")
    if index.get("schemaVersion") != 1:
        raise ContentError(f"{index_path}: schemaVersion deve ser 1")
    certifications = _array(index.get("certifications"), index_path, "certifications")
    studies = _array(index.get("studies", []), index_path, "studies")
    cert_ids = []
    for ci, craw in enumerate(certifications):
        cert = _object(craw, index_path, f"certifications[{ci}]")
        cid = _id(cert.get("id"), index_path, f"certifications[{ci}].id")
        cert_ids.append(cid)
        _text(cert.get("name"), index_path, f"certifications[{ci}].name")
        certification_domains = _validate_domains(cert.get("domains", []), index_path, f"certifications[{ci}].domains")
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
            _validate_material_domains(exam_materials, certification_domains, exam_path)
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
                _validate_attempt(attempt_path, cid, eid, aid, exam_materials, certification_domains)
            _unique(attempt_ids, index_path, f"IDs de tentativa em {cid}/{eid}")
        _unique(exam_ids, index_path, f"IDs de simulado em {cid}")
        if cert.get('preTestReview') is not None:
            try:
                try:
                    from pretest import validate_review, ReviewError
                except ImportError:
                    from tools.pretest import validate_review, ReviewError
                validate_review(root, cert)
            except (ReviewError, ValueError, OSError, KeyError, TypeError) as exc:
                raise ContentError('Pre-Test Review inválido, incompleto ou desatualizado') from exc
    _unique(cert_ids, index_path, "ID de certificação")
    study_ids = []
    for si, raw in enumerate(studies):
        entry = _object(raw, index_path, f"studies[{si}]")
        sid = _id(entry.get("id"), index_path, f"studies[{si}].id")
        study_ids.append(sid)
        study_path = _index_path(root, entry.get("path"), index_path, "study.path", "study.json")
        if study_path.parent.name != sid:
            raise ContentError(f"{index_path}: study.path deve estar em {sid}/")
        study = _object(_read_json(study_path), study_path, "estudo")
        if study.get("schemaVersion") != 1 or study.get("id") != sid:
            raise ContentError(f"{study_path}: schemaVersion/id não correspondem ao contrato e ao índice")
        _text(study.get("title"), study_path, "title")
        domains = _validate_domains(study.get("domains"), study_path, "domains")
        modules = _array(study.get("modules"), study_path, "modules")
        module_ids = []
        for mi, module_raw in enumerate(modules):
            module = _object(module_raw, study_path, f"modules[{mi}]")
            mid = _id(module.get("id"), study_path, f"modules[{mi}].id")
            module_ids.append(mid)
            _text(module.get("title"), study_path, f"modules[{mi}].title")
            _validate_domain_ref(module.get("domainId"), domains, study_path, f"modules[{mi}].domainId")
            lessons = _array(module.get("lessons"), study_path, f"modules[{mi}].lessons")
            lesson_ids = []
            for li, lesson_raw in enumerate(lessons):
                lesson = _object(lesson_raw, study_path, f"modules[{mi}].lessons[{li}]")
                lid = _id(lesson.get("id"), study_path, f"modules[{mi}].lessons[{li}].id")
                lesson_ids.append(lid)
                _text(lesson.get("title"), study_path, f"modules[{mi}].lessons[{li}].title")
                lesson_type = lesson.get("type")
                if lesson_type not in ("deep-dive", "decision-guide", "case", "challenge", "story", "report"):
                    raise ContentError(f"{study_path}: lesson.type inválido em {lid}")
                associations = lesson.get("domainIds", [module.get("domainId")])
                if not isinstance(associations, list) or not associations:
                    raise ContentError(f"{study_path}: {lid}.domainIds deve ser uma lista não vazia")
                for domain_id in associations:
                    _validate_domain_ref(domain_id, domains, study_path, f"{lid}.domainIds")
                _unique(associations, study_path, f"domainIds em {lid}")
                lesson_file = _safe_file(study_path.parent, lesson.get("path"), study_path, f"{lid}.path")
                if lesson_type == "story":
                    _validate_study_story(lesson_file, domains)
            _unique(lesson_ids, study_path, f"IDs de lição em {mid}")
            if not lessons:
                raise ContentError(f"{study_path}: módulo {mid} precisa ter ao menos uma lição")
        _unique(module_ids, study_path, "IDs de módulo")
        if not modules:
            raise ContentError(f"{study_path}: o estudo precisa ter ao menos um módulo")
    _unique(study_ids, index_path, "ID de estudo")
    return {**index, "certifications": certifications, "studies": studies}


def _validate_domains(value, path: Path, label: str) -> set[str]:
    domains = _array(value, path, label)
    ids = []
    for i, raw in enumerate(domains):
        domain = _object(raw, path, f"{label}[{i}]")
        did = _id(domain.get("id"), path, f"{label}[{i}].id")
        ids.append(did)
        _text(domain.get("name"), path, f"{label}[{i}].name")
        if "description" in domain:
            _text(domain["description"], path, f"{label}[{i}].description")
    _unique(ids, path, f"IDs em {label}")
    return set(ids)


def _validate_study_story(path: Path, domains: set[str]):
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise ContentError(f"{path}: não foi possível ler Story de estudo: {exc}") from exc
    learning_mode = re.search(r"^\s*[-*]\s+\*\*Story mode\*\*\s*:\s*learning\s*$", text, re.MULTILINE | re.IGNORECASE)
    expected_sections = LEARNING_STORY_SECTIONS if learning_mode else STORY_SECTIONS
    headings = re.findall(r"^##\s+(.+?)\s*$", text, re.MULTILINE)
    if tuple(headings) != expected_sections:
        raise ContentError(f"{path}: seções Story devem ser {list(expected_sections)!r}; encontradas {headings!r}")
    parts = re.split(r"^##\s+.+?\s*$", text, flags=re.MULTILINE)[1:]
    if not all(part.strip() for part in parts):
        raise ContentError(f"{path}: seção Story vazia")
    lines = text.splitlines()
    if not lines or not re.match(r"^#\s+Story\s+[—–-]\s+.+", lines[0]):
        raise ContentError(f"{path}: Story de estudo deve começar com '# Story — título'")
    metadata = {}
    for label in ("Domain", "Task", "Signal"):
        match = re.search(r"^\s*[-*]\s+\*\*%s\*\*\s*:\s*(.+)$" % label, text, re.MULTILINE)
        if not match or not match.group(1).strip():
            raise ContentError(f"{path}: metadado Story ausente ou vazio: {label}")
        metadata[label] = match.group(1).strip()
    domain_id = metadata["Domain"].split("—", 1)[0].split("–", 1)[0].split("-", 1)[0].strip()
    if domain_id not in domains:
        raise ContentError(f"{path}: Domain de Story de estudo não corresponde a um domínio declarado")
    topic = parts[0]
    # Study Stories can teach a new mental model without pretending that a
    # learner answered a certification question. Keep legacy answer labels
    # valid, while allowing an explicit learning mode with an initial and a
    # more complete model instead.
    if learning_mode:
        for label in ("Initial model", "Improved model"):
            if not re.search(r"\*\*%s\b" % label, topic):
                raise ContentError(f"{path}: Topic de Story learning deve declarar '**{label}**'")
    else:
        for label in ("Your answer", "Correct answer"):
            if not re.search(r"\*\*%s\b" % label, topic):
                raise ContentError(f"{path}: Topic deve declarar '**{label}**' ou declarar Story mode: learning")
    concepts = parts[-1]
    concept_lines = [line.strip() for line in concepts.splitlines() if line.strip()]
    if not any(re.match(r"[-*]\s+\S", line) for line in concept_lines):
        raise ContentError(f"{path}: Concepts to nail it next time precisa de itens de lista")
    if not concept_lines or not re.match(r"[-*]\s+The sentence to keep:", concept_lines[-1]):
        raise ContentError(f"{path}: Concepts to nail it next time deve terminar com 'The sentence to keep:'")


def _validate_domain_ref(value, domains: set[str], path: Path, label: str):
    if not isinstance(value, str) or value not in domains:
        raise ContentError(f"{path}: {label} referencia domínio inexistente")


def _validate_material_domains(materials: dict, domains: set[str], path: Path):
    for material in materials.values():
        associations = material.get("domainIds", [])
        if not isinstance(associations, list):
            raise ContentError(f"{path}: domainIds de material deve ser uma lista")
        for domain_id in associations:
            _validate_domain_ref(domain_id, domains, path, "material.domainIds")
        _unique(associations, path, "domainIds de material")


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
