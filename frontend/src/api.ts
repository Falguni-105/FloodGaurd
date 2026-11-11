import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import type { User } from './types';

const KEY = 'floodguard.user';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/$/, '');

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export function loadUser(): User | null {
  try { const s = sessionStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function saveUser(u: User | null) {
  try { if (u) sessionStorage.setItem(KEY, JSON.stringify(u)); else sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function api<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
 const res = await fetch(`${API_BASE_URL}${path}`, {
  method: opts.method ?? 'GET',
  headers,
  body,
 });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (j.errors && Array.isArray(j.errors) && j.errors.length > 0) {
        msg = j.errors.map((e: { defaultMessage?: string; field?: string }) => e.defaultMessage || e.field).join('. ');
      } else if (j.message) {
        msg = j.message;
      } else if (j.error) {
        msg = j.error;
      }
    } catch { /* no json body */ }
    throw new ApiError(res.status, msg || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Calls `reload` immediately, on every server push (WebSocket), and once a minute as a safety net. */
export function useLive(reload: () => void) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const run = () => ref.current();
    run();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/risk', run);
        client.subscribe('/topic/incidents', run);
      },
    });
    client.activate();
    const timer = setInterval(run, 60000);
    return () => { clearInterval(timer); client.deactivate(); };
  }, []);
}
