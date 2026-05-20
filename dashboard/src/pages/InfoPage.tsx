import React, { useState } from 'react';

// ── Shared primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--fb)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '3px',
        textTransform: 'uppercase',
        color: 'var(--gold)',
        marginBottom: 10,
      }}
    >
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 26,
        fontWeight: 300,
        color: 'var(--dark)',
        marginBottom: 12,
        lineHeight: 1.25,
      }}
    >
      {children}
    </h2>
  );
}

function Body({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontFamily: 'var(--fb)',
        fontSize: 14,
        color: 'var(--mid)',
        lineHeight: 1.75,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--white)',
        borderRadius: 10,
        padding: '28px 32px',
        boxShadow: '0 1px 4px rgba(0,51,102,0.07)',
        border: '1px solid rgba(0,51,102,0.07)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Business View ────────────────────────────────────────────────────────────

function PainPointIcon({ label, icon }: { label: string; icon: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '20px 16px',
        backgroundColor: 'rgba(224,52,72,0.05)',
        borderRadius: 10,
        border: '1px solid rgba(224,52,72,0.15)',
        flex: 1,
        minWidth: 140,
      }}
    >
      <span style={{ fontSize: 28 }}>{icon}</span>
      <span
        style={{
          fontFamily: 'var(--fb)',
          fontSize: 12,
          color: 'var(--risk-high-text)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function AdvantageRow({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        padding: '16px 0',
        borderBottom: '1px solid rgba(0,51,102,0.06)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'var(--gold)',
          flexShrink: 0,
          marginTop: 6,
        }}
      />
      <div>
        <p
          style={{
            fontFamily: 'var(--fb)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--dark)',
            marginBottom: 3,
          }}
        >
          {title}
        </p>
        <Body style={{ fontSize: 13, marginBottom: 0 }}>{description}</Body>
      </div>
    </div>
  );
}

