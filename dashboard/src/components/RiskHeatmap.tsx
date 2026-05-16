import React, { useCallback } from "react";
import type { CallScore, RiskLevel } from "@/types";
import { RiskBadge } from "./RiskBadge";
import { Eyebrow } from "./Eyebrow";

interface CellColors {
  border: string;
  scoreText: string;
  topAccent: string;
}

const CELL_COLORS: Record<RiskLevel, CellColors> = {
  LOW:      { border: "var(--risk-low-dot)",  scoreText: "var(--risk-low-text)",  topAccent: "var(--risk-low-dot)" },
  MEDIUM:   { border: "var(--risk-med-dot)",  scoreText: "var(--risk-med-text)",  topAccent: "var(--risk-med-dot)" },
  HIGH:     { border: "var(--risk-high-dot)", scoreText: "var(--risk-high-text)", topAccent: "var(--risk-high-dot)" },
  CRITICAL: { border: "var(--risk-crit-bg)",  scoreText: "var(--risk-crit-bg)",  topAccent: "var(--risk-crit-bg)" },
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

interface HeatmapCellProps {
  call: CallScore;
  onSelect: (callId: string) => void;
}

function HeatmapCell({ call, onSelect }: HeatmapCellProps) {
  const { border, scoreText, topAccent } = CELL_COLORS[call.riskLevel];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(call.callId);
      }
    },
    [call.callId, onSelect],
  );

  const shortId = call.callId.slice(-8).toUpperCase();
  const agent = call.agentId ?? "AGT-???";
  const desk = call.deskId ? ` · ${call.deskId.toUpperCase()}` : "";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Call ${shortId}, agent ${agent}, risk level ${call.riskLevel}, score ${call.score}. Press Enter to view details.`}
      onClick={() => onSelect(call.callId)}
      onKeyDown={handleKeyDown}
      style={{
        position: "relative",
        backgroundColor: "var(--white)",
        borderRadius: 12,
        boxShadow: "0 1px 4px rgba(0,51,102,0.08)",
        cursor: "pointer",
        overflow: "hidden",
        transition: "box-shadow 0.15s, transform 0.1s",
        outline: "none",
        border: `1px solid var(--primary-10)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          `0 4px 16px rgba(0,51,102,0.14), 0 0 0 2px ${border}`;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,51,102,0.08)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* Top accent bar — 3px solid, risk level color */}
      <div
        aria-hidden="true"
        style={{ height: 3, backgroundColor: topAccent, width: "100%" }}
      />

      <div style={{ padding: "16px 18px" }}>
        {/* Score — large Fraunces number */}
        <div
          aria-hidden="true"
          style={{
            fontFamily: "var(--fd)",
            fontSize: 44,
            fontWeight: 300,
            color: scoreText,
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          {call.score}
        </div>

        {/* Risk badge */}
        <div style={{ marginBottom: 12 }}>
          <RiskBadge level={call.riskLevel} compact />
        </div>

        {/* Call metadata */}
        <div
          style={{
            fontFamily: "var(--fb)",
            fontSize: 11,
            color: "var(--mid)",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--dark)", marginBottom: 2 }}>
            {agent}{desk}
          </div>
          <div>
            Call <span style={{ fontFamily: "Courier New", fontSize: 10 }}>…{shortId}</span>
          </div>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
            <span>{call.eventCount} event{call.eventCount !== 1 ? "s" : ""}</span>
            <span>{formatTimestamp(call.scoredAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RiskHeatmapProps {
  calls: CallScore[];
  onCallSelect: (callId: string) => void;
  isLoading?: boolean;
}

/**
 * Live risk heatmap — a responsive grid of call cards colour-coded by risk level.
 *
 * Accessibility:
 *   - Each cell has role="button" with a descriptive aria-label
 *   - Enter / Space activates the cell
 *   - Tab order follows document order (grid flow)
 *   - Focus ring uses the brand gold (:focus-visible in tokens.css)
 */
export function RiskHeatmap({ calls, onCallSelect, isLoading = false }: RiskHeatmapProps) {
  // Sort: CRITICAL first, then HIGH, MEDIUM, LOW; within each band sort by score desc
  const sorted = [...calls].sort((a, b) => {
    const order: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.riskLevel] - order[b.riskLevel] || b.score - a.score;
  });

  return (
    <section aria-labelledby="heatmap-heading">
      <Eyebrow>Active calls</Eyebrow>
      <h2
        id="heatmap-heading"
        style={{
          fontFamily: "var(--fd)",
          fontSize: 22,
          fontWeight: 300,
          color: "var(--dark)",
          marginBottom: 20,
        }}
      >
        Live risk{" "}
        <em style={{ fontStyle: "italic" }}>heatmap</em>
      </h2>

      {isLoading && calls.length === 0 && (
        <p
          role="status"
          aria-live="polite"
          style={{ fontFamily: "var(--fb)", fontSize: 14, color: "var(--mid)", padding: "48px 0" }}
        >
          Connecting to live stream…
        </p>
      )}

      {!isLoading && calls.length === 0 && (
        <p
          role="status"
          aria-live="polite"
          style={{ fontFamily: "var(--fb)", fontSize: 14, color: "var(--mid)", padding: "48px 0" }}
        >
          No active calls at this time.
        </p>
      )}

      {sorted.length > 0 && (
        <div
          role="grid"
          aria-label={`Risk heatmap — ${sorted.length} active call${sorted.length !== 1 ? "s" : ""}`}
          aria-rowcount={Math.ceil(sorted.length / 4)}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 16,
          }}
        >
          {sorted.map((call) => (
            <div key={call.callId} role="gridcell">
              <HeatmapCell call={call} onSelect={onCallSelect} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
