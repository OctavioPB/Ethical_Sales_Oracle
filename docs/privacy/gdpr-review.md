# GDPR Privacy Review — Ethical Sales Oracle

**Review date:** 2026-05-16  
**Reviewer:** Security / Compliance team  
**Scope:** All personal data processed by ESO from call audio ingestion through 7-year archival

---

## 1. Legal Basis

| Data Subject | Category | Legal Basis (GDPR Art. 6) |
|---|---|---|
| Customer (call participant) | Voice recordings, transcript | Art. 6(1)(c) — legal obligation (MiFID II call recording mandate) |
| Customer | Risk score, flagged phrases | Art. 6(1)(c) — same regulatory obligation |
| Sales agent | Voice (diarised), utterances | Art. 6(1)(b) — employment contract; Art. 6(1)(c) — regulatory |
| Supervisor | Intervention records | Art. 6(1)(b) — employment contract |

All processing is covered by a regulatory obligation.  No consent is required, but data subjects must be informed via privacy notice before calls begin (out of scope for this system; handled by the contact centre operator).

---

## 2. Data Inventory

| Data Element | Where Stored | Retention | Encryption at Rest |
|---|---|---|---|
| Raw audio stream | Kafka topic (`eso.audio.*`) | 30 days (purged via DAG) | Yes — Kafka at-rest encryption |
| Call transcript (utterances) | PostgreSQL `utterances` table | 7 years then anonymised | Yes — Postgres encryption |
| Risk scores + events | PostgreSQL `call_risk_scores`, `risk_events` | 7 years | Yes |
| LLM prompt hash + response hash | `llm_prompt_audits` | 7 years | Yes |
| LLM rationale text | `llm_prompt_audits.rationale_text` | 7 years then anonymised | Yes |
| Interventions (supervisor actions) | `interventions` table | 7 years | Yes |
| Agent/supervisor IDs (Auth0 sub) | All tables referencing actors | As per HR policy | Yes |

---

## 3. PII Redaction Coverage

The `PiiRedactor` class (`services/nlp-engine/pii_redactor.py`) redacts the following before storing utterances:

| PII Type | Detection Method | Redaction Token | Status |
|---|---|---|---|
| Person names | spaCy NER (`PERSON` entity) | `[NAME]` | ✅ Implemented |
| Phone numbers | Regex (international + domestic) | `[PHONE]` | ✅ Implemented |
| IBANs | Regex (ISO 13616 format) | `[IBAN]` | ✅ Implemented |
| Account / card numbers (8–19 digits) | Regex | `[ACCOUNT]` | ✅ Implemented |
| Email addresses | Not implemented | — | ❌ Gap (ESO-PII-002) |
| National ID numbers (NIE, NIF, SSN) | Not implemented | — | ❌ Gap (ESO-PII-003) |
| Dates of birth | Not implemented | — | ❌ Gap (ESO-PII-004) |

### Known Gaps

**ESO-PII-002 — Email addresses:** Email addresses are GDPR Art. 4(1) personal data.  Agents or customers may speak email addresses during calls (e.g., "my email is john@example.com").  These currently pass through to the stored transcript.  **Priority: P1.  Target: Sprint 8.**

**ESO-PII-003 — National ID numbers:** Spanish NIE/NIF (format: `[XYZ]\d{7}[A-Z]`) and US SSNs (`\d{3}-\d{2}-\d{4}`) are not redacted.  **Priority: P2.**

**ESO-PII-004 — Dates of birth:** Spoken dates (e.g., "15th June 1978") are not redacted.  spaCy labels these as `DATE` entities which are intentionally excluded.  Requires a separate heuristic (e.g., DATE entities adjacent to "date of birth" context).  **Priority: P2.**

---

## 4. Data Minimisation

- **Audio** deleted after 30 days via `eso_data_retention_v1` DAG — only the transcript (already redacted of PII) is retained long-term.
- **LLM prompt/response hashes** — only SHA-256 hashes are stored, not the full prompt or LLM response text (which may contain transcript excerpts).
- **Rationale text** — derived from PII-redacted utterances before the LLM call; stored in `rationale_text` after redaction.

---

## 5. Data Subject Rights (GDPR Art. 15–22)

| Right | Mechanism | Status |
|---|---|---|
| Access (Art. 15) | Compliance officer exports PDF report (`GET /api/calls/:id/report`) | Partial — covers call-level data; no subject-level aggregation view yet |
| Erasure (Art. 17) | 7-year mandatory retention overrides erasure for regulatory calls; post-retention: `anonymise_expired_transcripts` DAG | ✅ Post-retention anonymisation implemented |
| Rectification (Art. 16) | N/A — transcript is a factual record | N/A |
| Restriction (Art. 18) | Not implemented | ❌ Gap — P3 |
| Portability (Art. 20) | Not implemented | ❌ Gap — P3 |

---

## 6. Data Transfers

All data is processed within the EU (AWS `eu-west-1` or equivalent).  The Claude API call (LLM scoring) sends a **PII-redacted** transcript excerpt to Anthropic's API.  Anthropic's DPA covers this transfer under Standard Contractual Clauses.

---

## 7. Retention Schedule

| Data | Trigger | Action |
|---|---|---|
| Audio (Kafka) | 30 days after `calls.ended_at` | Purge event emitted to `eso.retention.audio-purge`; `audio_purged_at` stamped |
| Transcripts / risk data | 7 years after `calls.ended_at` | `UPDATE utterances SET utterance = '[REDACTED]'`; `rationale_text = '[REDACTED]'` |

DAG: `infra/airflow/dags/eso_data_retention_v1.py` — runs daily at 02:00 UTC.

---

## 8. Next Steps

| Item | Priority | Owner | Target |
|---|---|---|---|
| ESO-PII-002: Email redaction | P1 | NLP team | Sprint 8 |
| ESO-PII-003: National ID regex | P2 | NLP team | Sprint 9 |
| ESO-PII-004: Date-of-birth context heuristic | P2 | NLP team | Sprint 9 |
| Subject-level data access view | P3 | API team | Sprint 10 |
| Data processing register (ROPA) entry | — | DPO | Before go-live |
