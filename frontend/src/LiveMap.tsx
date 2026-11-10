import { useState, useCallback, useMemo } from 'react';
import MapView from './MapView';
import { api, useLive } from './api';
import type { Facility, NearbyFacility, PublicIncident, Risk, Road } from './types';
import { playClick, playSonar } from './sound';
import {
  LayersIcon, ShieldAlert, AlertTriangleIcon, NavigationIcon,
  SearchIcon, CrosshairIcon, LifeBuoyIcon, BuildingIcon
} from './icons';

export default function LiveMap({ externalFocus }: { externalFocus?: [number, number] | null }) {
  const [risk, setRisk] = useState<Risk[]>([]);
  const [incidents, setIncidents] = useState<PublicIncident[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [layers, setLayers] = useState({ roads: true, incidents: true, facilities: true });
  const [nearby, setNearby] = useState<{ h: NearbyFacility | null; s: NearbyFacility | null } | null>(null);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'HIGH' | 'MODERATE' | 'LOW'>('ALL');
  const [focusPoint, setFocusPoint] = useState<[number, number] | null>(null);

  const activeFocus = externalFocus || focusPoint;

  const load = useCallback(async () => {
    try {
      const [r, i, rd, f] = await Promise.all([
        api<Risk[]>('/api/risk/map'),
        api<PublicIncident[]>('/api/incidents/public'),
        api<Road[]>('/api/roads'),
        api<Facility[]>('/api/facilities'),
      ]);
      setRisk(r);
      setIncidents(i);
      setRoads(rd);
      setFacilities(f);
    } catch {
      setMsg('Could not reach the server.');
    }
  }, []);
  useLive(load);

  const findNearest = () => {
    playClick();
    if (!navigator.geolocation) {
      setMsg('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        playSonar();
        const { latitude: lat, longitude: lon } = pos.coords;
        setFocusPoint([lat, lon]);
        const [h, s] = await Promise.all([
          api<NearbyFacility[]>(`/api/facilities/nearest?lat=${lat}&lon=${lon}&type=HOSPITAL&limit=1`),
          api<NearbyFacility[]>(`/api/facilities/nearest?lat=${lat}&lon=${lon}&type=SHELTER&limit=1`),
        ]);
        setNearby({ h: h[0] ?? null, s: s[0] ?? null });
        setMsg('');
      },
      () => setMsg('Location permission denied.')
    );
  };

  const latest = risk.reduce<string>((m, r) => (r.updatedAt && r.updatedAt > m ? r.updatedAt : m), '');
  const blocked = roads.filter((r) => r.blocked);
  const highRiskCount = risk.filter((r) => r.riskLevel === 'HIGH').length;
  const modRiskCount = risk.filter((r) => r.riskLevel === 'MODERATE').length;

  const filteredRisk = useMemo(() => {
    return risk.filter((r) => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
      const matchesLevel = filterLevel === 'ALL' || r.riskLevel === filterLevel;
      return matchesSearch && matchesLevel;
    });
  }, [risk, search, filterLevel]);

  return (
    <div className="stack">
      {/* REAL-TIME OPERATIONS STATS STRIP */}
      <div className="kpis">
        <div className="kpi">
          <b>{risk.length || '—'}</b>
          <span>Monitored Hotspots</span>
        </div>
        <div className={`kpi ${highRiskCount > 0 ? 'hi' : 'safe'}`}>
          <b>{highRiskCount}</b>
          <span>Critical Risk Zones</span>
        </div>
        <div className={`kpi ${blocked.length > 0 ? 'crit' : 'safe'}`}>
          <b>{blocked.length}</b>
          <span>Blocked Arteries</span>
        </div>
        <div className="kpi warn">
          <b>{incidents.length}</b>
          <span>Live Public SOS</span>
        </div>
        <div className="kpi safe">
          <b>{facilities.filter((f) => f.open).length}</b>
          <span>Relief Shelters & Bases</span>
        </div>
      </div>

      <div className="grid2">
        {/* MAP CONTAINER CARD */}
        <section className="card" style={{ padding: 16 }}>
          <div className="map-hud-bar">
            {/* Layer Toggles */}
            <div className="map-layer-toggles">
              <span style={{ fontSize: 11, color: 'var(--sky)', display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
                <LayersIcon size={14} /> Layers:
              </span>
              {(['roads', 'incidents', 'facilities'] as const).map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={layers[k]}
                    onChange={(e) => {
                      playClick();
                      setLayers({ ...layers, [k]: e.target.checked });
                    }}
                  />
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </label>
              ))}
            </div>

            {/* Risk Legend */}
            <span className="legend">
              <i className="lo" /> Low
              <i className="mo" /> Moderate
              <i className="hi" /> High
            </span>
          </div>

          <MapView
            risk={risk}
            incidents={layers.incidents ? incidents : []}
            roads={layers.roads ? roads : []}
            facilities={layers.facilities ? facilities : []}
            focusPoint={activeFocus}
            height={560}
          />

          {msg && <div className="error">{msg}</div>}
        </section>

        {/* SIDE PANELS: HOTSPOT INTELLIGENCE & NEAREST HELP */}
        <aside className="stack">
          {/* HOTSPOT LIST WITH SEARCH & FOCUS */}
          <section className="card">
            <div className="card-header-bar">
              <h3>
                <ShieldAlert size={18} style={{ color: 'var(--sky)' }} />
                National & Basin Risk Hotspots
              </h3>
              <span className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                {filteredRisk.length} active
              </span>
            </div>

            {/* Filter & Search Bar */}
            <div className="row" style={{ margin: '0 0 12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Filter by basin or city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: 30, fontSize: 12 }}
                />
                <SearchIcon size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-secondary)' }} />
              </div>
              <select
                value={filterLevel}
                onChange={(e) => {
                  playClick();
                  setFilterLevel(e.target.value as typeof filterLevel);
                }}
                style={{ fontSize: 12, padding: '7px 10px' }}
              >
                <option value="ALL">All Levels</option>
                <option value="HIGH">High Risk ({highRiskCount})</option>
                <option value="MODERATE">Moderate ({modRiskCount})</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Hotspots Table */}
            <div className="scroll" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Region / Basin</th>
                    <th>Risk Level</th>
                    <th>Score</th>
                    <th style={{ textAlign: 'right' }}>Locate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisk.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.name}</td>
                      <td>
                        <span className={`pill ${l.riskLevel}`}>{l.riskLevel}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        <div className="score-meter">
                          <div className="score-bar-bg" style={{ width: 50 }}>
                            <div className={`score-bar-fill ${l.riskLevel}`} style={{ width: `${Math.min(100, l.riskScore)}%` }} />
                          </div>
                          <span>{l.riskScore.toFixed(0)}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => {
                            playSonar();
                            setFocusPoint([l.latitude, l.longitude]);
                          }}
                          title="Zoom to location on map"
                        >
                          <CrosshairIcon size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredRisk.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                        No hotspots matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="muted" style={{ marginTop: 10, fontSize: 11 }}>
              {latest ? `Live feed updated ${new Date(latest).toLocaleTimeString()}` : 'Awaiting satellite sync'} · Rainfall source: {risk[0]?.weatherSource ?? 'Open-Meteo'} · ML Model: {risk[0]?.riskSource ?? 'RandomForest'}
            </p>
          </section>

          {/* ROAD STATUS */}
          <section className="card">
            <div className="card-header-bar">
              <h3>
                <AlertTriangleIcon size={18} style={{ color: blocked.length ? 'var(--hi)' : 'var(--lo)' }} />
                Arterial Road Network
              </h3>
              <span className={`pill ${blocked.length ? 'HIGH' : 'LOW'}`}>
                {blocked.length ? `${blocked.length} Blocked` : 'All Clear'}
              </span>
            </div>

            {blocked.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--lo)', fontSize: 13, padding: '8px 0' }}>
                <span style={{ fontSize: 18 }}>✓</span> All monitored emergency transit corridors are open and navigable.
              </div>
            ) : (
              <div className="scroll" style={{ maxHeight: 130 }}>
                <table>
                  <tbody>
                    {blocked.map((r) => (
                      <tr key={r.id} className="inaccessible">
                        <td style={{ fontWeight: 600, color: '#fca5a5' }}>⛔ {r.name}</td>
                        <td style={{ fontSize: 11, color: 'var(--ink-secondary)', textAlign: 'right' }}>{r.lengthM}m inundated</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* NEAREST HELP / RESCUE LOCATOR */}
          <section className="card">
            <div className="card-header-bar">
              <h3>
                <LifeBuoyIcon size={18} style={{ color: 'var(--sky)' }} />
                Nearest Relief & Medical Hub
              </h3>
              <button
                type="button"
                className="primary"
                onClick={findNearest}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                <NavigationIcon size={13} />
                Locate Me
              </button>
            </div>

            {nearby ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nearby.h && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fca5a5' }}>🏥 {nearby.h.facility.name}</div>
                      <div className="muted">{nearby.h.distanceKm.toFixed(2)} km away · Emergency Trauma Center</div>
                    </div>
                    <button
                      type="button"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={() => setFocusPoint([nearby.h!.facility.latitude, nearby.h!.facility.longitude])}
                    >
                      Show
                    </button>
                  </div>
                )}
                {nearby.s && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#86efac' }}>⛺ {nearby.s.facility.name}</div>
                      <div className="muted">{nearby.s.distanceKm.toFixed(2)} km away · Shelter Capacity: {nearby.s.facility.capacity || 200}</div>
                    </div>
                    <button
                      type="button"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={() => setFocusPoint([nearby.s!.facility.latitude, nearby.s!.facility.longitude])}
                    >
                      Show
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="muted">Click "Locate Me" to compute your shortest route to the closest shelter and trauma center.</p>
            )}

            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ color: '#fca5a5' }}>National Disaster Helpline:</span>
              <a href="tel:112" style={{ fontWeight: 800, color: '#fff', textDecoration: 'none', background: '#ef4444', padding: '2px 8px', borderRadius: 4 }}>
                📞 112
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
