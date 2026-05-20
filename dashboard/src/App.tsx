/**
 * App root — React state-based routing (no router library) per BRAND.md.
 * All pages share this component; a `page` state variable controls which renders.
 * Auth gate: only supervisor and compliance roles may access the dashboard.
 *
 * useRiskStream is hoisted here so both Nav (isConnected/isPolling) and
 * Dashboard (calls/alerts) share a single WebSocket connection.
 */

import React, { useState, useEffect } from 'react';

import { AuthProvider, useAuth, extractRole } from '@/auth/AuthContext';
import { Nav } from '@/components/Nav';
import { useRiskStream } from '@/hooks/useRiskStream';
import { CallDetailPage } from '@/pages/CallDetail';
import { Dashboard } from '@/pages/Dashboard';
import type { AuthUser, Page } from '@/types';
import '@/styles/tokens.css';

// ── Auth callback handler ───────────────────────────────────────────────────

function parseHashToken(): { token: string; payload: Record<string, unknown> } | null {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = hash.get('access_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as Record<string, unknown>;
    return { token, payload };
  } catch {
    return null;
  }
}

// ── Unauthenticated landing ─────────────────────────────────────────────────

function LoginScreen() {
  const { login, loginAsDemo } = useAuth();
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--primary)',
        backgroundImage: `
          linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--white)',
          borderRadius: 12,
          padding: '48px 56px',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        {/* Top accent */}
        <div
          style={{
            height: 3,
            backgroundColor: 'var(--gold)',
            borderRadius: '2px 2px 0 0',
            margin: '-48px -56px 36px',
          }}
        />

        <h1
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 28,
            fontWeight: 300,
            color: 'var(--primary)',
            marginBottom: 8,
          }}
        >
          Ethical Sales <em style={{ fontStyle: 'italic' }}>Oracle</em>
        </h1>
        <p
          style={{
            fontFamily: 'var(--fb)',
            fontSize: 13,
            color: 'var(--mid)',
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          Real-time compliance monitoring for sales teams.
          <br />
          Sign in with your corporate account to continue.
        </p>
        <button
          onClick={login}
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--white)',
            border: 'none',
            borderRadius: 8,
            padding: '12px 32px',
            fontFamily: 'var(--fb)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Sign in with Auth0
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 4px' }}>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--primary-10)' }} />
          <span
            style={{
              fontFamily: 'var(--fb)',
              fontSize: 10,
              color: 'var(--mid)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--primary-10)' }} />
        </div>

        <button
          onClick={loginAsDemo}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--primary)',
            border: '1.5px solid var(--primary-30)',
            borderRadius: 8,
            padding: '11px 32px',
            fontFamily: 'var(--fb)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Try demo
        </button>
        <p
          style={{
            fontFamily: 'var(--fb)',
            fontSize: 11,
            color: 'var(--mid)',
            marginTop: 10,
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          Pre-seeded calls · supervisor access · no Auth0 required
        </p>
      </div>
    </div>
  );
}

// ── Insufficient role screen ────────────────────────────────────────────────

function AccessDenied() {
  const { logout } = useAuth();
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--light)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--white)',
          borderRadius: 12,
          padding: '40px 48px',
          maxWidth: 440,
          textAlign: 'center',
          boxShadow: '0 1px 4px rgba(0,51,102,0.08)',
          borderTop: '3px solid var(--risk-high-dot)',
        }}
      >
        <h2
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 22,
            fontWeight: 300,
            color: 'var(--dark)',
            marginBottom: 12,
          }}
        >
          Access restricted
        </h2>
        <p
          style={{
            fontFamily: 'var(--fb)',
            fontSize: 13,
            color: 'var(--mid)',
            lineHeight: 1.7,
            marginBottom: 24,
          }}
        >
          The supervisor dashboard requires a <strong>supervisor</strong> or{' '}
          <strong>compliance</strong> role. Contact your administrator to request access.
        </p>
        <button
          onClick={logout}
          style={{
            background: 'none',
            border: '1px solid var(--primary-30)',
            borderRadius: 8,
            padding: '8px 24px',
            fontFamily: 'var(--fb)',
            fontSize: 11,
            cursor: 'pointer',
            color: 'var(--primary)',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Inner app (authenticated) ───────────────────────────────────────────────

function AuthenticatedApp() {
  const { isAuthenticated, hasRole, token } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  // Single shared WebSocket connection; results flow to both Nav and Dashboard
  const { calls, latestAlert, isConnected, isPolling, lastUpdated } = useRiskStream(token);

  if (!isAuthenticated) return <LoginScreen />;
  if (!hasRole('supervisor') && !hasRole('compliance')) return <AccessDenied />;

  function handleCallSelect(callId: string) {
    setSelectedCallId(callId);
    setPage('call');
  }

  function handleBackToDashboard() {
    setPage('dashboard');
    setSelectedCallId(null);
  }

  return (
    <>
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: 9999,
          padding: '8px 16px',
          backgroundColor: 'var(--gold)',
          color: 'var(--dark)',
          fontFamily: 'var(--fb)',
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 6,
          textDecoration: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.left = '8px')}
        onBlur={(e) => (e.currentTarget.style.left = '-9999px')}
      >
        Skip to main content
      </a>

      <Nav
        currentPage={page}
        onNavigate={(p) => {
          setPage(p);
          setSelectedCallId(null);
        }}
        isConnected={isConnected}
        isPolling={isPolling}
      />

      {page === 'dashboard' && (
        <Dashboard
          calls={calls}
          latestAlert={latestAlert}
          isConnected={isConnected}
          isPolling={isPolling}
          lastUpdated={lastUpdated}
          onCallSelect={handleCallSelect}
        />
      )}

      {page === 'call' && selectedCallId && (
        <CallDetailPage callId={selectedCallId} onBack={handleBackToDashboard} />
      )}

      {page === 'reports' && (
        <main id="main-content" style={{ padding: '64px 48px', maxWidth: 1300, margin: '0 auto' }}>
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 32,
              fontWeight: 300,
              color: 'var(--dark)',
            }}
          >
            Compliance <em style={{ fontStyle: 'italic' }}>reports</em>
          </h1>
          <p style={{ fontFamily: 'var(--fb)', color: 'var(--mid)', marginTop: 12 }}>
            Reports module — Sprint 7.
          </p>
        </main>
      )}

      {page === 'settings' && (
        <main id="main-content" style={{ padding: '64px 48px', maxWidth: 1300, margin: '0 auto' }}>
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 32,
              fontWeight: 300,
              color: 'var(--dark)',
            }}
          >
            Dashboard <em style={{ fontStyle: 'italic' }}>settings</em>
          </h1>
          <p style={{ fontFamily: 'var(--fb)', color: 'var(--mid)', marginTop: 12 }}>
            Settings module — Sprint 7.
          </p>
        </main>
      )}
    </>
  );
}

// ── Root ────────────────────────────────────────────────────────────────────

function AppInner() {
  const { _setSession } = useAuth();

  // Handle Auth0 implicit flow callback (hash fragment)
  useEffect(() => {
    const parsed = parseHashToken();
    if (parsed) {
      const { token, payload } = parsed;
      const user: AuthUser = {
        sub: String(payload.sub ?? ''),
        email: String(payload.email ?? ''),
        role: extractRole(payload),
        name: payload.name ? String(payload.name) : undefined,
      };
      _setSession(user, token);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [_setSession]);

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
