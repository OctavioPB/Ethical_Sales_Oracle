import React from "react";
import { Eyebrow } from "./Eyebrow";
import { RiskBadge } from "./RiskBadge";
import type { CallDetail } from "@/types";

interface RationalePanelProps {
  detail: CallDetail;
}

export function RationalePanel({ detail }: RationalePanelProps) {
  const { call, rationale, promptVersion, model } = detail;

  return (
    <section
      aria-labelledby="rationale-heading"
      style={{
        backgroundColor: "var(--white)",
        borderRadius: 12,
        border: "1px solid var(--primary-10)",
        boxShadow: "0 1px 4px rgba(0,51,102,0.06)",
        padding: "24px 24px 20px",
        marginBottom: 16,
      }}
    >
      <Eyebrow>LLM analysis</Eyebrow>
      <h3
        id="rationale-heading"
        style={{
          fontFamily: "var(--fd)",
          fontSize: 18,
          fontWeight: 300,
          color: "var(--dark)",
          marginBottom: 16,
        }}
      >
        Risk <em style={{ fontStyle: "italic" }}>rationale</em>
      </h3>

      {/* Score summary */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          padding: "12px 16px",
          backgroundColor: "var(--light)",
          borderRadius: 8,
        }}
      >
        <div
          aria-label={`Risk score: ${call.score}`}
          style={{
            fontFamily: "var(--fd)",
            fontSize: 40,
            fontWeight: 300,
            color: "var(--primary)",
            lineHeight: 1,
          }}
        >
          {call.score}
        </div>
        <div>
          <RiskBadge level={call.riskLevel} />
          <div
            style={{
              fontFamily: "var(--fb)",
              fontSize: 10,
              color: "var(--mid)",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            <div>Deterministic: {call.deterministicScore}</div>
            <div>LLM score: {call.llmScore}</div>
          </div>
        </div>
      </div>

      {/* Rationale text */}
      {rationale ? (
        <blockquote
          style={{
            fontFamily: "var(--fb)",
            fontSize: 13,
            color: "var(--dark)",
            lineHeight: 1.7,
            margin: 0,
            padding: "12px 16px",
            borderLeft: "3px solid var(--primary-30)",
            backgroundColor: "var(--light)",
            borderRadius: "0 8px 8px 0",
          }}
        >
          {rationale}
        </blockquote>
      ) : (
        <p
          style={{
            fontFamily: "var(--fb)",
            fontSize: 13,
            color: "var(--mid)",
            fontStyle: "italic",
          }}
        >
          Rationale not available for this call.
        </p>
      )}

      {/* Model metadata */}
      {(model ?? promptVersion) && (
        <div
          style={{
            marginTop: 14,
            fontFamily: "var(--fb)",
            fontSize: 10,
            color: "var(--mid)",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {model && <span>Model: {model}</span>}
          {promptVersion && <span>Prompt: {promptVersion}</span>}
        </div>
      )}
    </section>
  );
}
