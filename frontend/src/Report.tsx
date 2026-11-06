import { useState, useEffect, useCallback } from 'react';
import MapView from './MapView';
import { api, useLive } from './api';
import type { Incident, IncidentType, Risk, Severity, User } from './types';

const TYPES: IncidentType[] = ['WATERLOGGING', 'BLOCKED_ROAD', 'DRAINAGE_OVERFLOW', 'PEOPLE_TRAPPED', 'MEDICAL_EMERGENCY', 'OTHER'];
const SEVS: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function Report({ user }: { user: User }) {
  const [type, setType] = useState<IncidentType>('WATERLOGGING');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Incident[]>([]);
  const [risk, setRisk] = useState<Risk[]>([]);

  const load = useCallback(async () => {
    setMine(await api<Incident[]>('/api/incidents/mine', { token: user.token }));
    setRisk(await api<Risk[]>('/api/risk/map'));
  }, [user.token]);
  useLive(load);
  useEffect(() => { /* initial point: try device GPS once */ locate(false); }, []); // eslint-disable-line

  function locate(report = true) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPoint([p.coords.latitude, p.coords.longitude]),
      () => report && setStatus({ ok: false, text: 'Could not get your location — click the map to place the pin.' }),
      { enableHighAccuracy: true, timeout: 8000 });
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!point) { setStatus({ ok: false, text: 'Please set the location (use GPS or click on the map).' }); return; }
    if (image && image.size > 5 * 1024 * 1024) { setStatus({ ok: false, text: 'Image must be under 5 MB.' }); return; }
    setBusy(true); setStatus(null);
    const form = new FormData();
    form.append('type', type); form.append('severity', severity); form.append('description', description);
    form.append('latitude', String(point[0])); form.append('longitude', String(point[1]));
    if (image) form.append('image', image);
    try {
      await api<Incident>('/api/incidents', { method: 'POST', form, token: user.token });
      setStatus({ ok: true, text: 'Report submitted. The control room has been notified.' });
      setDescription(''); setImage(null); load();
    } catch (ex) { setStatus({ ok: false, text: (ex as Error).message }); } finally { setBusy(false); }
  };

  return (
    <div className="grid2">
      <form className="card" onSubmit={submit}>
        <h3>Report an emergency</h3>
        <p className="muted">If life is in danger, call 112 first. This form alerts the control room but is not a substitute for emergency calls.</p>
        <label>Type<select value={type} onChange={(e) => setType(e.target.value as IncidentType)}>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></label>
        <label>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>{SEVS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={1000} rows={4} placeholder="What is happening? How many people are affected?" /></label>
        <label>Photo (optional, JPEG/PNG/WebP, max 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} /></label>
        <div className="row"><button type="button" onClick={() => locate()}>📍 Use my GPS location</button>
          <span className="muted">{point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : 'or click the map'}</span></div>
        {status && <div className={status.ok ? 'ok' : 'error'}>{status.text}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button>

        <h4>My reports</h4>
        {mine.length === 0 ? <p className="muted">Nothing reported yet.</p> : (
          <ul>{mine.map((i) => <li key={i.id}>{i.type.replace(/_/g, ' ')} · {i.severity} · <b>{i.status}</b> · {new Date(i.createdAt).toLocaleString()}</li>)}</ul>
        )}
      </form>
      <section className="card"><MapView risk={risk} picked={point} onPick={setPoint} /></section>
    </div>
  );
}
