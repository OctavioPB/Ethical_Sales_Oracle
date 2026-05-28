import React from 'react';

import { useAuth } from '@/auth/AuthContext';
import type { Page } from '@/types';

const NAV_PAGES: { id: Page; label: string; roles: string[] }[] = [
  { id: 'dashboard', label: 'Dashboard', roles: ['supervisor', 'compliance'] },
  { id: 'reports', label: 'Reports', roles: ['compliance'] },
  { id: 'settings', label: 'Settings', roles: ['supervisor', 'compliance'] },
  { id: 'info', label: 'Info', roles: ['supervisor', 'compliance'] },
];

interface NavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isConnected: boolean;
  isPolling: boolean;
}

/** Sticky top nav following the BRAND.md navigation bar specification. */
export function Nav({ currentPage, onNavigate, isConnected, isPolling }: NavProps) {
  const { user, logout, hasRole } = useAuth();

  const navLink: React.CSSProperties = {
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'rgba(255,255,255,0.45)',
    cursor: 'pointer',
    fontFamily: 'var(--fb)',
    fontSize: 9,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    padding: '5px 8px',
    borderRadius: 6,
    transition: 'color 0.15s',
  };

  const navLinkActive: React.CSSProperties = {
    color: 'var(--gold-light)',
  };

  const logoutBtn: React.CSSProperties = {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontFamily: 'var(--fb)',
    fontSize: 9,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    padding: '5px 10px',
  };

  // Connection status indicator
  const statusColor = isConnected ? '#27B97C' : isPolling ? '#F07020' : '#E03448';
  const statusLabel = isConnected ? 'Live' : isPolling ? 'Polling' : 'Offline';

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        backgroundColor: 'rgba(0,51,102,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* OPB Monogram */}
      <a href="/" aria-label="OPB home" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <span>
          <span
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 20,
              fontWeight: 300,
              color: '#ffffff',
            }}
          >
            O
          </span>
          <em
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 20,
              fontWeight: 300,
              fontStyle: 'italic',
              color: 'var(--gold-light)',
            }}
          >
            PB
          </em>
        </span>
      </a>

      {/* App title (center) */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--fb)',
          fontSize: 9,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
          whiteSpace: 'nowrap',
        }}
      >
        Ethical Sales Oracle
      </span>

      {/* Right cluster */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Connection status */}
        <span
          role="status"
          aria-label={`Connection status: ${statusLabel}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: 'var(--fb)',
            fontSize: 9,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: statusColor,
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }}
          />
          {statusLabel}
        </span>

        {/* Page links — only for accessible roles */}
        {NAV_PAGES.filter((p) =>
          p.roles.some((r) => hasRole(r as 'supervisor' | 'compliance')),
        ).map((p) => (
          <button
            key={p.id}
            onClick={() => onNavigate(p.id)}
            aria-current={currentPage === p.id ? 'page' : undefined}
            style={currentPage === p.id ? { ...navLink, ...navLinkActive } : navLink}
          >
            {p.label}
          </button>
        ))}

        {user && (
          <button onClick={logout} style={logoutBtn}>
            {user.email.split('@')[0]} · Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