function BusinessView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {/* Problem statement */}
      <Card>
        <SectionLabel>The Problem</SectionLabel>
        <H2>
          Compliance teams cannot keep pace with{' '}
          <em style={{ fontStyle: 'italic' }}>call volume</em>
        </H2>
        <Body>
          Financial services firms operate under strict conduct obligations — MiFID II, FCA COBS,
          SEC Regulation Best Interest — that require agents to present products accurately, avoid
          pressure tactics, and not make unsubstantiated return claims. In practice, compliance
          teams manually review fewer than 5% of calls. Violations are discovered weeks after they
          occur, fines arrive before remediation is possible, and the agent has already moved on to
          the next hundred conversations.
        </Body>

        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 24,
          }}
        >
          <PainPointIcon icon="📋" label="&lt;5% of calls reviewed manually" />
          <PainPointIcon icon="⏱" label="Violations found weeks after the call" />
          <PainPointIcon icon="💸" label="Reactive fines, not preventive action" />
          <PainPointIcon icon="📞" label="No visibility during the live call" />
        </div>
      </Card>

      {/* How it works */}
      <Card>
        <SectionLabel>How It Works</SectionLabel>
        <H2>
          Every call is scored in <em style={{ fontStyle: 'italic' }}>real time</em>, not after the
          fact
        </H2>
        <Body>
          Audio is transcribed as it streams. A deterministic rule engine checks each utterance for
          known-bad phrase patterns — guaranteed return claims, artificial urgency, misleading past
          performance statements — and flags them immediately. A large language model then scores
          the full conversation in context, weighing severity, speaker intent, and customer
          response. Risk alerts appear on the supervisor dashboard within two seconds of the
          triggering phrase. Supervisors can send an alert to the agent, pause the call for
          coaching, or log a compliance note — all without leaving the interface.
        </Body>

        {/* Workflow steps */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            marginTop: 28,
            overflow: 'hidden',
            borderRadius: 8,
            border: '1px solid rgba(0,51,102,0.1)',
          }}
        >
          {[
            { step: '1', label: 'Audio capture', sub: 'Agent call is chunked as it streams' },
            { step: '2', label: 'Transcription', sub: 'Whisper STT with speaker diarization' },
            { step: '3', label: 'Rule engine', sub: 'Phrase matching against 40+ rules' },
            { step: '4', label: 'LLM scoring', sub: 'Claude scores risk in full context' },
            { step: '5', label: 'Live alert', sub: 'Supervisor sees it in under 2 s' },
          ].map((item, i, arr) => (
            <div
              key={item.step}
              style={{
                flex: 1,
                padding: '16px 14px',
                backgroundColor: i % 2 === 0 ? 'var(--light)' : 'var(--white)',
                borderRight: i < arr.length - 1 ? '1px solid rgba(0,51,102,0.08)' : 'none',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: 'var(--white)',
                  fontFamily: 'var(--fb)',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                }}
              >
                {item.step}
              </div>
              <p
                style={{
                  fontFamily: 'var(--fb)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--dark)',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                {item.label}
              </p>
              <p
                style={{
                  fontFamily: 'var(--fb)',
                  fontSize: 11,
                  color: 'var(--mid)',
                  lineHeight: 1.4,
                }}
              >
                {item.sub}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Roles */}
      <Card>
        <SectionLabel>Who Uses It</SectionLabel>
        <H2>Three roles, one platform</H2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          {[
            {
              role: 'Supervisor',
              color: 'var(--primary)',
              bg: 'rgba(0,51,102,0.05)',
              border: 'rgba(0,51,102,0.15)',
              description:
                'Monitors live calls on the risk heatmap. Receives push alerts when risk exceeds threshold. Can intervene — alert the agent, pause the call, or attach a coaching note.',
            },
            {
              role: 'Compliance',
              color: '#6B21A8',
              bg: 'rgba(107,33,168,0.05)',
              border: 'rgba(107,33,168,0.15)',
              description:
                'Reviews call transcripts with annotated risk events. Exports audit reports for regulatory review. Has read access to LLM rationale and prompt version for each scoring decision.',
            },
            {
              role: 'Agent',
              color: '#0369A1',
              bg: 'rgba(3,105,161,0.05)',
              border: 'rgba(3,105,161,0.15)',
              description:
                'Receives in-call alerts from supervisors when a compliance issue is detected. Does not have access to the supervisor dashboard or scoring details.',
            },
          ].map((r) => (
            <div
              key={r.role}
              style={{
                flex: 1,
                minWidth: 200,
                padding: '20px 22px',
                backgroundColor: r.bg,
                border: `1px solid ${r.border}`,
                borderRadius: 10,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--fb)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  color: r.color,
                  marginBottom: 8,
                }}
              >
                {r.role}
              </p>
              <Body style={{ fontSize: 13, marginBottom: 0 }}>{r.description}</Body>
            </div>
          ))}
        </div>
      </Card>

      {/* Core advantages */}
      <Card>
        <SectionLabel>Core Advantages</SectionLabel>
        <H2>What differentiates this approach</H2>
        <div style={{ marginTop: 8 }}>
          <AdvantageRow
            title="Detection during the call, not after"
            description="Most compliance tools operate on recordings. ESO acts on the live audio stream, giving supervisors a window to intervene before the call ends and before harm is done."
          />
          <AdvantageRow
            title="Hybrid scoring — deterministic + probabilistic"
            description="Rule-based phrase matching catches known violations with zero latency and full explainability. LLM scoring adds contextual judgment: the same phrase in a different framing may not be a violation, and the model accounts for that."
          />
          <AdvantageRow
            title="Full audit trail per call"
            description="Every scoring decision records the prompt hash, model version, LLM rationale, and all rule matches. Regulators can reconstruct exactly why a call was flagged, which model version scored it, and what the supervisor did with the alert."
          />
          <AdvantageRow
            title="Works with existing telephony"
            description="Audio ingestion is Kafka-based. Any telephony system that can publish audio chunks to a Kafka topic is compatible. No proprietary hardware or vendor lock-in on the capture layer."
          />
          <AdvantageRow
            title="No transcript data leaves the platform"
            description="All inference runs inside the firm's infrastructure. Call audio and transcripts are never sent to third-party APIs. The LLM endpoint is a self-hosted or VPC-isolated deployment."
          />
        </div>
      </Card>
    </div>
  );
}

// ── Engineering View ─────────────────────────────────────────────────────────

function TechRow({ layer, tech, role }: { layer: string; tech: string; role: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 200px 1fr',
        gap: 16,
        padding: '12px 0',
        borderBottom: '1px solid rgba(0,51,102,0.06)',
        alignItems: 'start',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--fb)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: 'var(--primary-60)',
        }}
      >
        {layer}
      </p>
      <p
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 14,
          color: 'var(--dark)',
        }}
      >
        {tech}
      </p>
      <Body style={{ fontSize: 13, marginBottom: 0 }}>{role}</Body>
    </div>
  );
}

