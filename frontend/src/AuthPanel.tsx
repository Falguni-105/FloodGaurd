import { useState } from 'react';
import type { User } from './types';
import { api } from './api';
import { playClick, playSuccess } from './sound';
import { UserIcon, LogOutIcon, ShieldAlert } from './icons';

export default function AuthPanel({
  user,
  onChange,
}: {
  user: User | null;
  onChange: (u: User | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ username: '', password: '', fullName: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    const initials = user.fullName
      ? user.fullName
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'U';

    return (
      <div className="who">
        <div className="user-pill">
          <div className="user-avatar">{initials}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{user.fullName}</span>
            <span className={`role-tag ${user.role}`}>{user.role}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            playClick();
            onChange(null);
          }}
          title="Sign out of command session"
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          <LogOutIcon size={14} />
          Sign out
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    playClick();
    try {
      const u = await api<User>(`/api/auth/${mode}`, {
        method: 'POST',
        body: mode === 'login' ? { username: f.username, password: f.password } : f,
      });
      playSuccess();
      onChange(u);
      setOpen(false);
      setF({ username: '', password: '', fullName: '' });
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fillQuickDemo = (role: 'authority' | 'citizen') => {
    playClick();
    if (role === 'authority') {
      setF({ username: 'admin', password: 'Admin@123', fullName: 'Duty Commander' });
    } else {
      setF({ username: 'citizen', password: 'Citizen@123', fullName: 'Local Resident' });
    }
  };

  return (
    <div className="who">
      <button
        className="primary"
        onClick={() => {
          playClick();
          setOpen(!open);
        }}
        style={{ padding: '6px 14px', fontSize: 13 }}
      >
        <UserIcon size={14} />
        Sign in / Access
      </button>

      {open && (
        <form className="popover" onSubmit={submit}>
          <div className="tabs" style={{ marginBottom: 4 }}>
            <button
              type="button"
              className={mode === 'login' ? 'on' : ''}
              onClick={() => {
                playClick();
                setMode('login');
              }}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'on' : ''}
              onClick={() => {
                playClick();
                setMode('register');
              }}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Citizen Register
            </button>
          </div>

          {/* Quick Demo Autofill Shortcuts */}
          <div className="demo-account-hint">
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--sky)' }}>Quick Test Accounts:</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                style={{ fontSize: 11, padding: '3px 8px', flex: 1 }}
                onClick={() => fillQuickDemo('authority')}
              >
                NDMA Authority
              </button>
              <button
                type="button"
                style={{ fontSize: 11, padding: '3px 8px', flex: 1 }}
                onClick={() => fillQuickDemo('citizen')}
              >
                Citizen
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <input
              placeholder="Full Name (e.g. Rahul Sharma)"
              value={f.fullName}
              onChange={(e) => setF({ ...f, fullName: e.target.value })}
              required
              maxLength={120}
            />
          )}

          <div>
            <input
              placeholder={mode === 'register' ? "Email address or username (e.g. user@gmail.com)" : "Email or Username"}
              value={f.username}
              onChange={(e) => setF({ ...f, username: e.target.value })}
              required
              minLength={3}
              maxLength={120}
            />
            {mode === 'register' && (
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: 2, marginBottom: 8, paddingLeft: 4 }}>
                Supports any personal email (e.g. <span style={{ color: 'var(--sky)' }}>user@gmail.com</span>) or custom username.
              </div>
            )}
          </div>

          <input
            type="password"
            placeholder={mode === 'register' ? "Password (min 6 characters)" : "Password"}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            required
            minLength={mode === 'register' ? 6 : 1}
          />

          {err && <div className="error" style={{ fontSize: 12, margin: 0 }}>{err}</div>}

          <button className="primary" disabled={busy} style={{ width: '100%', padding: '9px', marginTop: 4 }}>
            {busy ? 'Authenticating…' : mode === 'login' ? 'Sign In to Operations' : 'Create Citizen Account'}
          </button>
        </form>
      )}
    </div>
  );
}
