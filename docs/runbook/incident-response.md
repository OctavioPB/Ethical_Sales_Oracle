# Incident Response Runbook — Ethical Sales Oracle

**Audience:** On-call engineer, compliance team  
**Last updated:** 2026-05-16

---

## Severity Levels

| Severity | Definition | Response Time |
|---|---|---|
| P1 — Critical | Score pipeline down; calls not being audited; data breach | 15 minutes |
| P2 — High | p95 latency > 8s sustained; Kafka lag > 300; false-positive spike | 30 minutes |
| P3 — Warning | Single component degraded; no user-visible impact yet | Next business day |

PagerDuty fires for P1 (critical route) and P2 (warning route) alerts automatically from Alertmanager.

---

## Runbook 1 — Score Pipeline Failure

**Alert:** `AirflowDAGFailed` (PagerDuty critical) or `KafkaConsumerLagCritical`

**Symptom:** New calls appear in the heatmap with no risk score, or the active calls count drops to zero during business hours (`NoActiveCallsDuringBusinessHours`).

### Diagnosis

```bash
# 1. Check Airflow DAG status
airflow dags list-runs -d eso_stt_v1 --state failed --limit 5
airflow dags list-runs -d eso_data_retention_v1 --state failed --limit 5

# 2. Check Kafka consumer lag
kafka-consumer-groups.sh --bootstrap-server kafka:9092 \
  --group eso-nlp-engine --describe

# 3. Check NLP engine logs
docker logs eso-nlp-engine --tail 200 --follow

# 4. Check Grafana dashboard
# http://localhost:3000/d/eso-pipeline-v1
```

### Resolution — DAG failure

```bash
# Clear the failed task and retry
airflow tasks clear -d eso_stt_v1 -t stt_transcribe -s <execution_date>
airflow dags trigger eso_stt_v1

# If a DB connection error caused the failure:
# 1. Check DB_POOL_MAX env var (default 10)
# 2. Check PostgreSQL connections: SELECT count(*) FROM pg_stat_activity;
# 3. If pool exhausted, restart the affected service
```

### Resolution — Kafka lag spike

```bash
# Check if the consumer group is active
kafka-consumer-groups.sh --bootstrap-server kafka:9092 \
  --group eso-nlp-engine --describe

# If consumer is paused/crashed, restart the NLP engine
docker restart eso-nlp-engine

# If lag is > 1000 and growing, scale the consumer (add partitions or workers)
# This requires a change request — do not scale partitions without a CAB approval
```

### Escalation

If the pipeline is not restored within 30 minutes, escalate to:
1. NLP team lead (P1 on-call rotation)
2. Compliance team — notify that call coverage is degraded (regulatory obligation)
3. If data loss suspected (calls processed but not scored), open a formal incident

---

## Runbook 2 — Suspected Data Breach

**Alert:** Manual detection or external report; no automated alert for this scenario.

**Symptom:** Unauthorized access to call transcripts, risk scores, or PII; credentials leaked; unusual API access patterns in logs.

### Immediate Actions (0–15 minutes)

1. **Contain** — Rotate compromised credentials immediately:
   ```bash
   # Rotate Auth0 client secret via Auth0 dashboard (Management API)
   # Rotate Anthropic API key at console.anthropic.com
   # Rotate Kafka SASL password and redeploy consumers
   ```

2. **Isolate** — If the breach vector is the API:
   ```bash
   # Take the API offline temporarily (redirect to maintenance page)
   docker stop eso-api
   ```

3. **Preserve** — Do not delete logs.  Snapshot the PostgreSQL `pg_stat_activity` and application logs before restarting services.

### Investigation (15–60 minutes)

```bash
# Check recent API access logs for suspicious patterns
# (structured JSON logs — filter by status, IP, route)
docker logs eso-api --since 2h | jq 'select(.status >= 200) | {ts, method, route, ip, userId}'

# Check interventions table for unauthorized entries
psql $DATABASE_URL -c "
  SELECT * FROM interventions
  WHERE triggered_at > NOW() - INTERVAL '24 hours'
  ORDER BY triggered_at DESC;
"

# Check llm_prompt_audits for unexpected calls
psql $DATABASE_URL -c "
  SELECT call_id, model, created_at FROM llm_prompt_audits
  WHERE created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC LIMIT 50;
"
```

### Notification (within 72 hours of discovery)

Per GDPR Article 33, a personal data breach must be reported to the supervisory authority (AEPD for Spain, ICO for UK) within 72 hours if it poses a risk to data subjects.

1. Notify the DPO immediately upon confirmed breach
2. DPO assesses risk level and prepares Art. 33 notification if required
3. If high risk to data subjects (Art. 34), directly notify affected individuals

### Post-Incident

- Root cause analysis within 5 business days
- Update threat model and security controls
- Rerun full Gitleaks scan to confirm no secrets remain in history

---

## Runbook 3 — False-Positive Spike

**Alert:** Monitoring: intervention rate `interventions_total` increases sharply without corresponding increase in call volume; or compliance team reports manual review backlog spike.

**Symptom:** The NLP engine is flagging calls as high/critical risk at an elevated rate.  Supervisors report most flagged calls are legitimate (no actual mis-selling).

### Diagnosis

```bash
# Check the risk phrase rules for recent changes
git log --oneline services/nlp-engine/rules/ | head -20

# Check which risk categories are triggering most
psql $DATABASE_URL -c "
  SELECT category, count(*) as hits
  FROM risk_events
  WHERE detected_at > NOW() - INTERVAL '1 hour'
  GROUP BY category
  ORDER BY hits DESC;
"

# Check LLM score distribution
psql $DATABASE_URL -c "
  SELECT
    CASE
      WHEN score <= 30 THEN 'low'
      WHEN score <= 60 THEN 'medium'
      WHEN score <= 85 THEN 'high'
      ELSE 'critical'
    END AS risk_level,
    count(*)
  FROM call_risk_scores
  WHERE scored_at > NOW() - INTERVAL '1 hour'
  GROUP BY 1;
"
```

### Common Causes and Fixes

**Cause: New risk phrase rule is too broad**
```bash
# Identify the new rule
git diff HEAD~1 services/nlp-engine/rules/
# Roll back the specific rule file if needed — do not roll back the whole deploy
git checkout HEAD~1 -- services/nlp-engine/rules/<affected-file>.yaml
docker restart eso-nlp-engine
```

**Cause: LLM model change producing different scores**
```bash
# Check the model in use
grep LLM_MODEL .env

# If a model update was deployed, compare score distributions before/after
# Consider rolling back LLM_MODEL env var
```

**Cause: New call type / product with unfamiliar vocabulary**
- Escalate to NLP team to review and potentially add approved phrases to the allowlist
- Do NOT adjust score thresholds without compliance sign-off

### Communication

Notify supervisors and compliance team of the known false-positive spike.  Provide an estimated resolution time.  Document the root cause in the post-incident report.

---

## Contact Directory

| Role | Contact | Availability |
|---|---|---|
| On-call engineer | PagerDuty rotation | 24/7 |
| NLP team lead | (internal directory) | Business hours; P1 on-call |
| Compliance team | (internal directory) | Business hours |
| DPO | (internal directory) | Business hours; P1 escalation |
| Auth0 support | support.auth0.com | Enterprise SLA |
| Anthropic support | console.anthropic.com | Enterprise SLA |
