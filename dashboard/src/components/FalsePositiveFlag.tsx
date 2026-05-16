import { useState } from "react";
import type { CallScore } from "../types";

interface Props {
  call: CallScore;
  token: string;
  onFlagged?: () => void;
}

type State = "idle" | "open" | "submitting" | "done" | "error";

export function FalsePositiveFlag({ call, token, onFlagged }: Props) {
  const [state, setState] = useState<State>("idle");
  const [reason, setReason] = useState("");

  function open() {
    setState("open");
  }

  function cancel() {
    setState("idle");
    setReason("");
  }

  async function submit() {
    setState("submitting");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/calls/${call.callId}/false-positive`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("done");
      onFlagged?.();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p role="status" style={{ color: "var(--color-success)", fontSize: "0.875rem" }}>
        Flagged for rule review — thank you.
      </p>
    );
  }

  if (state === "idle") {
    return (
      <button
        onClick={open}
        style={{
          background: "none",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          fontSize: "0.8125rem",
          padding: "4px 10px",
        }}
      >
        Flag as false positive
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Flag false positive"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        maxWidth: "360px",
      }}
    >
      <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "0.9375rem" }}>
        Flag as false positive
      </p>
      <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
        This will add the call to the rule-refinement backlog so the NLP team can review it.
      </p>
      <label htmlFor="fp-reason" style={{ fontSize: "0.875rem", display: "block", marginBottom: "4px" }}>
        Reason (optional)
      </label>
      <textarea
        id="fp-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="e.g. 'guaranteed appointment' was flagged as 'guaranteed return'"
        style={{
          width: "100%",
          boxSizing: "border-box",
          resize: "vertical",
          fontSize: "0.875rem",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          padding: "6px 8px",
        }}
      />
      {state === "error" && (
        <p role="alert" style={{ color: "var(--color-risk-critical)", fontSize: "0.8125rem", margin: "6px 0 0" }}>
          Submission failed — please try again.
        </p>
      )}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" }}>
        <button
          onClick={cancel}
          disabled={state === "submitting"}
          style={{
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            padding: "6px 14px",
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={state === "submitting"}
          style={{
            background: "var(--color-brand)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            color: "#fff",
            cursor: state === "submitting" ? "not-allowed" : "pointer",
            padding: "6px 14px",
            opacity: state === "submitting" ? 0.7 : 1,
          }}
        >
          {state === "submitting" ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
