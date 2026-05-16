# RBAC Permission Matrix — Ethical Sales Oracle

**Last updated:** 2026-05-16  
**Source of truth:** `api/src/middleware/auth.ts` (`requireAuth`) + `api/src/routes/calls.ts`  
**Audit tests:** `api/src/routes/rbac.test.ts`

---

## Roles

| Role | Who | Description |
|---|---|---|
| `supervisor` | Sales team lead, real-time monitor | Can view all active calls and trigger interventions |
| `compliance` | Compliance officer, post-call reviewer | Can view all call data and export regulatory reports |
| `agent` | Sales representative on the call | No access to monitoring API |
| *(none)* | Unauthenticated | No valid bearer token |

---

## Endpoint Permission Matrix

| Endpoint | supervisor | compliance | agent | none |
|---|---|---|---|---|
| `GET  /api/calls` | ✅ 200 | ✅ 200 | ❌ 403 | ❌ 401 |
| `GET  /api/calls/:id` | ✅ 200 | ✅ 200 | ❌ 403 | ❌ 401 |
| `GET  /api/calls/:id/detail` | ✅ 200 | ✅ 200 | ❌ 403 | ❌ 401 |
| `GET  /api/calls/:id/report` | ❌ 403 | ✅ 200 | ❌ 403 | ❌ 401 |
| `POST /api/calls/:id/interventions` | ✅ 201 | ❌ 403 | ❌ 403 | ❌ 401 |
| `GET  /metrics` | Internal | Internal | Internal | Internal |
| `POST /api/test/inject-score` | Staging/test only — no auth | Staging/test only | Staging/test only | Staging/test only |

> **Note on `/api/calls/:id/report`:** Supervisors are **explicitly excluded** from report generation.  The report endpoint is compliance-only to maintain separation of duties — supervisors can act on calls in real time, but only compliance officers can generate the formal regulatory export.

> **Note on `/metrics`:** The Prometheus scrape endpoint is not protected by the application auth middleware; it must be network-restricted to the internal monitoring subnet in production.

---

## Status Code Semantics

| Code | Meaning |
|---|---|
| 200 | Authorised; resource found |
| 201 | Authorised; resource created (interventions) |
| 401 | No bearer token / invalid token |
| 403 | Valid token but insufficient role |
| 404 | Authorised but resource not found |
| 400 | Authorised but request body invalid (e.g., unknown `action` value) |

The distinction between 401 and 403 is intentional and follows RFC 7235.  Clients must not conflate them — 401 means "authenticate", 403 means "you are authenticated but not permitted".

---

## Role Assignment

Roles are assigned via Auth0 custom claims at token issuance.  The claim path is:

```
https://eso.app/role
```

The `requireAuth` middleware reads `req.auth.role` which is populated by the JWT verification middleware from this claim.

---

## Audit Trail

Every intervention is recorded in the `interventions` table with:

- `supervisor_id` (Auth0 `sub` claim)
- `action` (enum: `ALERT_AGENT`, `PAUSE_CALL`, `NOTE`)
- `note` (optional free text, max 500 chars)
- `triggered_at` (server timestamp, not client-supplied)

The table has no UPDATE or DELETE path.  This is an immutable append-only log for regulatory purposes.