// SVG architecture diagram — data pipeline
function PipelineDiagram() {
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    sub: string,
    fill: string,
    textColor: string = '#1C1C2E',
  ) => (
    <g key={label}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} />
      <text
        x={x + w / 2}
        y={y + h / 2 - 7}
        textAnchor="middle"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={11}
        fontWeight={700}
        fill={textColor}
      >
        {label}
      </text>
      <text
        x={x + w / 2}
        y={y + h / 2 + 9}
        textAnchor="middle"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={9}
        fill={textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : '#6B7280'}
      >
        {sub}
      </text>
    </g>
  );

  const arrow = (x1: number, y1: number, x2: number, y2: number, label?: string) => (
    <g key={`${x1}-${y1}-${x2}-${y2}`}>
      <defs>
        <marker
          id={`ah-${x1}-${x2}`}
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="#9CA3AF" />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#9CA3AF"
        strokeWidth={1.5}
        markerEnd={`url(#ah-${x1}-${x2})`}
      />
      {label && (
        <text
          x={(x1 + x2) / 2}
          y={y1 - 5}
          textAnchor="middle"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontSize={8}
          fill="#9CA3AF"
        >
          {label}
        </text>
      )}
    </g>
  );

  return (
    <svg
      viewBox="0 0 860 320"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-label="ESO data pipeline diagram"
      role="img"
    >
      {/* Background */}
      <rect width={860} height={320} rx={10} fill="#F4F6F9" />

      {/* Lane backgrounds */}
      <rect x={10} y={10} width={840} height={46} rx={6} fill="rgba(0,51,102,0.05)" />
      <text
        x={20}
        y={30}
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={8}
        fontWeight={700}
        letterSpacing={2}
        textTransform="uppercase"
        fill="rgba(0,51,102,0.4)"
      >
        CAPTURE
      </text>
      <rect x={10} y={66} width={840} height={46} rx={6} fill="rgba(0,51,102,0.04)" />
      <text
        x={20}
        y={86}
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={8}
        fontWeight={700}
        letterSpacing={2}
        fill="rgba(0,51,102,0.4)"
      >
        PROCESSING
      </text>
      <rect x={10} y={122} width={840} height={46} rx={6} fill="rgba(0,51,102,0.03)" />
      <text
        x={20}
        y={142}
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={8}
        fontWeight={700}
        letterSpacing={2}
        fill="rgba(0,51,102,0.4)"
      >
        MESSAGING
      </text>
      <rect x={10} y={178} width={840} height={46} rx={6} fill="rgba(0,51,102,0.04)" />
      <text
        x={20}
        y={198}
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={8}
        fontWeight={700}
        letterSpacing={2}
        fill="rgba(0,51,102,0.4)"
      >
        PERSISTENCE
      </text>
      <rect x={10} y={234} width={840} height={76} rx={6} fill="rgba(0,51,102,0.05)" />
      <text
        x={20}
        y={254}
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={8}
        fontWeight={700}
        letterSpacing={2}
        fill="rgba(0,51,102,0.4)"
      >
        PRESENTATION
      </text>

      {/* Row 1 — Capture */}
      {box(60, 18, 110, 30, 'Telephony', 'call audio', 'rgba(0,51,102,0.12)')}
      {arrow(170, 33, 210, 33)}
      {box(210, 18, 110, 30, 'Ingestion Svc', 'Node.js + Kafka', 'rgba(0,51,102,0.18)')}
      {arrow(320, 33, 360, 33)}
      {box(360, 18, 100, 30, 'Airflow DAG', 'eso_stt_v1', 'rgba(0,51,102,0.12)')}
      {arrow(460, 33, 500, 33)}
      {box(500, 18, 100, 30, 'Whisper STT', 'large-v3', 'rgba(200,152,42,0.15)')}
      {arrow(600, 33, 640, 33)}
      {box(640, 18, 110, 30, 'Diarization', 'speaker labels', 'rgba(0,51,102,0.12)')}

      {/* Row 2 — Processing */}
      {box(60, 74, 120, 30, 'Rule Engine', '40+ phrase rules', 'rgba(224,52,72,0.12)')}
      {arrow(180, 89, 220, 89)}
      {box(220, 74, 120, 30, 'Claude Opus', 'claude-opus-4-7', 'rgba(200,152,42,0.2)')}
      {arrow(340, 89, 390, 89, 'risk score')}
      {box(390, 74, 130, 30, 'Score Publisher', 'risk + events', 'rgba(0,51,102,0.18)')}
      {arrow(520, 89, 560, 89)}
      {box(560, 74, 110, 30, 'Prompt Audit', 'hash + response', 'rgba(107,33,168,0.12)')}

      {/* Row 3 — Kafka */}
      {box(60, 130, 140, 30, 'eso.scores.calls', 'Kafka topic', '#003366', '#ffffff')}
      {box(220, 130, 140, 30, 'eso.events.risk', 'Kafka topic', '#003366', '#ffffff')}
      {box(380, 130, 140, 30, 'eso.audio.*.desk', 'Kafka topic', '#003366', '#ffffff')}
      {box(540, 130, 140, 30, 'eso.alerts.ops', 'Kafka topic', '#003366', '#ffffff')}

      {/* Arrows from Kafka to persistence */}
      {arrow(130, 160, 130, 178)}
      {arrow(290, 160, 290, 178)}
      {arrow(450, 160, 450, 178)}
      {arrow(610, 160, 700, 178)}

      {/* Row 4 — Persistence */}
      {box(60, 186, 150, 30, 'PostgreSQL', 'calls + utterances', 'rgba(39,185,124,0.15)')}
      {box(230, 186, 140, 30, 'risk_events', 'TimescaleDB', 'rgba(39,185,124,0.12)')}
      {box(390, 186, 140, 30, 'llm_prompt_audits', 'immutable log', 'rgba(107,33,168,0.1)')}
      {box(550, 186, 140, 30, 'interventions', 'supervisor log', 'rgba(0,51,102,0.1)')}

      {/* Arrows DB → API */}
      {arrow(130, 216, 130, 242)}
      {arrow(300, 216, 350, 242)}

      {/* Row 5 — Presentation */}
      {box(60, 242, 120, 30, 'Express API', 'REST + WS', 'rgba(0,51,102,0.15)')}
      {arrow(180, 257, 220, 257)}
      {box(220, 242, 120, 30, 'Socket.io', 'live push', 'rgba(200,152,42,0.15)')}
      {arrow(340, 257, 380, 257)}
      {box(380, 242, 120, 30, 'React Dashboard', 'Vite + TS', 'rgba(0,51,102,0.12)')}
      {arrow(500, 257, 540, 257)}
      {box(540, 242, 120, 30, 'Auth0 / RBAC', 'JWT + roles', 'rgba(107,33,168,0.1)')}
      {arrow(660, 257, 700, 257)}
      {box(700, 242, 120, 30, 'Prometheus', '+ Grafana', 'rgba(240,112,32,0.12)')}
    </svg>
  );
}

