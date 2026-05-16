import React from "react";
import type { AnnotatedUtterance, RiskEvent } from "@/types";
import { RiskBadge } from "./RiskBadge";
import { Eyebrow } from "./Eyebrow";

const CATEGORY_COLORS: Record<string, string> = {
  PROHIBITED_PROMISE: "var(--risk-high-dot)",
  PRESSURE_TACTIC:    "var(--risk-med-dot)",
  MISSING_DISCLAIMER: "var(--risk-low-dot)",
  OFF_SCRIPT_CLAIM:   "var(--risk-med-dot)",
};

const CATEGORY_LABELS: Record<string, string> = {
  PROHIBITED_PROMISE: "Prohibited promise",
  PRESSURE_TACTIC:    "Pressure tactic",
  MISSING_DISCLAIMER: "Missing disclaimer",
  OFF_SCRIPT_CLAIM:   "Off-script claim",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

// Bolds the matched phrase within utterance text (case-insensitive, first occurrence)
function highlightPhrase(utterance: string, phrase: string): React.ReactNode {
  if (!phrase) return utterance;
  const idx = utterance.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx === -1) return utterance;
  return (
    <>
      {utterance.slice(0, idx)}
      <mark
        style={{
          backgroundColor: "rgba(224,52,72,0.12)",
          color: "var(--risk-high-text)",
          fontWeight: 600,
          borderRadius: 2,
          padding: "0 2px",
        }}
      >
        {utterance.slice(idx, idx + phrase.length)}
      </mark>
      {utterance.slice(idx + phrase.length)}
    </>
  );
}

function RiskEventChip({ event }: { event: RiskEvent }) {
  const color = CATEGORY_COLORS[event.category] ?? "var(--mid)";
  const label = CATEGORY_LABELS[event.category] ?? event.category;
  return (
    <span
      aria-label={`${label}: "${event.matchedPhrase}" (${(event.confidence * 100).toFixed(0)}% confidence)`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        backgroundColor: "var(--risk-high-bg)",
        border: `1px solid ${color}`,
        borderRadius: 20,
        padding: "2px 10px",
        fontFamily: "var(--fb)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color,
        marginTop: 6,
        marginRight: 6,
      }}
    >
      <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
      {label} · {(event.confidence * 100).toFixed(0)}%
    </span>
  );
}

interface UtteranceRowProps {
  utt: AnnotatedUtterance;
}

function UtteranceRow({ utt }: UtteranceRowProps) {
  const isAgent = utt.speaker === "AGENT";
  const isFlagged = utt.riskEvents.length > 0;
  const accentColor = isFlagged
    ? (CATEGORY_COLORS[utt.riskEvents[0].category] ?? "var(--risk-high-dot)")
    : "transparent";

  // Use the first matched phrase for inline highlighting (most severe event first)
  const firstPhrase = utt.riskEvents[0]?.matchedPhrase ?? "";

  return (
    <li
      aria-label={`${utt.speaker} at ${formatTime(utt.startedAt)}${isFlagged ? " — flagged" : ""}`}
      style={{
        display: "flex",
        flexDirection: isAgent ? "row" : "row-reverse",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--primary-10)",
      }}
    >
      {/* Speaker label */}
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <span
          aria-hidden="true"
          style={{
            display: "block",
            fontFamily: "var(--fb)",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: isAgent ? "var(--primary)" : "var(--mid)",
            textAlign: isAgent ? "left" : "right",
            minWidth: 56,
          }}
        >
          {utt.speaker}
        </span>
        <span
          style={{
            display: "block",
            fontFamily: "var(--fb)",
            fontSize: 9,
            color: "var(--mid)",
            textAlign: isAgent ? "left" : "right",
          }}
        >
          {formatTime(utt.startedAt)}
        </span>
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: "72%",
          backgroundColor: isAgent ? "var(--white)" : "var(--light)",
          borderRadius: isAgent ? "0 12px 12px 12px" : "12px 0 12px 12px",
          padding: "10px 14px",
          boxShadow: "0 1px 3px rgba(0,51,102,0.06)",
          borderLeft: isFlagged && isAgent ? `3px solid ${accentColor}` : undefined,
          borderRight: isFlagged && !isAgent ? `3px solid ${accentColor}` : undefined,
        }}
      >
        <p
          style={{
            fontFamily: "var(--fb)",
            fontSize: 13,
            color: "var(--dark)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {isFlagged ? highlightPhrase(utt.utterance, firstPhrase) : utt.utterance}
        </p>

        {isFlagged && (
          <div role="list" aria-label="Risk flags on this utterance" style={{ marginTop: 4 }}>
            {utt.riskEvents.map((e) => (
              <span key={e.eventId} role="listitem">
                <RiskEventChip event={e} />
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

interface CallTranscriptProps {
  utterances: AnnotatedUtterance[];
  flaggedCount: number;
}

export function CallTranscript({ utterances, flaggedCount }: CallTranscriptProps) {
  return (
    <section aria-labelledby="transcript-heading">
      <div style={{ marginBottom: 16 }}>
        <Eyebrow>Diarized transcript</Eyebrow>
        <h2
          id="transcript-heading"
          style={{
            fontFamily: "var(--fd)",
            fontSize: 22,
            fontWeight: 300,
            color: "var(--dark)",
          }}
        >
          Call <em style={{ fontStyle: "italic" }}>transcript</em>
        </h2>
        {flaggedCount > 0 && (
          <p
            role="status"
            style={{
              fontFamily: "var(--fb)",
              fontSize: 11,
              color: "var(--risk-high-text)",
              marginTop: 6,
            }}
          >
            {flaggedCount} flagged utterance{flaggedCount !== 1 ? "s" : ""} — highlighted below.
          </p>
        )}
      </div>

      {utterances.length === 0 ? (
        <p style={{ fontFamily: "var(--fb)", fontSize: 13, color: "var(--mid)", padding: "24px 0" }}>
          Transcript not yet available.
        </p>
      ) : (
        <ul
          role="list"
          aria-label={`Call transcript — ${utterances.length} utterances`}
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {utterances.map((utt) => (
            <UtteranceRow key={utt.id} utt={utt} />
          ))}
        </ul>
      )}
    </section>
  );
}
