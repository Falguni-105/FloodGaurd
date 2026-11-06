import { useState, useCallback } from 'react';
import MapView from './MapView';
import { api, useLive } from './api';
import type { Facility, NearbyFacility, PublicIncident, Risk, Road } from './types';

export default function LiveMap() {
  const [risk, setRisk] = useState<Risk[]>([]);
  const [incidents, setIncidents] = useState<PublicIncident[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [layers, setLayers] = useState({ roads: true, incidents: true, facilities: true });
  const [nearby, setNearby] = useState<{ h: NearbyFacility | null; s: NearbyFacility | null } | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, i, rd, f] = await Promise.all([
        api<Risk[]>('/api/risk/map'), api<PublicIncident[]>('/api/incidents/public'),
        api<Road[]>('/api/roads'), api<Facility[]>('/api/facilities'),
      ]);
      setRisk(r); setIncidents(i); setRoads(rd); setFacilities(f);
    } catch { setMsg('Could not reach the server.'); }
  }, []);
  useLive(load);

  const findNearest = () => {
    if (!navigator.geolocation) { setMsg('Geolocation is not supported by this browser.'); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const [h, s] = await Promise.all([
        api<NearbyFacility[]>(`/api/facilities/nearest?lat=${lat}&lon=${lon}&type=HOSPITAL&limit=1`),
        api<NearbyFacility[]>(`/api/facilities/nearest?lat=${lat}&lon=${lon}&type=SHELTER&limit=1`),
      ]);
      setNearby({ h: h[0] ?? null, s: s[0] ?? null }); setMsg('');
    }, () => setMsg('Location permission denied.'));
  };

  const latest = risk.reduce<string>((m, r) => (r.updatedAt && r.updatedAt > m ? r.updatedAt : m), '');
  const blocked = roads.filter((r) => r.blocked);

  return (
    <div className="grid2">
      <section className="card">
        <div className="layers">
          {(['roads', 'incidents', 'facilities'] as const).map((k) => (
            <label key={k}><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {k}</label>
          ))}
          <span className="legend"><i className="lo" />Low <i className="mo" />Moderate <i className="hi" />High</span>
        </div>
        <MapView risk={risk} incidents={layers.incidents ? incidents : []} roads={layers.roads ? roads : []}
          facilities={layers.facilities ? facilities : []} />
        {msg && <div className="error">{msg}</div>}
      </section>

      <aside className="stack">
        <section className="card">
          <h3>National Flood Risk Hotspots (2004–2024)</h3>
          <div className="scroll" style={{ maxHeight: 440, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Region / Basin</th><th>Risk</th><th>Score</th></tr></thead>
              <tbody>{risk.map((l) => (
                <tr key={l.id}><td>{l.name}</td><td><span className={`pill ${l.riskLevel}`}>{l.riskLevel}</span></td><td>{l.riskScore.toFixed(0)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="muted">{latest ? `Updated ${new Date(latest).toLocaleTimeString()}` : 'Awaiting first update'} · rainfall source: {risk[0]?.weatherSource ?? '—'} · model: {risk[0]?.riskSource ?? '—'}</p>
        </section>

        <section className="card">
          <h3>Road status</h3>
          {blocked.length === 0 ? <p className="muted">No roads currently reported blocked.</p>
            : <ul>{blocked.map((r) => <li key={r.id}>⛔ {r.name}</li>)}</ul>}
        </section>

        <section className="card">
          <h3>Nearest help</h3>
          <button onClick={findNearest}>Use my location</button>
          {nearby && (
            <ul>
              {nearby.h && <li>🏥 {nearby.h.facility.name} — {nearby.h.distanceKm} km</li>}
              {nearby.s && <li>🏠 {nearby.s.facility.name} — {nearby.s.distanceKm} km</li>}
            </ul>
          )}
          <p className="muted">In immediate danger, call your local emergency number (112 in India).</p>
        </section>
      </aside>
    </div>
  );
}
