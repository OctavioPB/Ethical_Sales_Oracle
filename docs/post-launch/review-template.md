# Post-Launch Review Template — Ethical Sales Oracle

Use this template for the Day 3, Day 7, and Day 30 reviews. Attendees: CTO, Compliance Officer, NLP team lead, on-call engineer, product lead.

---

## Day 3 Review

**Date:** ___________  **Attendees:** ___________

### 1. System Health

| Metric | Target | Actual | Pass? |
|---|---|---|---|
| API uptime | 99.9% | | |
| Score pipeline p95 | ≤ 8s | | |
| Call coverage % | 100% | | |
| 5xx error rate | < 1% | | |
| Kafka consumer lag | < 300 messages | | |

Check: `https://grafana.your-domain.com/d/eso-sla-v1`

### 2. Call Volume

- Total calls ingested: ___
- Total calls scored: ___
- Coverage: ___ %
- High/Critical calls: ___ (___ %)

### 3. Incidents

List any P1 or P2 incidents since launch. For each: timestamp, duration, root cause, resolution.

| Incident | Severity | Duration | Root Cause | Resolved? |
|---|---|---|---|---|
| | | | | |

### 4. False-Positive Rate

- Total false-positive flags submitted by supervisors: ___
- Top flagged rules: (pull from `GET /api/feedback/summary`)
- Decision: rule adjustment required before Day 7? Y / N

### 5. Supervisor Feedback

- Number of supervisors who have logged in: ___
- Number of interventions triggered: ___
- Qualitative feedback (collect via #eso-support): ___

### 6. Action Items

| Item | Owner | Due |
|---|---|---|
| | | |

---

## Day 7 Review

**Date:** ___________  **Attendees:** ___________

### 1. System Health (7-day view)

Same metrics table as Day 3, covering the full 7 days.

### 2. Rule Refinement

Based on the false-positive feed:

- Rules adjusted since launch: ___
- Rules under review: ___
- Estimated impact on false-positive rate: ___

### 3. Compliance Officer Feedback

- Reports exported: ___
- Any issues with report format or content: ___
- Regulatory readiness assessment: ___

### 4. Performance Trends

Review the pipeline dashboard (`eso-pipeline-v1`) for any degradation trends:
- p95 latency trending up? Y / N
- Kafka lag increasing? Y / N
- DB connections trending toward limit? Y / N

If any metric is trending toward a threshold, add a remediation item.

### 5. Security Posture

- Daily Gitleaks scans: all passed? Y / N
- Any new CVEs from pnpm/safety scans: ___
- Any suspicious access patterns in API logs: ___

### 6. Action Items

| Item | Owner | Due |
|---|---|---|
| | | |

---

## Day 30 Review

**Date:** ___________  **Attendees:** ___________

### 1. SLA Report (30-day)

Pull from the SLA dashboard (`eso-sla-v1`):

| SLA | Target | Achieved | Error Budget Used |
|---|---|---|---|
| API uptime | 99.9% | | |
| Score pipeline p95 ≤ 8s | 99% of windows | | |
| Call coverage | 100% | | |

### 2. Business Value

- Total calls monitored: ___
- High/Critical calls detected: ___
- Interventions triggered: ___
- Confirmed true positives (interventions the supervisor confirmed were warranted): ___
- Estimated regulatory exposure avoided: (qualitative — document any near-misses)

### 3. Rule Maturity

- False-positive rate (Week 1 vs Week 4): ___
- Rules added since launch: ___
- Rules retired or adjusted: ___
- Compliance SME sign-off on current rule set: Y / N

### 4. Data Privacy

- Audio deletion DAG: running successfully? Y / N
- Any PII found in logs or exports: Y / N (if Y, incident response required)
- GDPR gaps from Sprint 7 (ESO-PII-002, ESO-PII-003): status?

### 5. Next Sprint Planning

Based on 30-day data, prioritise from the backlog:

- [ ] Insurance sector rule set
- [ ] Multi-language support (Spanish, French)
- [ ] Agent coaching module
- [ ] Automated regulatory report PDF generation
- [ ] Fine-tuned LLM on sector corpus

### 6. Retrospective

**Went well:**

**Could be improved:**

**Action Items:**

| Item | Owner | Due |
|---|---|---|
| | | |

---

## Sign-Off

| Role | Name | Signature | Date |
|---|---|---|---|
| CTO | | | |
| Compliance Officer | | | |
| NLP Team Lead | | | |
| On-Call Engineer | | | |
