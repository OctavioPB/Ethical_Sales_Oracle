import React from "react";
import type { RiskLevel } from "@/types";

interface RiskColors {
  dot: string;
  bg: string;
  text: string;
}

const COLORS: Record<RiskLevel, RiskColors> = {
  LOW:      { dot: "var(--risk-low-dot)",  bg: "var(--risk-low-bg)",  text: "var(--risk-low-text)" },
  MEDIUM:   { dot: "var(--risk-med-dot)",  bg: "var(--risk-med-bg)",  text: "var(--risk-med-text)" },
  HIGH:     { dot: "var(--risk-high-dot)", bg: "var(--risk-high-bg)", text: "var(--risk-high-text)" },
  CRITICAL: { dot: "var(--risk-crit-dot)", bg: "var(--risk-crit-bg)", text: "var(--risk-crit-text)" },
};

const LABELS: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  /** Renders a compact pill without the numeric score. */
  compact?: boolean;
}

/**
 * Severity badge following the BRAND.md status badge system.
 * Pill shape, 6px dot indicator, 10px font, padding 4px 12px.
 */
export function RiskBadge({ level, score, compact = false }: RiskBadgeProps) {
  const { dot, bg, text } = COLORS[level];
  const label = LABELS[level];

  return (
    <span
      role="status"
      aria-label={`Risk level: ${label}${score !== undefined ? `, score ${score}` : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        backgroundColor: bg,
        color: text,
        borderRadius: 20,
        padding: compact ? "3px 10px" : "4px 12px",
        fontFamily: "var(--fb)",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: dot,
          flexShrink: 0,
        }}
      />
      {label}
      {!compact && score !== undefined && (
        <span style={{ opacity: 0.75, marginLeft: 2 }}>{score}</span>
      )}
    </span>
  );
}
