import { useState } from 'react';
import type { User } from './types';
import { api } from './api';

export default function AuthPanel({ user, onChange }: { user: User | null; onChange: (u: User | null) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ username: '', password: '', fullName: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return <div className="who">{user.fullName} <em>({user.role.toLowerCase()})</em><button onClick={() => onChange(null)}>Sign out</button></div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const u = await api<User>(`/api/auth/${mode}`, { method: 'POST', body: mode === 'login' ? { username: f.username, password: f.password } : f });
      onChange(u); setOpen(false); setF({ username: '', password: '', fullName: '' });
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="who">
      <button className="primary" onClick={() => setOpen(!open)}>Sign in</button>
      {open && (
        <form className="popover" onSubmit={submit}>
          <div className="tabs">
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Sign in</button>
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Register</button>
          </div>
          {mode === 'register' && <input placeholder="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required maxLength={80} />}
          <input placeholder="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required minLength={3} maxLength={30} />
          <input type="password" placeholder="Password (min 8 chars)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={mode === 'register' ? 8 : 1} />
          {err && <div className="error">{err}</div>}
          <button className="primary" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create citizen account'}</button>
        </form>
      )}
    </div>
  );
}