// SVG auth / request flow diagram
function AuthFlowDiagram() {
  const col = (x: number, label: string) => (
    <g key={label}>
      <text
        x={x}
        y={22}
        textAnchor="middle"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={10}
        fontWeight={700}
        fill="#003366"
      >
        {label}
      </text>
      <line
        x1={x}
        y1={28}
        x2={x}
        y2={280}
        stroke="rgba(0,51,102,0.12)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
    </g>
  );

  const msg = (x1: number, x2: number, y: number, label: string, returning = false) => {
    const dir = x2 > x1 ? 1 : -1;
    return (
      <g key={`${x1}-${x2}-${y}`}>
        <defs>
          <marker id={`mh-${y}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={returning ? '#9CA3AF' : '#003366'} />
          </marker>
        </defs>
        <line
          x1={x1}
          y1={y}
          x2={x2 - dir * 6}
          y2={y}
          stroke={returning ? '#9CA3AF' : '#003366'}
          strokeWidth={returning ? 1 : 1.5}
          strokeDasharray={returning ? '5 3' : undefined}
          markerEnd={`url(#mh-${y})`}
        />
        <text
          x={(x1 + x2) / 2}
          y={y - 5}
          textAnchor="middle"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontSize={9}
          fill={returning ? '#9CA3AF' : '#374151'}
        >
          {label}
        </text>
      </g>
    );
  };

  const cols = [80, 220, 380, 540, 700];

  return (
    <svg
      viewBox="0 0 780 300"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-label="Request and authentication flow diagram"
      role="img"
    >
      <rect width={780} height={300} rx={10} fill="#F4F6F9" />
      {col(cols[0], 'Browser')}
      {col(cols[1], 'Auth0')}
      {col(cols[2], 'Express API')}
      {col(cols[3], 'PostgreSQL')}
      {col(cols[4], 'Kafka')}

      {msg(cols[0], cols[1], 55, 'login / redirect')}
      {msg(cols[1], cols[0], 80, 'JWT (access_token)', true)}
      {msg(cols[0], cols[2], 110, 'GET /api/calls  Authorization: Bearer <JWT>')}
      {msg(cols[2], cols[1], 135, 'JWKS verify', true)}
      {msg(cols[2], cols[3], 160, 'SELECT calls JOIN call_risk_scores')}
      {msg(cols[3], cols[2], 185, '9 rows', true)}
      {msg(cols[2], cols[0], 210, 'JSON response', true)}
      {msg(cols[0], cols[2], 240, 'WS connect  socket.handshake.auth.token')}
      {msg(cols[2], cols[4], 265, 'subscribe  eso.scores.calls')}
      {msg(cols[4], cols[2], 290, 'push on new score → io.emit(call_updated)', true)}
    </svg>
  );
}

function EngineeringView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {/* Tech stack */}
      <Card>
        <SectionLabel>Tech Stack</SectionLabel>
        <H2>Components and their responsibilities</H2>
        <div style={{ marginTop: 16 }}>
          <TechRow
            layer="Capture"
            tech="Node.js Ingestion Service"
            role="Accepts audio chunks from telephony via HTTP or gRPC. Produces each chunk as a Kafka message on the eso.audio.*.desk topic. Stateless and horizontally scalable."
          />
          <TechRow
            layer="Transcription"
            tech="Whisper large-v3 (Airflow)"
            role="Airflow DAG eso_stt_v1 consumes audio chunks, runs OpenAI Whisper for speech-to-text, applies pyannote speaker diarization, then publishes utterances to the ingestion pipeline. Runs on GPU workers scheduled by Airflow's LocalExecutor."
          />
          <TechRow
            layer="Rule Engine"
            tech="Deterministic matcher"
            role="Evaluates each utterance against 40+ regex/phrase rules covering guaranteed returns, artificial urgency, misleading past-performance, and scarcity pressure. Produces RiskEvent records synchronously with zero ML latency."
          />
          <TechRow
            layer="LLM Scoring"
            tech="Claude claude-opus-4-7"
            role="Receives the full call transcript as context and returns a structured JSON risk score (0–100) plus a natural-language rationale. Every request records the SHA-256 prompt hash and response hash in llm_prompt_audits for auditability."
          />
          <TechRow
            layer="Messaging"
            tech="Apache Kafka 7.6 + Zookeeper"
            role="Four topics carry data through the pipeline: eso.audio.*.desk (raw audio), eso.events.risk (rule matches), eso.scores.calls (final scores), eso.alerts.ops (intervention notifications). Partitioned for parallelism; retention 168 h."
          />
          <TechRow
            layer="Persistence"
            tech="PostgreSQL 16 + TimescaleDB"
            role="Stores calls, utterances, risk_events, call_risk_scores, llm_prompt_audits, and interventions. TimescaleDB extension provides time-series compression and efficient range queries on triggered_at columns. Schema managed via migration files under infra/db."
          />
          <TechRow
            layer="API"
            tech="Express + Socket.io (Node.js)"
            role="REST endpoints for call listing, call detail, and feedback. Socket.io server broadcasts call_updated and alert_created events to connected supervisors in real time. Auth middleware verifies Auth0 JWTs using JWKS. Prometheus metrics exposed on /metrics."
          />
          <TechRow
            layer="Frontend"
            tech="React 18 + Vite + TypeScript"
            role="Single-page application with state-based routing (no router library). Shared WebSocket connection hoisted to the App root feeds both the nav badge and the dashboard heatmap. Inline CSS with design tokens — no CSS framework dependency."
          />
          <TechRow
            layer="Auth"
            tech="Auth0 + RBAC"
            role="Three roles: supervisor, compliance, agent. Roles encoded as a custom claim (https://eso.internal/role) in the JWT. API enforces role per endpoint. A demo bypass token (disabled in production) enables sandbox testing without an Auth0 tenant."
          />
          <TechRow
            layer="Observability"
            tech="Prometheus + Grafana + Alertmanager"
            role="API exposes request duration histograms, Kafka consumer lag, and call scoring latency. Grafana dashboard eso-pipeline.json visualises the pipeline SLOs. Alertmanager routes critical-score and consumer-lag alerts to PagerDuty."
          />
          <TechRow
            layer="Infrastructure"
            tech="Docker Compose (dev) / Kubernetes (prod)"
            role="Development stack runs via docker compose up -d with hot-reload bind mounts for api/src and dashboard/src. Production uses Kubernetes with Argo Rollouts for canary deployments and HashiCorp Vault for secret management."
          />
        </div>
      </Card>

      {/* Pipeline diagram */}
      <Card>
        <SectionLabel>Data Pipeline</SectionLabel>
        <H2>End-to-end data flow</H2>
        <Body style={{ marginBottom: 20 }}>
          Audio originates at the telephony layer and flows rightward through transcription, rule
          evaluation, and LLM scoring before reaching Kafka topics. Each downstream consumer —
          PostgreSQL writer, API server, Socket.io broadcaster — reads from the relevant topic
          independently. Arrows across lane boundaries show where data crosses system boundaries.
        </Body>
        <PipelineDiagram />
      </Card>

      {/* Auth / request flow */}
      <Card>
        <SectionLabel>Request &amp; Auth Flow</SectionLabel>
        <H2>How a dashboard session works end-to-end</H2>
        <Body style={{ marginBottom: 20 }}>
          The browser exchanges credentials with Auth0 and receives a short-lived JWT. Every
          subsequent REST call and the WebSocket handshake carry that token in the Authorization
          header or socket handshake auth object. The API verifies the signature against Auth0's
          JWKS endpoint on each request — no server-side session state is maintained.
        </Body>
        <AuthFlowDiagram />
      </Card>

      {/* Key design decisions */}
      <Card>
        <SectionLabel>Design Decisions</SectionLabel>
        <H2>Architecture trade-offs</H2>
        <div style={{ marginTop: 8 }}>
          <AdvantageRow
            title="Kafka for all inter-service communication"
            description="Kafka decouples producers and consumers: the ingestion service does not need to know about the scoring service, and adding a new consumer (e.g. a real-time archiver) requires no changes to existing services. The cost is operational complexity — Zookeeper dependency and topic management. Acceptable at this scale because Kafka's replay capability is essential for reprocessing calls after rule updates."
          />
          <AdvantageRow
            title="Hybrid deterministic + LLM scoring"
            description="Running Claude on every utterance would introduce 1–3 seconds of latency per sentence and cost roughly $0.015 per minute of call. Instead, the rule engine provides sub-100ms first detection; the LLM runs once per call at the end to produce a holistic score and rationale. The deterministic layer handles known phrases; the LLM handles novel formulations and context."
          />
          <AdvantageRow
            title="In-memory call store on the API"
            description="Active calls are held in a JavaScript Map on the API process. This gives the dashboard sub-millisecond read latency and removes a database round-trip from the hot WebSocket broadcast path. The store is seeded from PostgreSQL on startup and is intentionally ephemeral — it does not survive process restart, which is acceptable because the dashboard is a live monitoring tool, not a historical record."
          />
          <AdvantageRow
            title="No router library in the frontend"
            description="The dashboard has four pages and no deep-link requirement. React Router or TanStack Router would add ~50 kB to the bundle and introduce URL-management concerns (back button, bookmarking) that aren't needed for an internal operations tool. A single Page state variable covers all navigation without the surface area."
          />
          <AdvantageRow
            title="Prompt hash logging in llm_prompt_audits"
            description="Every Claude request stores SHA-256(prompt) and SHA-256(response) alongside the model ID and prompt version. This satisfies a regulatory requirement: if the scoring model is updated, the firm can demonstrate which version scored each historical call and reproduce the exact prompt used. The actual prompt text is not stored to limit database growth."
          />
          <AdvantageRow
            title="TimescaleDB for risk event time-series"
            description="risk_events has a triggered_at column that is queried with range predicates on every call-detail page load. TimescaleDB's hypertable partitioning on triggered_at makes those range scans order-of-magnitude faster than a standard B-tree index as data volume grows, with no change to the SQL query interface."
          />
        </div>
      </Card>

      {/* Repo layout */}
      <Card>
        <SectionLabel>Repository Layout</SectionLabel>
        <H2>Monorepo structure</H2>
        <pre
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 12,
            lineHeight: 1.7,
            color: 'var(--dark)',
            backgroundColor: 'var(--light)',
            borderRadius: 8,
            padding: '20px 24px',
            overflowX: 'auto',
            margin: '16px 0 0',
          }}
        >
          {`Ethical_Sales_Oracle/
├── api/                      Express API + Socket.io server
│   └── src/
│       ├── db/               PostgreSQL query modules
│       ├── kafka/            Consumer that feeds in-memory store
│       ├── middleware/       JWT auth + Prometheus metrics
│       ├── routes/           /api/calls  /api/feedback
│       └── store/            In-memory call + alert store
├── dashboard/                React 18 + Vite frontend
│   └── src/
│       ├── auth/             Auth0 context + demo token
│       ├── components/       Nav, RiskHeatmap, AlertFeed, …
│       ├── hooks/            useRiskStream, useCallDetail
│       └── pages/            Dashboard, CallDetail, InfoPage
├── services/
│   └── ingestion/            Audio chunk ingestor → Kafka
├── infra/
│   ├── airflow/dags/         eso_stt_v1  eso_data_retention_v1
│   ├── db/                   SQL migrations
│   ├── docker/               Legacy compose + monitoring stack
│   ├── k8s/                  Kubernetes manifests + Helm values
│   ├── monitoring/           Prometheus rules + Grafana dashboards
│   └── vault/                Vault policy (least-privilege)
├── compose.yml               Single-command dev stack
└── planning/                 BRAND.md  CLAUDE.md  PLAN.md`}
        </pre>
      </Card>
    </div>
  );
}

