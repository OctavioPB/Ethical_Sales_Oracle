import React, { useEffect, useRef } from "react";
import type { RiskAlert } from "@/types";
import { Eyebrow } from "./Eyebrow";

const CATEGORY_LABELS: Record<string, string> = {
  PROHIBITED_PROMISE: "Prohibited promise",
  PRESSURE_TACTIC: "Pressure tactic",
  MISSING_DISCLAIMER: "Missing disclaimer",
  OFF_SCRIPT_CLAIM: "Off-script claim",
};

const CATEGORY_COLORS: Record<string, string> = {
  PROHIBITED_PROMISE: "var(--risk-high-dot)",
  PRESSURE_TACTIC: "var(--risk-med-dot)",
  MISSING_DISCLAIMER: "var(--risk-low-dot)",
  OFF_SCRIPT_CLAIM: "var(--risk-med-dot)",
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

function AlertItem({ alert }: { alert: RiskAlert }) {
  const accentColor = CATEGORY_COLORS[alert.category] ?? "var(--mid)";
  const categoryLabel = CATEGORY_LABELS[alert.category] ?? alert.category;
  const shortCallId = alert.callId.slice(-8).toUpperCase();

  return (
    <li
      aria-label={`${categoryLabel} alert on call ${shortCallId} at ${formatTime(alert.triggeredAt)}`}
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--primary-10)",
        borderLeft: `3px solid ${accentColor}`,
        backgroundColor: "var(--white)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {/* Rule + time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{
            fontFamily: "var(--fb)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: accentColor,
          }}
        >
          {categoryLabel}
        </span>
        <span
          style={{
            fontFamily: "var(--fb)",
            fontSize: 10,
            color: "var(--mid)",
          }}
        >
          {formatTime(alert.triggeredAt)}
        </span>
      </div>

      {/* Matched phrase */}
      {alert.matchedPhrase && (
        <blockquote
          style={{
            fontFamily: "var(--fb)",
            fontSize: 12,
            fontStyle: "italic",
            color: "var(--dark)",
            margin: 0,
            borderLeft: "none",
          }}
          aria-label={`Matched phrase: ${alert.matchedPhrase}`}
        >
          "{alert.matchedPhrase}"
        </blockquote>
      )}

      {/* Call + rule metadata */}
      <div
        style={{
          fontFamily: "var(--fb)",
          fontSize: 10,
          color: "var(--mid)",
          display: "flex",
          gap: 12,
        }}
      >
        <span>
          Call <span style={{ fontFamily: "Courier New" }}>…{shortCallId}</span>
        </span>
        <span aria-label={`Rule ${alert.ruleId}`}>{alert.ruleId}</span>
        <span>
          {(alert.confidence * 100).toFixed(0)}% conf.
        </span>
      </div>
    </li>
  );
}

interface AlertFeedProps {
  alerts: RiskAlert[];
  maxItems?: number;
}

/**
 * Scrolling live alert feed — shows the most recent CRITICAL and HIGH events.
 * New items are prepended. aria-live="polite" announces additions to screen readers.
 */
export function AlertFeed({ alerts, maxItems = 50 }: AlertFeedProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-scroll to top when new alerts arrive (newest first)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [alerts.length]);

  const visible = alerts.slice(0, maxItems);

  return (
    <section aria-labelledby="alert-feed-heading" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <Eyebrow>Alert registry</Eyebrow>
        <h2
          id="alert-feed-heading"
          style={{
            fontFamily: "var(--fd)",
            fontSize: 22,
            fontWeight: 300,
            color: "var(--dark)",
          }}
        >
          Live <em style={{ fontStyle: "italic" }}>alerts</em>
        </h2>
      </div>

      {visible.length === 0 ? (
        <p
          role="status"
          aria-live="polite"
          style={{ fontFamily: "var(--fb)", fontSize: 13, color: "var(--mid)", padding: "24px 0" }}
        >
          No alerts yet. Monitoring active calls.
        </p>
      ) : (
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            borderRadius: 12,
            border: "1px solid var(--primary-10)",
            boxShadow: "0 1px 4px rgba(0,51,102,0.06)",
          }}
        >
          <ul
            ref={listRef}
            role="feed"
            aria-live="polite"
            aria-label="Live risk alert feed"
            aria-relevant="additions"
            style={{
              listStyle: "none",
              overflow: "auto",
              maxHeight: 520,
              margin: 0,
              padding: 0,
            }}
          >
            {visible.map((alert) => (
              <AlertItem key={alert.eventId} alert={alert} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
