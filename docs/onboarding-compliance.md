# Compliance Officer Onboarding Guide — Ethical Sales Oracle

**Role:** Compliance officer · Post-call reviewer · Regulatory report generator  
**Access level:** Can view all call data and export regulatory reports; cannot trigger interventions

---

## What ESO does for you

ESO gives you a complete, auditable record of every sales call — including the diarized transcript (PII-redacted), all detected risk events, the LLM rationale for each score, and the supervisor intervention log. You can:

- **Search** for calls by risk level, agent, date range, or desk
- **Review** the annotated transcript with risk phrases highlighted and categorised
- **Export** a structured compliance report for regulatory submissions
- **Monitor** the false-positive flag feed to drive rule-refinement meetings

---

## Logging in

1. Open `https://eso.your-domain.com`
2. Click **Log in** and authenticate with your corporate credentials
3. You land on the **Dashboard**

Your role is `compliance`. If you see "Insufficient role", contact IT.

---

## Reviewing a call

From the Dashboard, click any call tile to open the **Call Detail** view.

**Transcript pane** — The full diarized conversation, with:
- Agent utterances on the left, customer on the right
- Risk-flagged utterances highlighted with a coloured border
- Bolded trigger words; risk category chips (e.g. *Prohibited Promise*, *Pressure Tactic*) below each flagged bubble

**Rationale panel** — The LLM's contextual explanation of the overall risk score. This includes:
- The final aggregated score and risk level
- The model ID and prompt version used (for audit trail purposes)
- The rationale text (derived from PII-redacted utterances only)

**Intervention log** — All supervisor actions taken during or after the call, with timestamps and the supervisor's identity.

---

## Exporting a regulatory report

From the Call Detail view, click **Export report →** (top-right of the hero bar).

This opens a structured JSON report containing:

```json
{
  "callId": "...",
  "agentId": "...",
  "startedAt": "...",
  "endedAt": "...",
  "finalScore": 87,
  "flaggedPhrases": [
    { "ruleId": "PP-001", "category": "Prohibited Promise", "phrase": "guaranteed return", ... }
  ],
  "transcript": [ ... ],
  "rationale": "The agent made two prohibited promises ...",
  "interventions": [ ... ]
}
```

To generate a PDF from this JSON, use the compliance team's report template in `docs/compliance/report-template/`. The on-call engineer can also configure automatic PDF generation via the reporting pipeline (Sprint 8 backlog).

**RBAC note:** Supervisors cannot access this export endpoint. It returns 403 for all non-compliance roles.

---

## The Reports page

The **Reports** page in the navigation bar lists all calls within a configurable date range, filterable by:
- Risk level (Low / Medium / High / Critical)
- Agent ID or desk
- Flagged rule category

You can export individual reports from this list view.

---

## Reviewing the false-positive feed

At `GET /api/feedback/summary`, you can see which rules have been flagged most frequently as false positives by supervisors in the past 30 days. This is the primary input for rule-refinement meetings with the NLP team.

Typical workflow:
1. Weekly: pull the summary and review rules with > 5 flags
2. Bring flagged rules to the NLP team's rule-review session
3. NLP team adjusts confidence thresholds or rule wording in `services/nlp-engine/rules/`
4. Changes take effect on the next deployment (no data backfill — only future calls)

---

## Data retention and your obligations

| Data | Retention | Format after 7 years |
|---|---|---|
| Transcript utterances | 7 years from call end | `[REDACTED]` (automated by retention DAG) |
| Risk scores and events | 7 years | Unchanged |
| Interventions | 7 years | Unchanged |
| LLM rationale text | 7 years then `[REDACTED]` | Automated |
| Audio (Kafka) | 30 days | Deleted |

You are responsible for ensuring that regulatory reports exported for submissions are handled per your data classification policy (typically restricted / confidential). Do not store exports in unapproved locations.

---

## Regulatory references in scope

| Regulator | Instrument | Key requirement relevant to ESO |
|---|---|---|
| CNMV (Spain) | Circular 1/2022 (MiFID II) | Call recording + suitability audit trail |
| FCA (UK) | COBS 16A | Recording of telephone conversations |
| FTC (USA) | Act Section 5 | Unfair or deceptive acts prohibition |
| EMA (EU) | Promotional communications guidelines | Off-label claim detection |

When preparing a regulatory submission that references ESO data, include the call ID, export timestamp, and prompt version from the rationale panel. The prompt version is the stable identifier for the scoring model version in use.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Export report button not visible | Confirm your role is `compliance`. It is not shown to supervisors by design. |
| Report shows `rationale: null` | The LLM scoring step may have failed for this call. Check the `llm_prompt_audits` table for `latency_ms = -1`. |
| Transcript shows `[REDACTED]` throughout | The call is older than 7 years and has been anonymised per the retention policy. The risk scores and intervention log are still available. |
| A call is missing from the list | The call may still be in progress (active calls are in the live store, not the DB list). Wait until the call ends. |

---

## Getting help

- **Internal helpdesk:** #eso-support Slack channel
- **Data / privacy questions:** DPO contact in the internal directory
- **Rule-review requests:** #eso-nlp-rules Slack channel
