import React, { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import type { AppSettings } from '@/hooks/useSettings';

// ── Primitive controls ───────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--fb)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '3px',
        textTransform: 'uppercase',
        color: 'var(--gold)',
        marginBottom: 10,
      }}
    >
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 22,
        fontWeight: 300,
        color: 'var(--dark)',
        marginBottom: 4,
        lineHeight: 1.25,
      }}
    >
      {children}
    </h2>
  );
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--fb)',
        fontSize: 13,
        color: 'var(--mid)',
        lineHeight: 1.65,
        marginBottom: 24,
      }}
    >
      {children}
    </p>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--white)',
        borderRadius: 10,
        padding: '28px 32px',
        boxShadow: '0 1px 4px rgba(0,51,102,0.07)',
        border: '1px solid rgba(0,51,102,0.07)',
        borderTop: accent ? `3px solid ${accent}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
  htmlFor,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 24,
        padding: '16px 0',
        borderBottom: '1px solid rgba(0,51,102,0.06)',
      }}
    >
      <div style={{ flex: 1 }}>
        <label
          htmlFor={htmlFor}
          style={{
            display: 'block',
            fontFamily: 'var(--fb)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--dark)',
            marginBottom: description ? 3 : 0,
            cursor: htmlFor ? 'pointer' : 'default',
          }}
        >
          {label}
        </label>
        {description && (
          <p
            style={{
              fontFamily: 'var(--fb)',
              fontSize: 12,
              color: 'var(--mid)',
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: checked ? 'var(--primary)' : 'rgba(0,51,102,0.15)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: 'var(--white)',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          display: 'block',
        }}
      />
    </button>
  );
}

function RadioGroup<T extends string>({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div id={id} role="radiogroup" style={{ display: 'flex', gap: 6 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            style={{
              fontFamily: 'var(--fb)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '1px',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(0,51,102,0.2)',
              backgroundColor: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--white)' : 'var(--mid)',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Slider({
  id,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 160, accentColor: 'var(--primary)', cursor: 'pointer' }}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      />
      <span
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 18,
          fontWeight: 300,
          color: 'var(--dark)',
          minWidth: 48,
          textAlign: 'right',
        }}
      >
        {display}
      </span>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid rgba(0,51,102,0.06)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--fb)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--dark)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--fb)',
          fontSize: 12,
          color: 'var(--mid)',
          backgroundColor: 'var(--light)',
          padding: '4px 12px',
          borderRadius: 5,
          border: '1px solid rgba(0,51,102,0.08)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Risk reference band ──────────────────────────────────────────────────────

const RISK_BANDS = [
  {
    label: 'Critical',
    range: '80 – 100',
    dot: 'var(--risk-crit-dot)',
    bg: 'var(--risk-crit-bg)',
    text: 'var(--risk-crit-text)',
  },
  {
    label: 'High',
    range: '60 – 79',
    dot: 'var(--risk-high-dot)',
    bg: 'var(--risk-high-bg)',
    text: 'var(--risk-high-text)',
  },
  {
    label: 'Medium',
    range: '35 – 59',
    dot: 'var(--risk-med-dot)',
    bg: 'var(--risk-med-bg)',
    text: 'var(--risk-med-text)',
  },
  {
    label: 'Low',
    range: '0 – 34',
    dot: 'var(--risk-low-dot)',
    bg: 'var(--risk-low-bg)',
    text: 'var(--risk-low-text)',
  },
] as const;

// ── Section components ───────────────────────────────────────────────────────

function ProfileSection() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const roleLabels: Record<string, string> = {
    supervisor: 'Supervisor',
    compliance: 'Compliance Officer',
    agent: 'Sales Agent',
  };

  return (
    <Card accent="var(--gold)">
      <SectionLabel>Account</SectionLabel>
      <SectionTitle>User profile</SectionTitle>
      <SectionDesc>
        Identity is managed by Auth0. These fields are read-only — contact your administrator to
        update your role or email address.
      </SectionDesc>

      <ReadonlyField label="Email" value={user.email} />
      <ReadonlyField label="Role" value={roleLabels[user.role] ?? user.role} />
      <ReadonlyField label="User ID" value={user.sub} />

      <div style={{ marginTop: 20 }}>
        <button
          onClick={logout}
          style={{
            fontFamily: 'var(--fb)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            padding: '9px 22px',
            borderRadius: 8,
            cursor: 'pointer',
            border: '1px solid rgba(0,51,102,0.25)',
            backgroundColor: 'transparent',
            color: 'var(--primary)',
            transition: 'all 0.15s',
          }}
        >
          Sign out
        </button>
      </div>
    </Card>
  );
}

function DisplaySection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
}) {
  return (
    <Card>
      <SectionLabel>Display</SectionLabel>
      <SectionTitle>Heatmap preferences</SectionTitle>
      <SectionDesc>
        Controls how active calls are sorted and filtered on the supervisor dashboard.
      </SectionDesc>

      <SettingRow
        label="Sort calls by"
        description="Determines the order in which calls appear in the risk heatmap."
        htmlFor="sort-by"
      >
        <RadioGroup<AppSettings['heatmapSortBy']>
          id="sort-by"
          value={settings.heatmapSortBy}
          onChange={(v) => update({ heatmapSortBy: v })}
          options={[
            { value: 'score', label: 'Score' },
            { value: 'time', label: 'Time' },
            { value: 'agent', label: 'Agent' },
          ]}
        />
      </SettingRow>

      <SettingRow
        label="Show low-risk calls"
        description="When off, calls scoring below 35 are hidden from the heatmap to reduce noise."
        htmlFor="show-low-risk"
      >
        <Toggle
          id="show-low-risk"
          checked={settings.showLowRisk}
          onChange={(v) => update({ showLowRisk: v })}
        />
      </SettingRow>
    </Card>
  );
}

function AlertSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
}) {
  return (
    <Card>
      <SectionLabel>Alerts</SectionLabel>
      <SectionTitle>Alert thresholds</SectionTitle>
      <SectionDesc>
        Filters applied client-side to the alert feed and heatmap highlights. The scoring pipeline
        always evaluates every call regardless of these settings.
      </SectionDesc>

      <SettingRow
        label="Minimum risk score to highlight"
        description="Calls scoring below this value will not be emphasised in the heatmap. Set to 0 to show all."
        htmlFor="alert-min-score"
      >
        <Slider
          id="alert-min-score"
          min={0}
          max={90}
          step={5}
          value={settings.alertMinScore}
          onChange={(v) => update({ alertMinScore: v })}
        />
      </SettingRow>

      <SettingRow
        label="Minimum rule confidence"
        description="Rule matches below this confidence threshold are hidden in the alert feed."
        htmlFor="rule-confidence"
      >
        <Slider
          id="rule-confidence"
          min={50}
          max={100}
          step={5}
          value={settings.ruleConfidenceMin}
          onChange={(v) => update({ ruleConfidenceMin: v })}
          format={(v) => `${v}%`}
        />
      </SettingRow>

      <SettingRow
        label="Sound alerts"
        description="Play a chime when a new CRITICAL or HIGH risk event arrives in the feed."
        htmlFor="sound-alerts"
      >
        <Toggle
          id="sound-alerts"
          checked={settings.soundAlerts}
          onChange={(v) => update({ soundAlerts: v })}
        />
      </SettingRow>
    </Card>
  );
}

function ConnectionSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
}) {
  return (
    <Card>
      <SectionLabel>Connection</SectionLabel>
      <SectionTitle>Fallback polling interval</SectionTitle>
      <SectionDesc>
        When the WebSocket connection is unavailable, the dashboard falls back to periodic REST
        polling. A shorter interval keeps data fresher at the cost of more requests.
      </SectionDesc>

      <SettingRow
        label="Polling interval"
        description="Applies only when the live WebSocket stream is disconnected."
        htmlFor="polling-interval"
      >
        <RadioGroup<30 | 60 | 120>
          id="polling-interval"
          value={settings.pollingIntervalSec}
          onChange={(v) => update({ pollingIntervalSec: v })}
          options={[
            { value: 30, label: '30 s' },
            { value: 60, label: '60 s' },
            { value: 120, label: '2 min' },
          ]}
        />
      </SettingRow>
    </Card>
  );
}

function RiskReferenceSection() {
  return (
    <Card>
      <SectionLabel>Reference</SectionLabel>
      <SectionTitle>Risk score bands</SectionTitle>
      <SectionDesc>
        Score boundaries used by the scoring pipeline to classify each call. These values are
        enforced server-side and cannot be changed from the dashboard.
      </SectionDesc>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginTop: 4,
        }}
      >
        {RISK_BANDS.map((band) => (
          <div
            key={band.label}
            style={{
              backgroundColor: band.bg,
              borderRadius: 8,
              padding: '16px 20px',
              border: `1px solid ${band.dot}33`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: band.dot,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--fb)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  color: band.text,
                }}
              >
                {band.label}
              </span>
            </div>
            <p
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: 22,
                fontWeight: 300,
                color: band.text,
                lineHeight: 1,
              }}
            >
              {band.range}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Saved confirmation toast ─────────────────────────────────────────────────

function SavedToast({ visible }: { visible: boolean }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 32,
        right: 40,
        backgroundColor: 'var(--dark)',
        color: 'var(--white)',
        fontFamily: 'var(--fb)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '2px',
        textTransform: 'uppercase',
        padding: '10px 20px',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.2s, transform 0.2s',
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: 'var(--risk-low-dot)',
          flexShrink: 0,
        }}
      />
      Settings saved
    </div>
  );
}

// ── Page shell ───────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleUpdate(patch: Partial<AppSettings>) {
    update(patch);
    if (toastTimer) clearTimeout(toastTimer);
    setToastVisible(true);
    const t = setTimeout(() => setToastVisible(false), 2000);
    setToastTimer(t);
  }

  useEffect(() => {
    return () => {
      if (toastTimer) clearTimeout(toastTimer);
    };
  }, [toastTimer]);

  return (
    <main id="main-content">
      {/* ── Hero — matches Dashboard/InfoPage pattern ─────────────────────── */}
      <header
        style={{
          backgroundColor: 'var(--primary)',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          padding: '40px 48px 36px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p
            aria-hidden="true"
            style={{
              fontFamily: 'var(--fb)',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: 10,
            }}
          >
            Ethical Sales Oracle
          </p>
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 30,
              fontWeight: 300,
              color: '#ffffff',
              lineHeight: 1.3,
              maxWidth: 680,
              marginBottom: 24,
            }}
          >
            Dashboard <em style={{ fontStyle: 'italic', color: 'var(--gold-light)' }}>settings</em>
          </h1>

          {/* Reset button sits in the KPI row position */}
          <button
            onClick={() => {
              reset();
              handleUpdate({});
            }}
            style={{
              fontFamily: 'var(--fb)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              padding: '7px 18px',
              borderRadius: 6,
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.2)',
              backgroundColor: 'transparent',
              color: 'rgba(255,255,255,0.45)',
              transition: 'all 0.15s',
            }}
          >
            Reset to defaults
          </button>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--light)',
          padding: '40px 48px 80px',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <ProfileSection />
          <DisplaySection settings={settings} update={handleUpdate} />
          <AlertSection settings={settings} update={handleUpdate} />
          <ConnectionSection settings={settings} update={handleUpdate} />
          <RiskReferenceSection />
        </div>
      </div>

      {/* ── Footer — matches Dashboard footer ────────────────────────────── */}
      <footer
        style={{
          backgroundColor: 'var(--primary)',
          padding: '20px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--fb)',
          fontSize: 9,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <span>OPB · Ethical Sales Oracle · Settings</span>
        <span>
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase()}
        </span>
      </footer>

      <SavedToast visible={toastVisible} />
    </main>
  );
}
