# Certification Gallery — requirements and decisions

Status: implemented · Revision: 1 · Source: user request and approved plan in the implementation conversation. History: [revision log](../revision-history.md#certification-gallery).

## Confirmed requirements

- REQ-001: learners can archive a certification as **Passed** or **Finished studying**, with an automatically recorded archive date, and restore it later.
- REQ-002: the gallery shows active and archived certifications, with name, optional code, status, exam and attempt counts, and Reports/Stories material counts.
- REQ-003: archived certifications are removed from active selectors but remain directly accessible from the gallery and by existing routes.
- REQ-004: archive status is private browser-local state, independent of the public catalog and content contract.
- REQ-005: when every catalog certification is archived, the gallery is the default entry screen.

## Journeys and acceptance

- JRN-001 → REQ-001/003/004: archive an active certification with either outcome; it leaves selectors, remains visible in the gallery, opens for study without restoration, and can be restored.
- JRN-002 → REQ-002/004: inspect the gallery and see counts derived from catalog and manifests; unavailable material manifests do not prevent viewing other card information.
- JRN-003 → REQ-004/005: reload with saved archive state, including the all-archived case; the catalog remains unchanged.
- JRN-004 → REQ-003: open an archived certification or its Pre-Test Review through a direct route.

## Technical decisions

- DEC-001: store `{schemaVersion: 1, certifications: {id: {status, archivedAt}}}` under localStorage key `sb-certification-status-v1`; accept only `passed` and `study-complete` values and valid ISO-parsable timestamps.
- DEC-002: keep archive state out of `data/index.json`; no content-contract migration is needed.
- DEC-003: the gallery route is `#/certifications/gallery`; opening an archived card preserves its archived state, while restoration is a separate action.
- DEC-004: calculate exam/attempt counts from the index and Reports/Stories counts from exam and attempt manifests. If those manifests cannot load, show material totals as unavailable.

No product decisions remain open. The gallery is internal and does not export or publish data.