// ── Page shell ───────────────────────────────────────────────────────────────

type View = 'business' | 'engineering';

export function InfoPage() {
  const [view, setView] = useState<View>('business');

  const tabBase: React.CSSProperties = {
    fontFamily: 'var(--fb)',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    padding: '7px 18px',
    borderRadius: 6,
    cursor: 'pointer',
    border: 'none',
    transition: 'background-color 0.15s, color 0.15s',
  };

  const tabActive: React.CSSProperties = {
    backgroundColor: 'var(--gold)',
    color: 'var(--dark)',
  };

  const tabInactive: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    border: '1px solid rgba(255,255,255,0.2)',
  };

  return (
    <main id="main-content">
      {/* ── Hero header — matches Dashboard hero exactly ─────────────────── */}
      <header
        style={{
          backgroundColor: 'var(--primary)',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          padding: '40px 48px 36px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p
            aria-hidden="true"
            style={{
              fontFamily: 'var(--fb)',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: 10,
            }}
          >
            Ethical Sales Oracle
          </p>
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 30,
              fontWeight: 300,
              color: '#ffffff',
              lineHeight: 1.3,
              maxWidth: 680,
              marginBottom: 24,
            }}
          >
            System <em style={{ fontStyle: 'italic', color: 'var(--gold-light)' }}>overview</em>
          </h1>

          {/* View toggle — occupies the KPI row position */}
          <div
            role="tablist"
            aria-label="Info view selector"
            style={{ display: 'inline-flex', gap: 8 }}
          >
            <button
              role="tab"
              aria-selected={view === 'business'}
              onClick={() => setView('business')}
              style={
                view === 'business' ? { ...tabBase, ...tabActive } : { ...tabBase, ...tabInactive }
              }
            >
              Business View
            </button>
            <button
              role="tab"
              aria-selected={view === 'engineering'}
              onClick={() => setView('engineering')}
              style={
                view === 'engineering'
                  ? { ...tabBase, ...tabActive }
                  : { ...tabBase, ...tabInactive }
              }
            >
              Engineering View
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--light)',
          padding: '40px 48px 80px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {view === 'business' ? <BusinessView /> : <EngineeringView />}
        </div>
      </div>

      {/* ── Footer — matches Dashboard footer ────────────────────────────── */}
      <footer
        style={{
          backgroundColor: 'var(--primary)',
          padding: '20px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--fb)',
          fontSize: 9,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <span>ESO · Ethical Sales Oracle · System Overview</span>
        <span>
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase()}
        </span>
      </footer>
    </main>
  );
}
