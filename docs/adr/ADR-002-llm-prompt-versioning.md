# ADR-002 — LLM Prompt Versioning Strategy

**Status:** Accepted  
**Date:** 2026-05-15  
**Authors:** Platform Engineering + Compliance SME  
**Supersedes:** —  
**Superseded by:** —

---

## Context

The Ethical Sales Oracle uses the Claude API to produce a contextual 0–100 risk score for each completed call. Unlike deterministic phrase matching, the LLM's behaviour is influenced by the exact wording of the prompt — a change to the prompt can shift scores for identical transcripts, potentially violating regulatory consistency requirements (MiFID II Article 24, FCA SUP 10C).

We need a strategy that allows the prompt to evolve (for accuracy improvements) while:
1. Ensuring every historical score is reproducible from the prompt version that produced it.
2. Meeting the audit obligation to record what automated tool was used, at what version, for each decision.
3. Preventing silent drift — a changed prompt must be deliberately versioned.

---

## Decision

### Prompt storage

Each prompt template lives in `services/nlp-engine/prompts/risk_score_v{N}.md` where `N` is a monotonically increasing integer. The file is committed to the repository; the version number is therefore permanently traceable via git history.

### Prompt structure

The template file is a Markdown document with:
- Comment lines (starting with `# `) that are stripped before the text reaches the model.
- Two substitution placeholders: `{{TRANSCRIPT}}` and `{{RISK_EVENTS}}`.
- All scoring instructions and weighting guidance embedded inline.

The `LLMScorer` class accepts a `prompt_version` parameter (default `"v1"`) and loads the corresponding file at construction time. No version selection logic is embedded in the DAG — the version is configured via the `LLM_PROMPT_VERSION` environment variable (defaulting to `"v1"`).

### Audit trail

For every LLM API call, `PromptAuditLogger` writes to `llm_prompt_audits`:

| Column | Content |
|---|---|
| `call_id` | UUID of the scored call |
| `prompt_hash` | SHA-256 of the full prompt string (after placeholder substitution) |
| `response_hash` | SHA-256 of the raw API response text |
| `prompt_version` | e.g. `"v1"` |
| `model` | e.g. `"claude-sonnet-4-20250514"` |
| `score` | Integer 0–100 returned by the LLM |
| `latency_ms` | End-to-end API round-trip time |

The table is append-only; rows are never updated or deleted. Given the `prompt_hash`, a compliance officer can reconstruct the exact prompt from the versioned file and the transcript (already stored in `utterances`), and verify that the hash matches — without storing the prompt content in the database.

### Version lifecycle

| Phase | Action |
|---|---|
| **Development** | Author new template as `risk_score_v{N+1}.md` |
| **Staging** | Run compliance regression suite with new version; confirm 5/5 mis-selling scripts score ≥ 86 |
| **SME review** | Compliance SME reviews rationale samples from 50 randomly sampled staging calls |
| **Promotion** | Update `LLM_PROMPT_VERSION=v{N+1}` in production environment config; do NOT delete the old file |
| **Retirement** | Old version file stays in the repo; `llm_prompt_audits` rows referencing it remain auditable |

### What constitutes a new version

A new `v{N}` is required for any change that alters the model's scoring behaviour, including:
- Rewording scoring instructions or weighting guidance
- Adding or removing scoring criteria
- Changing the output format instructions
- Modifying how transcript or risk events are presented

Changes that do NOT require a version bump:
- Fixing a typo in a comment line (which is stripped before the model sees it)
- Updating the table formatting in a comment

---

## Alternatives Considered

### A. Store prompts in the database

**Rejected.** Database-stored prompts cannot be code-reviewed, are harder to roll back, and introduce a bootstrapping problem (the DB must exist before the prompt can be loaded). Git history is a better audit trail.

### B. Use a single prompt file with a version header

**Rejected.** A single file makes it impossible to run two versions simultaneously during a staged rollout, and creates merge conflicts when multiple features touch the prompt concurrently.

### C. Jinja2 templating engine

**Rejected.** Jinja2 is a full dependency for what is effectively two string substitutions. Python's `str.replace()` on known placeholders is simpler, auditable, and introduces no injection surface.

### D. Hash only the prompt file, not the instantiated prompt

**Rejected.** The instantiated prompt (after `{{TRANSCRIPT}}` substitution) is what the model actually sees. Two calls using the same prompt file but different transcripts produce different instantiated prompts; hashing the file alone would not distinguish them.

---

## Consequences

**Positive:**
- Every historical score is reproducible and auditable from its `prompt_version` + `prompt_hash`.
- Prompt changes are reviewable via standard pull-request process.
- Multiple versions can co-exist, enabling A/B experiments or phased rollouts.
- No external prompt management system required.

**Negative:**
- The prompts directory will accumulate versioned files over time; old files must not be deleted.
- The compliance regression suite must be re-run for every new version before promotion.
- Engineers authoring prompts must understand that any scoring-relevant change requires a new version — not just a file edit.

---

## Related

- [ADR-001](ADR-001-stt-provider.md) — STT provider selection
- `services/nlp-engine/prompts/risk_score_v1.md` — current production prompt
- `services/nlp-engine/llm_scorer.py` — LLMScorer implementation
- `services/nlp-engine/prompt_audit_logger.py` — audit trail writer
- `tests/regression/test_compliance_regression.py` — regression suite
