"""Deterministic coverage and freshness checks; never writes the study synthesis."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit


class ReviewError(ValueError):
    pass


def check_ids(cert):
    slug = r'[a-z0-9]+(?:-[a-z0-9]+)*'
    segment = r'[A-Za-z0-9][A-Za-z0-9._-]*'
    def valid(value, pattern):
        return isinstance(value, str) and re.fullmatch(pattern, value)
    if not valid(cert.get('id'), slug):
        raise ReviewError('Invalid certification identity')
    for exam in cert['exams']:
        if not valid(exam.get('id'), slug):
            raise ReviewError('Invalid exam identity')
        for entry in exam['attempts']:
            if not valid(entry.get('id'), segment):
                raise ReviewError('Invalid attempt identity')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def catalog_digest(cert):
    # A small, language-independent representation is also used in pretest.js.
    shape = [cert['id'], [[e['id'], e['path'], [[a['id'], a['path']] for a in e['attempts']]]
                         for e in cert['exams']]]
    return digest(json.dumps(shape, ensure_ascii=False, separators=(',', ':')).encode())


def safe_path(root, relative, *, suffix=None):
    if not isinstance(relative, str) or not relative or '\\' in relative or '%' in relative:
        raise ReviewError('Invalid review path')
    p = Path(relative)
    if p.is_absolute() or any(part in ('..', '.') for part in relative.split('/')):
        raise ReviewError('Review paths must stay within their owner directory')
    resolved = (root / p).resolve()
    if not resolved.is_relative_to(root.resolve()) or (suffix and resolved.suffix != suffix):
        raise ReviewError('Review path escapes its owner or has an invalid extension')
    if not resolved.is_file():
        raise ReviewError('A required review input is missing')
    return resolved


def reasons(q):
    result = []
    if q.get('status') in ('incorrect', 'skipped'):
        result.append(q['status'])
    if q.get('confidence') in ('EDUCATED_GUESS', 'UNSURE'):
        result.append(q['confidence'].lower())
    if q.get('flagged'):
        result.append('flagged')
    # Retain notes conservatively unless an editor explicitly classified them.
    if q.get('reviewRequested', bool(str(q.get('learnerNotes') or '').strip())):
        result.append('requested')
    return result


def snapshot(root, cert):
    root = Path(root).resolve()
    check_ids(cert)
    sources = {}
    eligible = []
    attempts = []

    def read(path):
        data = path.read_bytes()
        sources[path.relative_to(root).as_posix()] = digest(data)
        return data

    for exam in cert['exams']:
        ep = safe_path(root, exam['path'], suffix='.json')
        if ep != root / cert['id'] / exam['id'] / 'exam.json':
            raise ReviewError('Invalid exam ownership')
        ed = json.loads(read(ep))
        for material in ed.get('materials', []):
            read(safe_path(ep.parent, material['path'], suffix='.md'))
        for entry in exam['attempts']:
            ap = safe_path(root, entry['path'], suffix='.json')
            if ap != ep.parent / 'attempts' / entry['id'] / 'attempt.json':
                raise ReviewError('Invalid attempt ownership')
            attempt = json.loads(read(ap))
            attempts.append({'examId': exam['id'], 'attemptId': entry['id']})
            for material in attempt.get('materials', []):
                read(safe_path(ap.parent, material['path'], suffix='.md'))
            for q in attempt['questions']:
                why = reasons(q)
                if why:
                    eligible.append({'examId': exam['id'], 'attemptId': entry['id'],
                                     'questionNumber': q['n'], 'reasons': why})
    return {'catalogFingerprint': catalog_digest(cert), 'sources': sources,
            'attempts': attempts, 'eligibleQuestions': eligible}


def question_key(q):
    return (q.get('examId'), q.get('attemptId'), q.get('questionNumber'))


def validate_review(root, cert, *, allow_stale=False):
    """Return the manifest; errors deliberately avoid exposing catalog content."""
    root = Path(root).resolve()
    check_ids(cert)
    descriptor = cert.get('preTestReview')
    if descriptor is None:
        return None
    if not isinstance(descriptor, dict):
        raise ReviewError('preTestReview must be an object')
    path = safe_path(root / cert['id'], descriptor.get('path'), suffix='.json')
    review = json.loads(path.read_text())
    if review.get('schemaVersion') != 1 or review.get('certificationId') != cert['id']:
        raise ReviewError('Review schema or certification identity is invalid')
    if review.get('editorialStatus', 'draft') not in ('draft', 'reviewed'):
        raise ReviewError('Review editorialStatus must be draft or reviewed')
    try:
        datetime.fromisoformat(review['updatedAt'].replace('Z', '+00:00'))
    except (KeyError, ValueError, TypeError, AttributeError):
        raise ReviewError('Review updatedAt must be an ISO timestamp') from None
    md = safe_path(path.parent, review.get('contentPath'), suffix='.md')
    text = md.read_text()
    if review.get('contentSha256') != digest(md.read_bytes()):
        raise ReviewError('Review content fingerprint does not match')
    headings = re.findall(r'^## (.+)$', text, re.M)
    if not headings or headings[0] != 'Last-minute priorities':
        raise ReviewError('Review must start with Last-minute priorities')
    if not re.search(r'^-\s+\S', text, re.M):
        raise ReviewError('Review must contain study bullets')
    topics = review.get('topics')
    coverage = review.get('coverage')
    gaps = review.get('gaps')
    if not isinstance(topics, list) or not isinstance(coverage, list) or not isinstance(gaps, list):
        raise ReviewError('Review topics, coverage and gaps must be arrays')
    if any(not isinstance(g, str) or not g.strip() for g in gaps):
        raise ReviewError('Review gaps must be nonempty descriptions')
    topic_ids = set()
    sections = {}
    for section in re.split(r'^## ', text, flags=re.M)[1:]:
        heading, _, body = section.partition('\n')
        if heading in sections:
            raise ReviewError('Review section headings must be unique')
        sections[heading] = body
    for topic in topics:
        if not isinstance(topic, dict) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', str(topic.get('id', ''))):
            raise ReviewError('Review topic ID is invalid')
        if topic['id'] in topic_ids or topic.get('heading') not in headings:
            raise ReviewError('Review topics must be unique and reference existing headings')
        if not re.search(r'^-\s+\S', sections[topic['heading']], re.M):
            raise ReviewError('Every review topic needs study bullets')
        references = topic.get('references', [])
        if not isinstance(references, list):
            raise ReviewError('Review topic references must be an array')
        for reference in references:
            if not isinstance(reference, dict) or not isinstance(reference.get('title'), str) or not reference['title'].strip():
                raise ReviewError('Review reference needs a title')
            raw_url = reference.get('url')
            try:
                url = urlsplit(raw_url) if isinstance(raw_url, str) else None
                valid_url = url is not None and url.scheme == 'https' and url.hostname and not url.username and not url.password and not re.search(r'[\s\\]', raw_url)
            except ValueError:
                valid_url = False
            if not valid_url:
                raise ReviewError('Review references must use public HTTPS URLs without credentials')
        topic_ids.add(topic['id'])
    saved = review.get('inputs')
    if not isinstance(saved, dict) or not isinstance(saved.get('eligibleQuestions'), list):
        raise ReviewError('Review input snapshot is missing')
    expected = {question_key(q): q for q in saved['eligibleQuestions']}
    reports = {}
    for exam in cert['exams']:
        for entry in exam['attempts']:
            ap = safe_path(root, entry['path'], suffix='.json')
            attempt = json.loads(ap.read_text())
            reports[(exam['id'], entry['id'])] = {
                m['id']: m for m in attempt.get('materials', []) if m.get('type') == 'report'}
    seen = set()
    for item in coverage:
        if not isinstance(item, dict):
            raise ReviewError('Review coverage entries must be objects')
        key = question_key(item)
        if key not in expected or key in seen:
            raise ReviewError('Review coverage contains unknown or duplicate questions')
        seen.add(key)
        if item.get('reportId') is not None:
            report = reports.get(key[:2], {}).get(item['reportId'])
            if not report or report.get('questionNumber', key[2]) != key[2]:
                raise ReviewError('Review report reference is missing or belongs to another question')
        linked = item.get('topicIds', [])
        pending = item.get('pending')
        if not isinstance(linked, list) or not set(linked).issubset(topic_ids) or (not linked and not pending):
            raise ReviewError('Every eligible question needs a topic or an explicit pending reason')
        if pending is not None and (not isinstance(pending, str) or not pending.strip()):
            raise ReviewError('Review pending reasons must be nonempty strings')
    if seen != set(expected):
        raise ReviewError('Review does not cover every eligible question')
    if review.get('editorialStatus') == 'reviewed' and any(q.get('pending') for q in coverage):
        raise ReviewError('A review with editorial pending items cannot be marked reviewed')
    versions = review.get('readingVersions')
    if versions is not None:
        if not isinstance(versions, list) or len(versions) != 3:
            raise ReviewError('Review needs 10, 30 and 60 minute reading versions')
        paths = set()
        for version, minutes in zip(versions, (10, 30, 60)):
            if not isinstance(version, dict) or type(version.get('minutes')) is not int or version['minutes'] != minutes:
                raise ReviewError('Review reading durations must be 10, 30 and 60 minutes in order')
            vp = safe_path(path.parent, version.get('contentPath'), suffix='.md')
            if vp in paths:
                raise ReviewError('Reading documents must have distinct paths')
            paths.add(vp)
            raw = vp.read_bytes()
            if version.get('contentSha256') != digest(raw):
                raise ReviewError('Reading document fingerprint does not match')
            vt = raw.decode('utf-8')
            vh = re.findall(r'^## (.+)$', vt, re.M)
            if not vh or vh[0] != 'Last-minute priorities' or len(vh) != len(set(vh)) or not set(vh).issubset({'Last-minute priorities', *[t['heading'] for t in topics]}) or not re.search(r'^-\s+\S', vt, re.M):
                raise ReviewError('Invalid reading document sections or bullets')
        if versions[-1]['contentPath'] != review['contentPath'] or versions[-1]['contentSha256'] != review['contentSha256']:
            raise ReviewError('The 60 minute document must be the full review')
    current = snapshot(root, cert)
    stale = saved != current
    if stale and not allow_stale:
        raise ReviewError('Pre-Test Review is stale; reconcile all attempts and materials before finalising')
    return {**review, '_stale': stale}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', default='data/index.json')
    parser.add_argument('--data-dir', default='data')
    parser.add_argument('--snapshot-out', help='Write input snapshots to a private local JSON file, without printing study material')
    args = parser.parse_args()
    try:
        index = json.loads(Path(args.index).read_text())
        certs = index['certifications']
        if args.snapshot_out:
            output = Path(args.snapshot_out)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps({c['id']: snapshot(Path(args.data_dir), c) for c in certs}, indent=2) + '\n')
            print(f'Input snapshots written: {len(certs)} certification(s); synthesis and editorial checks remain manual')
        else:
            reviews = [validate_review(args.data_dir, c) for c in certs]
            entries = [q for r in reviews if r for q in r['coverage']]
            print(f'Review structure passed: {sum(r is not None for r in reviews)} review(s), '
                  f'{sum(bool(q.get("topicIds")) for q in entries)} mapped question(s), '
                  f'{sum(bool(q.get("pending")) for q in entries)} editorial pending item(s), '
                  f'{sum(r is not None and r.get("editorialStatus") != "reviewed" for r in reviews)} draft(s)')
    except (ReviewError, OSError, ValueError, KeyError, TypeError):
        print('Review check failed: missing, invalid, incomplete or stale review; inspect locally without logging catalog content')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
