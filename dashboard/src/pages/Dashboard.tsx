import React, { useState } from "react";
import type { CallScore, RiskAlert, RiskLevel } from "@/types";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { AlertFeed } from "@/components/AlertFeed";

function deriveKpis(calls: CallScore[]) {
  const total = calls.length;
  const critical = calls.filter((c) => c.riskLevel === "CRITICAL").length;
  const high = calls.filter((c) => c.riskLevel === "HIGH").length;
  const avgScore = total > 0
    ? Math.round(calls.reduce((s, c) => s + c.score, 0) / total)
    : 0;
  return { total, critical, high, avgScore };
}

function accumulateAlerts(latestAlert: RiskAlert | null, prev: RiskAlert[]): RiskAlert[] {
  if (!latestAlert) return prev;
  if (prev.length > 0 && prev[0].eventId === latestAlert.eventId) return prev;
  return [latestAlert, ...prev].slice(0, 100);
}

interface DashboardProps {
  calls: CallScore[];
  latestAlert: RiskAlert | null;
  isConnected: boolean;
  isPolling: boolean;
  lastUpdated: Date | null;
  onCallSelect: (callId: string) => void;
}

export function Dashboard({
  calls,
  latestAlert,
  isConnected,
  isPolling,
  lastUpdated,
  onCallSelect,
}: DashboardProps) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  React.useEffect(() => {
    setAlerts((prev) => accumulateAlerts(latestAlert, prev));
  }, [latestAlert]);

  const { total, critical, high, avgScore } = deriveKpis(calls);

  return (
    <main id="main-content">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: "var(--primary)",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          padding: "40px 48px 36px",
        }}
      >
        <div style={{ maxWidth: 1300, margin: "0 auto" }}>
          <p
            aria-hidden="true"
            style={{
              fontFamily: "var(--fb)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "4px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              marginBottom: 10,
            }}
          >
            Real-time compliance monitoring
          </p>
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 30,
              fontWeight: 300,
              color: "#ffffff",
              lineHeight: 1.3,
              maxWidth: 680,
              marginBottom: 24,
            }}
          >
            Supervisor{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-light)" }}>dashboard</em>
          </h1>

          {/* KPI stat row */}
          <div
            role="list"
            aria-label="Key performance indicators"
            style={{ display: "flex", gap: 24, flexWrap: "wrap" }}
          >
            {[
              { value: total,                        label: "Active calls",   accentColor: "var(--gold)" },
              { value: critical,                     label: "Critical alerts", accentColor: "var(--risk-high-dot)" },
              { value: high,                         label: "High risk",       accentColor: "var(--risk-med-dot)" },
              { value: avgScore > 0 ? avgScore : "—", label: "Avg. risk score", accentColor: "var(--primary-30)" },
            ].map(({ value, label }) => (
              <div role="listitem" key={label}>
                <div style={{ borderLeft: "2px solid var(--gold)", paddingLeft: 18 }}>
                  <div
                    aria-label={`${label}: ${value}`}
                    style={{
                      fontFamily: "'Fraunces', Georgia, serif",
                      fontSize: 34,
                      fontWeight: 300,
                      color: "#E8C46A",
                      lineHeight: 1,
                      marginBottom: 8,
                    }}
                  >
                    {value}
                  </div>
                  <div
                    aria-hidden="true"
                    style={{
                      fontFamily: "var(--fb)",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                      lineHeight: 1.55,
                    }}
                  >
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Polling / stale data warning ────────────────────────────────── */}
      {isPolling && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            backgroundColor: "var(--risk-med-bg)",
            borderBottom: "1px solid var(--risk-med-dot)",
            padding: "8px 48px",
            fontFamily: "var(--fb)",
            fontSize: 11,
            color: "var(--risk-med-text)",
            letterSpacing: "0.5px",
          }}
        >
          Live stream disconnected — refreshing every 30 seconds via polling.
          {lastUpdated && ` Last updated: ${lastUpdated.toLocaleTimeString()}.`}
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "40px 48px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: 32,
            alignItems: "start",
          }}
        >
          <RiskHeatmap
            calls={calls}
            onCallSelect={onCallSelect}
            isLoading={!isConnected && !isPolling && calls.length === 0}
          />
          <AlertFeed alerts={alerts} />
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        style={{
          backgroundColor: "var(--primary)",
          padding: "20px 48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--fb)",
          fontSize: 9,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        <span>ESO · Ethical Sales Oracle · Supervisor Dashboard</span>
        <span>
          {new Date()
            .toLocaleDateString("en-US", { year: "numeric", month: "long" })
            .toUpperCase()}
        </span>
      </footer>
    </main>
  );
}
