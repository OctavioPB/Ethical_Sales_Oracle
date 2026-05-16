import React, { useState } from "react";
import type { InterventionEvent } from "@/types";
import { Eyebrow } from "./Eyebrow";

const ACTION_LABELS: Record<InterventionEvent["action"], string> = {
  ALERT_AGENT: "Alert agent",
  PAUSE_CALL:  "Pause call",
  NOTE:        "Add note",
};

const ACTION_DESCRIPTIONS: Record<InterventionEvent["action"], string> = {
  ALERT_AGENT: "Sends an in-call notification to the agent's headset application.",
  PAUSE_CALL:  "Requests the call be placed on hold for supervisor review.",
  NOTE:        "Logs a compliance note without interrupting the call.",
};

const ACTION_COLORS: Record<InterventionEvent["action"], string> = {
  ALERT_AGENT: "var(--risk-high-dot)",
  PAUSE_CALL:  "var(--risk-med-dot)",
  NOTE:        "var(--primary)",
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

interface InterventionPanelProps {
  callId: string;
  interventions: InterventionEvent[];
  isSupervisor: boolean;
  token: string | null;
  onIntervention: (event: InterventionEvent) => void;
}

export function InterventionPanel({
  callId,
  interventions,
  isSupervisor,
  token,
  onIntervention,
}: InterventionPanelProps) {
  const [pending, setPending] = useState<InterventionEvent["action"] | null>(null);
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

  async function handleConfirm() {
    if (!pending || !token) return;
    setIsSending(true);
    setSendError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/calls/${encodeURIComponent(callId)}/interventions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: pending, note: note || undefined }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { intervention } = (await res.json()) as { intervention: InterventionEvent };
      onIntervention(intervention);
      setPending(null);
      setNote("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section
      aria-labelledby="intervention-heading"
      style={{
        backgroundColor: "var(--white)",
        borderRadius: 12,
        border: "1px solid var(--primary-10)",
        boxShadow: "0 1px 4px rgba(0,51,102,0.06)",
        padding: "24px 24px 20px",
      }}
    >
      <Eyebrow>Supervisor actions</Eyebrow>
      <h3
        id="intervention-heading"
        style={{
          fontFamily: "var(--fd)",
          fontSize: 18,
          fontWeight: 300,
          color: "var(--dark)",
          marginBottom: 16,
        }}
      >
        Intervention <em style={{ fontStyle: "italic" }}>log</em>
      </h3>

      {/* Past interventions */}
      {interventions.length > 0 ? (
        <ul
          role="list"
          aria-label="Logged interventions"
          style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}
        >
          {interventions.map((evt) => (
            <li
              key={evt.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid var(--primary-10)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "var(--fb)",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: ACTION_COLORS[evt.action],
                  }}
                >
                  {ACTION_LABELS[evt.action]}
                </span>
                {evt.note && (
                  <p style={{ fontFamily: "var(--fb)", fontSize: 12, color: "var(--dark)", margin: "4px 0 0" }}>
                    {evt.note}
                  </p>
                )}
                <p style={{ fontFamily: "var(--fb)", fontSize: 10, color: "var(--mid)", margin: "2px 0 0" }}>
                  {evt.supervisorId}
                </p>
              </div>
              <time
                dateTime={evt.triggeredAt}
                style={{ fontFamily: "var(--fb)", fontSize: 10, color: "var(--mid)", flexShrink: 0 }}
              >
                {formatTime(evt.triggeredAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p
          style={{
            fontFamily: "var(--fb)",
            fontSize: 12,
            color: "var(--mid)",
            marginBottom: 20,
            fontStyle: "italic",
          }}
        >
          No interventions logged for this call.
        </p>
      )}

      {/* Action buttons — supervisor only */}
      {isSupervisor && !pending && (
        <div role="group" aria-label="Intervention actions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["ALERT_AGENT", "PAUSE_CALL", "NOTE"] as const).map((action) => (
            <button
              key={action}
              onClick={() => setPending(action)}
              style={{
                background: "none",
                border: `1px solid ${ACTION_COLORS[action]}`,
                borderRadius: 8,
                padding: "8px 14px",
                fontFamily: "var(--fb)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: ACTION_COLORS[action],
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      )}

      {/* Confirmation step */}
      {pending && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="confirm-heading"
          style={{
            backgroundColor: "var(--light)",
            borderRadius: 10,
            padding: "16px",
            border: `1px solid ${ACTION_COLORS[pending]}`,
          }}
        >
          <p
            id="confirm-heading"
            style={{
              fontFamily: "var(--fb)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--dark)",
              marginBottom: 6,
            }}
          >
            {ACTION_LABELS[pending]}
          </p>
          <p style={{ fontFamily: "var(--fb)", fontSize: 11, color: "var(--mid)", marginBottom: 12, lineHeight: 1.6 }}>
            {ACTION_DESCRIPTIONS[pending]}
          </p>

          {pending === "NOTE" && (
            <textarea
              aria-label="Note text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontFamily: "var(--fb)",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid var(--primary-30)",
                padding: "8px 10px",
                marginBottom: 10,
                resize: "vertical",
              }}
              placeholder="Enter note (max 500 characters)…"
            />
          )}

          {sendError && (
            <p role="alert" style={{ fontFamily: "var(--fb)", fontSize: 11, color: "var(--risk-high-dot)", marginBottom: 8 }}>
              {sendError}
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => void handleConfirm()}
              disabled={isSending}
              style={{
                backgroundColor: ACTION_COLORS[pending],
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "7px 16px",
                fontFamily: "var(--fb)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                cursor: isSending ? "not-allowed" : "pointer",
                opacity: isSending ? 0.6 : 1,
              }}
            >
              {isSending ? "Sending…" : "Confirm"}
            </button>
            <button
              onClick={() => { setPending(null); setNote(""); setSendError(null); }}
              disabled={isSending}
              style={{
                background: "none",
                border: "1px solid var(--primary-30)",
                borderRadius: 6,
                padding: "7px 16px",
                fontFamily: "var(--fb)",
                fontSize: 9,
                letterSpacing: "2px",
                textTransform: "uppercase",
                cursor: "pointer",
                color: "var(--mid)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
