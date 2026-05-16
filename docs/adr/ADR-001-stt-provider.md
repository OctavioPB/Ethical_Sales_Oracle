# ADR-001: STT Provider Selection — Whisper vs Azure Cognitive Services

**Status:** Accepted  
**Date:** 2026-05-15  
**Deciders:** Engineering Lead · ML/NLP Engineer · Compliance SME · Product Owner  
**Sprint:** S1 (Infrastructure Foundations)

---

## Context

The Ethical Sales Oracle pipeline requires a Speech-to-Text (STT) engine that converts raw PCM audio chunks (15s windows) into verbatim transcripts. The transcripts are the primary input for the NLP risk engine and must be:

- Accurate enough for regulatory-grade phrase detection (false negative on a prohibited phrase = compliance failure)
- Low-latency (the 8s end-to-end SLA, from phrase spoken to risk score published, leaves ≤ 3s for STT)
- Privacy-safe (call audio cannot leave the EU data perimeter without explicit data processing agreements)
- Operationally maintainable by a team of 2 backend engineers

Two options were evaluated in depth:

| Criterion | OpenAI Whisper (self-hosted) | Azure Cognitive Services STT |
|---|---|---|
| Accuracy (WER on financial domain) | ~6–8% WER (large-v3) | ~4–6% WER with custom model |
| Latency per 15s chunk | 1.8–3.5s on A10G GPU | 0.8–1.5s (streaming mode) |
| Cost model | Fixed (GPU infra) | Pay-per-second ($1/hr for real-time) |
| Data residency | Full on-prem / VPC control | Configurable (EU regions available) |
| Non-native speaker support | Strong out-of-the-box | Strong + speaker adaptation |
| PII handling | No data sent externally | DPA required; encryption at rest + in-transit |
| Diarization integration | Requires separate pyannote step | Native diarization available (preview) |
| Operational complexity | High (GPU cluster, model serving) | Low (managed API) |
| Vendor lock-in | None | Microsoft Azure |
| Multilingual (ES/EN/FR) | Native (99-language model) | Native (100+ languages) |

---

## Decision

**Whisper large-v3 (self-hosted) is selected as the primary STT provider, with Azure STT as the validated fallback.**

The system architecture will make the STT provider configurable via the `STT_PROVIDER` environment variable (`whisper` | `azure`), so the fallback can be activated without a code change.

---

## Rationale

### Why Whisper as primary

1. **Data sovereignty.** Regulated sectors (banking, pharma) require that raw call audio never leaves the organisation's controlled environment without an explicit data processing agreement. Self-hosted Whisper eliminates this legal surface area entirely for the baseline deployment.

2. **Cost predictability at scale.** At 500 concurrent streams (Sprint 7 load target), Azure STT costs scale linearly. A single A10G GPU node can handle ~40 concurrent 15s-chunk streams; a 13-node cluster handles 500+ concurrent streams at a fixed monthly cost lower than Azure real-time pricing above ~300k minutes/month.

3. **Accuracy on financial jargon.** Whisper large-v3's broad training corpus covers financial terminology without custom model tuning, whereas Azure's custom speech model requires labelled training data the team does not yet have.

4. **Pipeline control.** Self-hosting keeps model version pinned — critical for regulatory auditability. A vendor updating their hosted model could change phrase detection outcomes between audit cycles.

### Why Azure as validated fallback

1. **Lower latency for near-real-time edge cases.** If the GPU cluster is degraded, Azure's streaming mode can satisfy the 8s SLA without the batch-mode latency penalty.

2. **Speaker adaptation.** For pilot desks with known non-native speaker accents (identified in the Risk Register as a high-likelihood, high-impact risk), Azure's custom acoustic model can be fine-tuned faster than retraining Whisper.

3. **Managed availability.** 99.9% SLA backed by Microsoft, with no GPU maintenance burden during an incident.

---

## Consequences

### Positive
- Full data residency control satisfies initial legal review without negotiating a DPA.
- Consistent model behaviour across audit periods.
- Cost advantage at production scale (500+ streams).

### Negative / Risks
- Engineering team must operate GPU infrastructure (CUDA driver updates, node failure recovery).
- Whisper large-v3 requires ~10GB VRAM per model instance; smaller GPU instances will require model quantisation (fp16 acceptable; int8 needs accuracy regression testing).
- No native diarization — pyannote.audio must be maintained as a separate step (Sprint 2 deliverable).

### Mitigations
- GPU nodes are provisioned on a managed Kubernetes node pool with auto-repair.
- The `STT_PROVIDER=azure` fallback is tested in CI on every release so the team can activate it within 5 minutes.
- Whisper model version is pinned in the Docker image tag and locked in the `WHISPER_MODEL` env var.

---

## Alternatives Considered and Rejected

| Option | Rejection reason |
|---|---|
| Google Speech-to-Text | Similar DPA concerns as Azure; no self-hosted option |
| AssemblyAI | No EU data residency; unknown regulatory posture for financial sector |
| Whisper medium | WER too high (11–13%) for reliable prohibited-phrase detection at short chunk windows |
| AWS Transcribe | No real-time streaming in EU regions at time of evaluation |

---

## Review Trigger

This decision should be revisited if:
- GPU cluster operational cost exceeds Azure cost by more than 20% at steady-state load
- A compliance audit requires demonstrable STT accuracy improvements above Whisper's WER
- The team secures an EU-region DPA with Microsoft, enabling Azure as primary with lower latency
