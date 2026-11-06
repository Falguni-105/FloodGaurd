import { useState, useCallback, useEffect } from 'react';
import MapView from './MapView';
import { api, useLive } from './api';
import type { Facility, Incident, IncidentStatus, PlanItem, Resource, Risk, Road, Summary, User } from './types';

const STATUSES: IncidentStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

/** Photos are authority-only, so they are fetched with the bearer token and shown from a blob URL. */
function Photo({ file, token }: { file: string; token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false; let made: string | null = null;
    fetch(`/api/files/${file}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => { if (!revoked) { made = URL.createObjectURL(b); setUrl(made); } })
      .catch(() => setUrl(null));
    return () => { revoked = true; if (made) URL.revokeObjectURL(made); };
  }, [file, token]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img className="thumb" src={url} alt="incident" /></a> : <span className="muted">photo…</span>;
}

export default function ControlRoom({ user }: { user: User }) {
  const t = user.token;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [risk, setRisk] = useState<Risk[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [sim, setSim] = useState({ rain: 120 });
  const [simResult, setSimResult] = useState<Risk[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, i, p, r, rd, f] = await Promise.all([
        api<Summary>('/api/dashboard/summary', { token: t }),
        api<Incident[]>('/api/incidents?activeOnly=false', { token: t }),
        api<PlanItem[]>('/api/rescue/plan', { token: t }),
        api<Risk[]>('/api/risk/map'), api<Road[]>('/api/roads'), api<Facility[]>('/api/facilities'),
      ]);
      setSummary(s); setIncidents(i); setPlan(p); setRisk(r); setRoads(rd); setFacilities(f); setErr('');
    } catch (ex) { setErr((ex as Error).message); }
  }, [t]);
  useLive(load);

  const patchIncident = async (id: number, body: { status?: IncidentStatus; assignedTo?: string }) => {
    try { await api(`/api/incidents/${id}`, { method: 'PATCH', body, token: t }); load(); }
    catch (ex) { setErr((ex as Error).message); }
  };
  const patchResource = async (r: Resource, delta: number) => {
    const available = Math.max(0, Math.min(r.total, r.available + delta));
    try { await api(`/api/resources/${r.id}`, { method: 'PATCH', body: { available }, token: t }); load(); }
    catch (ex) { setErr((ex as Error).message); }
  };
  const runSim = async (persist: boolean) => {
    setBusy(true);
    try {
      const res = await api<Risk[]>('/api/risk/simulate', { method: 'POST', token: t, body: { rainfall24hMm: sim.rain, persist } });
      setSimResult(persist ? null : res); if (persist) load();
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };
  const refreshWeather = async () => {
    setBusy(true);
    try { await api('/api/risk/refresh', { method: 'POST', token: t }); setSimResult(null); load(); }
    catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };

  const publicIncidents = incidents.filter((i) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(i.status));

  return (
    <div className="stack">
      {err && <div className="error">{err}</div>}

      <div className="kpis">
        <div className="kpi"><b>{summary?.activeIncidents ?? '–'}</b><span>Active incidents</span></div>
        <div className="kpi crit"><b>{summary?.activeBySeverity?.CRITICAL ?? '–'}</b><span>Critical</span></div>
        <div className="kpi"><b>{summary?.blockedRoads ?? '–'}</b><span>Blocked roads</span></div>
        <div className="kpi hi"><b>{summary?.localitiesByRisk?.HIGH ?? '–'}</b><span>High-risk localities</span></div>
        <div className="kpi"><b>{summary?.localitiesByRisk?.MODERATE ?? '–'}</b><span>Moderate-risk</span></div>
      </div>

      <div className="grid2">
        <section className="card">
          <MapView risk={risk} incidents={publicIncidents} roads={roads} facilities={facilities} route={route} height={460} />
          <p className="muted">Click “Show route” on a dispatch row to draw the rescue route from the nearest reachable base.</p>
        </section>

        <aside className="stack">
          <section className="card">
            <h3>Rainfall scenario / refresh</h3>
            <label>24 h rainfall: <b>{sim.rain} mm</b>
              <input type="range" min={0} max={400} step={5} value={sim.rain} onChange={(e) => setSim({ rain: Number(e.target.value) })} />
            </label>
            <div className="row">
              <button disabled={busy} onClick={() => runSim(false)}>Preview</button>
              <button disabled={busy} onClick={() => runSim(true)}>Apply to map</button>
              <button disabled={busy} onClick={refreshWeather}>Reload live weather</button>
            </div>
            {simResult && (
              <table><thead><tr><th>Locality</th><th>Predicted</th><th>Score</th></tr></thead>
                <tbody>{simResult.map((l) => <tr key={l.id}><td>{l.name}</td><td><span className={`pill ${l.riskLevel}`}>{l.riskLevel}</span></td><td>{l.riskScore.toFixed(0)}</td></tr>)}</tbody></table>
            )}
            <p className="muted">Preview does not change the public map. Model source: {risk[0]?.riskSource ?? '—'}.</p>
          </section>

          <section className="card">
            <h3>Rescue resources</h3>
            <table><thead><tr><th>Resource</th><th>Available</th><th /></tr></thead>
              <tbody>{summary?.resources.map((r) => (
                <tr key={r.id}><td>{r.name}<br /><span className="muted">{r.base}</span></td><td>{r.available} / {r.total}</td>
                  <td><button onClick={() => patchResource(r, -1)}>−</button><button onClick={() => patchResource(r, +1)}>+</button></td></tr>
              ))}</tbody></table>
          </section>
        </aside>
      </div>

      <section className="card">
        <h3>Dispatch plan <span className="muted">(active incidents, highest priority first)</span></h3>
        <div className="scroll"><table>
          <thead><tr><th>#</th><th>Incident</th><th>Priority</th><th>Rescue base · route</th><th>Nearest hospital</th><th>Nearest shelter</th><th /></tr></thead>
          <tbody>{plan.map((p) => (
            <tr key={p.incident.id} className={p.accessible ? '' : 'inaccessible'}>
              <td>{p.rank}</td>
              <td><b>{p.incident.type.replace(/_/g, ' ')}</b> · {p.incident.severity}<br /><span className="muted">{p.incident.locality}</span></td>
              <td>{p.incident.priority}</td>
              <td>{p.accessible
                ? <>{p.rescueBase}<br /><span className="muted">{p.routeFromBase.distanceKm} km · ~{p.routeFromBase.etaMinutes} min{p.routeFromBase.detoured ? ` · detour +${p.routeFromBase.extraKmVsNormal} km` : ''}</span></>
                : <span className="error">⚠ Not reachable by road — consider boat/air rescue</span>}</td>
              <td>{p.nearestHospital ?? '—'}{p.hospitalKm != null && <><br /><span className="muted">{p.hospitalKm} km</span></>}</td>
              <td>{p.nearestShelter ?? '—'}{p.shelterKm != null && <><br /><span className="muted">{p.shelterKm} km</span></>}</td>
              <td>{p.accessible && <button onClick={() => setRoute(p.routeFromBase.path)}>Show route</button>}</td>
            </tr>
          ))}</tbody></table></div>
      </section>

      <section className="card">
        <h3>All incidents</h3>
        <div className="scroll"><table>
          <thead><tr><th>ID</th><th>Reported</th><th>Type / severity</th><th>Description</th><th>Photo</th><th>Status</th><th>Assigned to</th></tr></thead>
          <tbody>{incidents.map((i) => (
            <tr key={i.id}>
              <td>{i.id}</td><td>{new Date(i.createdAt).toLocaleString()}<br /><span className="muted">{i.reporter}</span></td>
              <td>{i.type.replace(/_/g, ' ')}<br /><span className={`pill sev-${i.severity}`}>{i.severity}</span></td>
              <td className="desc">{i.description}</td>
              <td>{i.imageFile ? <Photo file={i.imageFile} token={t} /> : '—'}</td>
              <td><select value={i.status} onChange={(e) => patchIncident(i.id, { status: e.target.value as IncidentStatus })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
              <td><input defaultValue={i.assignedTo ?? ''} placeholder="team…" maxLength={80}
                onBlur={(e) => { if (e.target.value !== (i.assignedTo ?? '')) patchIncident(i.id, { assignedTo: e.target.value }); }} /></td>
            </tr>
          ))}</tbody></table></div>
      </section>
    </div>
  );
}
