# Supervisor Onboarding Guide — Ethical Sales Oracle

**Role:** Sales team supervisor · Real-time call monitor  
**Access level:** Can view all active calls and intervene; cannot export regulatory reports

---

## What ESO does for you

ESO monitors every sales call on your desk in real time. When an agent uses a prohibited phrase, makes an unsupported product claim, or omits a required disclaimer, you receive an alert within 8 seconds. You can then:

- **Watch** the live risk heatmap to spot calls approaching a critical score
- **Drill in** to see the exact transcript fragment that triggered the alert
- **Intervene** with one click — alert the agent, request a pause, or add a note to the call record

---

## Logging in

1. Open `https://eso.your-domain.com` in your browser
2. Click **Log in** — you will be redirected to the company identity provider
3. Use your standard corporate credentials (same as email / Teams)
4. After sign-in you land on the **Dashboard**

If you see a blank screen or "Insufficient role" message, contact IT to confirm your Auth0 role is set to `supervisor`.

---

## The Dashboard

The main view is a **risk heatmap** — one tile per active call. Colour indicates current risk level:

| Colour | Score | What it means |
|---|---|---|
| Green | 0–30 | No action needed |
| Yellow | 31–60 | Worth monitoring; review post-call |
| Orange | 61–85 | You will receive a real-time alert |
| Red | 86–100 | Immediate attention; consider intervening |

The **Alert Feed** on the right shows the most recent high and critical events across all calls, newest at the top.

The status bar at the top shows whether your real-time connection is active (green dot) or whether the dashboard has fallen back to 30-second polling (amber dot).

---

## Viewing a call in detail

Click any tile on the heatmap to open the **Call Detail** view.

You will see:

- **Hero bar** — call ID, agent name, current risk score and badge
- **Transcript pane** — full diarized conversation; agent utterances on the left, customer on the right
- **Highlighted phrases** — flagged utterances have a coloured left border and bolded trigger words; risk category chips appear below each flagged bubble
- **Rationale panel** — the LLM's explanation of why the call received this score, plus the model and prompt version used
- **Interventions** — a log of all supervisor actions taken on this call

---

## Intervening in a live call

From the Call Detail view, use the **Intervention** buttons in the right sidebar:

| Button | What happens |
|---|---|
| **Alert agent** | Sends a silent in-ear notification to the agent's headset system |
| **Pause call** | Flags the call for the agent to request a brief hold |
| **Note** | Adds a free-text annotation to the call record (visible to compliance) |

All interventions are **permanent** and immediately visible to the compliance team. There is no undo.

After submitting, the intervention appears instantly in the log at the bottom of the sidebar.

---

## Flagging a false positive

If the system flagged a call that you believe was scored incorrectly, click **Flag as false positive** in the Call Detail hero bar.

Optionally add a brief reason (e.g. "the phrase 'guaranteed appointment' is not a prohibited promise"). This feeds into the NLP team's weekly rule-review backlog. It does not affect the call's current score.

---

## What you cannot do (by design)

- Export regulatory PDF reports — that is the compliance officer's role
- Delete or edit intervention records — the audit trail is immutable
- Access calls from other regions or desks you are not assigned to (enforced at data level, not role level — contact your admin if you need cross-desk visibility)

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Dashboard shows "Disconnected" | Check your network; the dashboard will poll every 30s automatically. Refresh if it stays amber for > 2 minutes. |
| A call is visible on the heatmap but detail shows "Call not found" | The call may have ended before detail loaded. Refresh the page. |
| Intervention button is greyed out | Confirm your role is `supervisor`. If correct, the call may have ended. |
| You receive a PagerDuty alert but the dashboard looks normal | The pipeline may be recovering. Check with the on-call engineer. |

---

## Getting help

- **Internal helpdesk:** #eso-support Slack channel
- **Urgent production issues:** PagerDuty on-call rotation (see the runbook at `docs/runbook/incident-response.md`)
