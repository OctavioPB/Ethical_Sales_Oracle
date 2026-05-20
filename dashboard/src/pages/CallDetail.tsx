import React, { useState } from 'react';

import { useAuth } from '@/auth/AuthContext';
import { CallTranscript } from '@/components/CallTranscript';
import { InterventionPanel } from '@/components/InterventionPanel';
import { RationalePanel } from '@/components/RationalePanel';
import { RiskBadge } from '@/components/RiskBadge';
import { useCallDetail } from '@/hooks/useCallDetail';
import type { InterventionEvent } from '@/types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface CallDetailPageProps {
  callId: string;
  onBack: () => void;
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '64px 48px', maxWidth: 1300, margin: '0 auto' }}>
      {[180, 120, 80, 80, 80].map((w, i) => (
        <div
          key={i}
          style={{
            height: 16,
            width: `${w}px`,
            backgroundColor: 'var(--primary-10)',
            borderRadius: 4,
            marginBottom: 16,
            animation: 'pulse 1.4s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

export function CallDetailPage({ callId, onBack }: CallDetailPageProps) {
  const { token, hasRole } = useAuth();
  const { detail, isLoading, error, refetch } = useCallDetail(callId, token);
  const [localInterventions, setLocalInterventions] = useState<InterventionEvent[]>([]);
  const isSupervisor = hasRole('supervisor');
  const isCompliance = hasRole('compliance');

  const shortId = callId.slice(-8).toUpperCase();

  // Append intervention optimistically once the API confirms it
  function handleNewIntervention(evt: InterventionEvent) {
    setLocalInterventions((prev) => [...prev, evt]);
  }

  // Merge DB-persisted interventions (from detail) with optimistically added ones
  const allInterventions = [
    ...(detail?.interventions ?? []),
    ...localInterventions.filter((li) => !detail?.interventions.some((di) => di.id === li.id)),
  ];

  function handleExportReport() {
    // Opens the report JSON in a new tab; browser can save/print
    window.open(
      `${API_URL}/api/calls/${encodeURIComponent(callId)}/report`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  const flaggedCount = detail?.utterances.filter((u) => u.riskEvents.length > 0).length ?? 0;

  return (
    <main id="main-content">
      {/* ── Hero header ────────────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: 'var(--primary)',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          padding: '32px 48px',
        }}
      >
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          {/* Back navigation */}
          <button
            onClick={onBack}
            aria-label="Back to dashboard"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'var(--fb)',
              fontSize: 9,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              padding: '0 0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span aria-hidden="true">←</span> Dashboard
          </button>

          <p
            aria-hidden="true"
            style={{
              fontFamily: 'var(--fb)',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: 8,
            }}
          >
            Call detail
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: 28,
                  fontWeight: 300,
                  color: '#ffffff',
                  lineHeight: 1.3,
                  marginBottom: 8,
                }}
              >
                Call{' '}
                <em
                  style={{
                    fontStyle: 'italic',
                    color: 'var(--gold-light)',
                    fontFamily: 'Courier New, monospace',
                    fontSize: 22,
                  }}
                >
                  …{shortId}
                </em>
              </h1>

              {detail && (
                <div
                  style={{
                    display: 'flex',
                    gap: 20,
                    fontFamily: 'var(--fb)',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.55)',
                    flexWrap: 'wrap',
                  }}
                >
                  {detail.call.agentId && <span>Agent: {detail.call.agentId}</span>}
                  {detail.call.deskId && <span>Desk: {detail.call.deskId.toUpperCase()}</span>}
                  {detail.call.region && <span>Region: {detail.call.region}</span>}
                </div>
              )}
            </div>

            {detail && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: "'Fraunces', Georgia, serif",
                      fontSize: 44,
                      fontWeight: 300,
                      color: 'var(--gold-light)',
                      lineHeight: 1,
                    }}
                  >
                    {detail.call.score}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <RiskBadge level={detail.call.riskLevel} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export button — compliance only */}
          {isCompliance && detail && (
            <button
              onClick={handleExportReport}
              data-testid="export-report-btn"
              style={{
                marginTop: 20,
                backgroundColor: 'var(--gold)',
                color: 'var(--dark)',
                border: 'none',
                borderRadius: 8,
                padding: '9px 20px',
                fontFamily: 'var(--fb)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Export report →
            </button>
          )}
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {isLoading && <LoadingSkeleton />}

      {error && (
        <div role="alert" style={{ padding: '48px', maxWidth: 1300, margin: '0 auto' }}>
          <p
            style={{
              fontFamily: 'var(--fb)',
              fontSize: 14,
              color: 'var(--risk-high-dot)',
            }}
          >
            Failed to load call detail: {error}
          </p>
          <button
            onClick={refetch}
            style={{
              marginTop: 12,
              background: 'none',
              border: '1px solid var(--primary-30)',
              borderRadius: 6,
              padding: '7px 16px',
              fontFamily: 'var(--fb)',
              fontSize: 11,
              cursor: 'pointer',
              color: 'var(--primary)',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {detail && (
        <div
          style={{
            maxWidth: 1300,
            margin: '0 auto',
            padding: '40px 48px',
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {/* Left: transcript */}
          <CallTranscript utterances={detail.utterances} flaggedCount={flaggedCount} />

          {/* Right: rationale + intervention */}
          <div>
            <RationalePanel detail={detail} />
            <InterventionPanel
              callId={callId}
              interventions={allInterventions}
              isSupervisor={isSupervisor}
              token={token}
              onIntervention={handleNewIntervention}
            />
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
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
        <span>OPB · Ethical Sales Oracle · Call Detail</span>
        <span>
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase()}
        </span>
      </footer>
    </main>
  );
}
