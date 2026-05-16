import React from "react";

interface KpiCardProps {
  value: string | number;
  label: string;
  sub?: string;
  accentColor?: string;
}

/**
 * Dashboard KPI stat card — left gold accent bar variant from BRAND.md.
 * White bg, 12px border-radius, left 3px gold bar.
 */
export function KpiCard({ value, label, sub, accentColor = "var(--gold)" }: KpiCardProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "var(--white)",
        borderRadius: 12,
        boxShadow: "0 1px 4px rgba(0,51,102,0.08)",
        overflow: "hidden",
        minWidth: 140,
      }}
    >
      {/* Left accent bar */}
      <div
        aria-hidden="true"
        style={{
          width: 3,
          flexShrink: 0,
          backgroundColor: accentColor,
        }}
      />
      <div style={{ padding: "20px 24px", flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--fd)",
            fontSize: 32,
            fontWeight: 300,
            color: "var(--dark)",
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontFamily: "var(--fb)",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--mid)",
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontFamily: "var(--fb)",
              fontSize: 11,
              color: "var(--mid)",
              marginTop: 4,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
