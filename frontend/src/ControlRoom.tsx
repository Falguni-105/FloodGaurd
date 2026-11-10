import { useState, useCallback, useEffect, useMemo } from 'react';
import MapView from './MapView';
import { api, useLive } from './api';
import type { Facility, Incident, IncidentStatus, PlanItem, Resource, Risk, Road, Summary, User } from './types';
import { playClick, playSonar, playSuccess, playSiren } from './sound';
import {
  ShieldAlert, RadioIcon, TruckIcon, BuildingIcon, ActivityIcon,
  NavigationIcon, AlertTriangleIcon, RefreshCwIcon, CheckCircleIcon,
  SearchIcon, EyeIcon, FileTextIcon
} from './icons';

const STATUSES: IncidentStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

/** Photos are authority-only, so they are fetched with the bearer token and shown from a blob URL. */
function Photo({ file, token }: { file: string; token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false;
    let made: string | null = null;
    fetch(`/api/files/${file}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        if (!revoked) {
          made = URL.createObjectURL(b);
          setUrl(made);
        }
      })
      .catch(() => setUrl(null));
    return () => {
      revoked = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [file, token]);

  return url ? (
    <a href={url} target="_blank" rel="noreferrer" title="Click to view full resolution evidence">
      <img className="thumb" src={url} alt="incident proof" />
    </a>
  ) : (
    <span className="muted">photo…</span>
  );
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
  const [selectedRoutePlan, setSelectedRoutePlan] = useState<PlanItem | null>(null);
  const [showSitRep, setShowSitRep] = useState(false);
  const [sitRepCopied, setSitRepCopied] = useState(false);
  const [focusPoint, setFocusPoint] = useState<[number, number] | null>(null);
  const [sim, setSim] = useState({ rain: 120 });
  const [simResult, setSimResult] = useState<Risk[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [searchIncident, setSearchIncident] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, i, p, r, rd, f] = await Promise.all([
        api<Summary>('/api/dashboard/summary', { token: t }),
        api<Incident[]>('/api/incidents?activeOnly=false', { token: t }),
        api<PlanItem[]>('/api/rescue/plan', { token: t }),
        api<Risk[]>('/api/risk/map'),
        api<Road[]>('/api/roads'),
        api<Facility[]>('/api/facilities'),
      ]);
      setSummary(s);
      setIncidents(i);
      setPlan(p);
      setRisk(r);
      setRoads(rd);
      setFacilities(f);
      setErr('');
    } catch (ex) {
      setErr((ex as Error).message);
    }
  }, [t]);
  useLive(load);

  const patchIncident = async (id: number, body: { status?: IncidentStatus; assignedTo?: string }) => {
    try {
      playSuccess();
      await api(`/api/incidents/${id}`, { method: 'PATCH', body, token: t });
      load();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  const patchResource = async (r: Resource, delta: number) => {
    playClick();
    const available = Math.max(0, Math.min(r.total, r.available + delta));
    try {
      await api(`/api/resources/${r.id}`, { method: 'PATCH', body: { available }, token: t });
      load();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  const runSim = async (persist: boolean) => {
    playSonar();
    setBusy(true);
    try {
      const res = await api<Risk[]>('/api/risk/simulate', {
        method: 'POST',
        token: t,
        body: { rainfall24hMm: sim.rain, persist },
      });
      setSimResult(persist ? null : res);
      if (persist) {
        playSuccess();
        load();
      }
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const refreshWeather = async () => {
    playClick();
    setBusy(true);
    try {
      await api('/api/risk/refresh', { method: 'POST', token: t });
      setSimResult(null);
      playSuccess();
      load();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleShowRoute = (item: PlanItem) => {
    playSonar();
    setRoute(item.routeFromBase.path);
    setSelectedRoutePlan(item);
  };

  const handleClearRoute = () => {
    playClick();
    setRoute([]);
    setSelectedRoutePlan(null);
  };

  const publicIncidents = useMemo(
    () => incidents.filter((i) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(i.status)),
    [incidents]
  );

  const filteredIncidents = useMemo(() => {
    return incidents.filter((i) => {
      const text = `${i.type} ${i.description} ${i.locality ?? ''} ${i.assignedTo ?? ''} ${i.reporter ?? ''}`.toLowerCase();
      return text.includes(searchIncident.toLowerCase());
    });
  }, [incidents, searchIncident]);

  return (
    <div className="stack">
      {err && <div className="error">{err}</div>}

      {/* TACTICAL COMMAND METRIC STRIP */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sky)' }}>
          Operational Command Metrics
        </div>
        <button
          type="button"
          onClick={() => {
            playSonar();
            setShowSitRep(true);
            setSitRepCopied(false);
          }}
          style={{ fontSize: 12, padding: '4px 12px' }}
        >
          📄 Generate Incident SitRep
        </button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <b>{summary?.activeIncidents ?? '–'}</b>
          <span>Active Emergencies</span>
        </div>
        <div className={`kpi ${summary?.activeBySeverity?.CRITICAL ? 'crit' : 'safe'}`}>
          <b>{summary?.activeBySeverity?.CRITICAL ?? '0'}</b>
          <span>Life-Threat Critical</span>
        </div>
        <div className={`kpi ${summary?.blockedRoads ? 'hi' : 'safe'}`}>
          <b>{summary?.blockedRoads ?? '0'}</b>
          <span>Inundated Road Sections</span>
        </div>
        <div className="kpi hi">
          <b>{summary?.localitiesByRisk?.HIGH ?? '–'}</b>
          <span>High-Risk Basins</span>
        </div>
        <div className="kpi warn">
          <b>{summary?.localitiesByRisk?.MODERATE ?? '–'}</b>
          <span>Moderate Risk</span>
        </div>
      </div>

      {/* MAP AND SIMULATOR / RESOURCES DUAL GRID */}
      <div className="grid2">
        {/* MAP BOARD */}
        <section className="card" style={{ padding: 16 }}>
          <div className="card-header-bar">
            <h3>
              <NavigationIcon size={18} style={{ color: 'var(--sky)' }} />
              Live Tactical Inundation & Rescue Grid
            </h3>
            <span className="muted" style={{ fontSize: 11 }}>
              {route.length > 0 ? 'Rescue transit vector displayed' : 'Select a dispatch row to trace route'}
            </span>
          </div>

          {selectedRoutePlan && (
            <div style={{
              margin: '0 0 12px',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🚨 Tactical Transit: {selectedRoutePlan.rescueBase}</span>
                  <span>➔</span>
                  <span style={{ color: '#34d399' }}>{selectedRoutePlan.incident.locality ?? 'Target Coordinates'}</span>
                  <span className={`pill sev-${selectedRoutePlan.incident.severity}`} style={{ fontSize: 9 }}>{selectedRoutePlan.incident.severity}</span>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                  Distance: <b>{selectedRoutePlan.routeFromBase.distanceKm} km</b> · Est. Flood ETA: <b>~{selectedRoutePlan.routeFromBase.etaMinutes} mins</b>
                  {selectedRoutePlan.routeFromBase.detoured && (
                    <span style={{ color: '#fbbf24', marginLeft: 6 }}>
                      (Detour Avoidance: +{selectedRoutePlan.routeFromBase.extraKmVsNormal} km via safe high ground)
                    </span>
                  )}
                  {selectedRoutePlan.nearestHospital && ` · Trauma: ${selectedRoutePlan.nearestHospital}`}
                  {selectedRoutePlan.nearestShelter && ` · Shelter: ${selectedRoutePlan.nearestShelter}`}
                </div>
              </div>

              <button type="button" onClick={handleClearRoute} style={{ padding: '3px 8px', fontSize: 11 }}>
                ✕ Clear Vector
              </button>
            </div>
          )}

          <MapView
            risk={risk}
            incidents={publicIncidents}
            roads={roads}
            facilities={facilities}
            route={route}
            focusPoint={focusPoint}
            height={500}
          />
        </section>

        {/* AI RAINFALL SIMULATOR & RESOURCE FLEET BALANCER */}
        <aside className="stack">
          {/* AI WHAT-IF RAINFALL SIMULATOR */}
          <section className="card">
            <div className="card-header-bar">
              <h3>
                <ActivityIcon size={18} style={{ color: 'var(--sky)' }} />
                AI Rainfall What-If Simulator
              </h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#34d399' }}>
                {sim.rain} mm / 24h
              </span>
            </div>

            <label>
              Simulate Torrential Downpour:
              <input
                type="range"
                min={0}
                max={400}
                step={5}
                value={sim.rain}
                onChange={(e) => setSim({ rain: Number(e.target.value) })}
                style={{ accentColor: '#34d399', cursor: 'pointer' }}
              />
            </label>

            <div className="row" style={{ marginTop: 10 }}>
              <button disabled={busy} onClick={() => runSim(false)}>
                Preview Impact
              </button>
              <button disabled={busy} className="primary" onClick={() => runSim(true)}>
                Commit to Operational Map
              </button>
              <button disabled={busy} onClick={refreshWeather} title="Reset to official live Open-Meteo satellite feed">
                <RefreshCwIcon size={13} className={busy ? 'spinning' : ''} />
                Re-sync Weather
              </button>
            </div>

            {simResult && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>
                  Simulated Scenario Predictions:
                </div>
                <div className="scroll" style={{ maxHeight: 160 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Locality</th>
                        <th>Predicted Risk</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simResult.map((l) => (
                        <tr key={l.id}>
                          <td>{l.name}</td>
                          <td>
                            <span className={`pill ${l.riskLevel}`}>{l.riskLevel}</span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {l.riskScore.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              Hydrological simulation runs against the random forest ML model trained on historical 2004–2024 monsoon flood records.
            </p>
          </section>

          {/* RESCUE FLEET & MATERIAL BALANCER */}
          <section className="card">
            <div className="card-header-bar">
              <h3>
                <TruckIcon size={18} style={{ color: 'var(--sky)' }} />
                NDRF / SDRF Rescue Fleet Inventory
              </h3>
              <span className="muted">Live Deployment Balancer</span>
            </div>

            <div className="scroll" style={{ maxHeight: 220 }}>
              <table>
                <thead>
                  <tr>
                    <th>Resource & Base</th>
                    <th>Available / Total</th>
                    <th style={{ textAlign: 'right' }}>Deploy / Recover</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.resources.map((r) => {
                    const ratio = r.total > 0 ? (r.available / r.total) * 100 : 0;
                    return (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.name}</div>
                          <span className="muted" style={{ fontSize: 11 }}>{r.base}</span>
                        </td>
                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
                            {r.available} <span style={{ color: 'var(--ink-secondary)', fontWeight: 400 }}>/ {r.total}</span>
                          </div>
                          <div className="score-bar-bg" style={{ width: 60, marginTop: 4 }}>
                            <div
                              className="score-bar-fill"
                              style={{
                                width: `${ratio}%`,
                                background: ratio < 30 ? '#ef4444' : ratio < 60 ? '#f59e0b' : '#10b981',
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            <button
                              type="button"
                              style={{ padding: '2px 8px', fontSize: 12 }}
                              onClick={() => patchResource(r, -1)}
                              disabled={r.available <= 0}
                              title="Deploy one unit"
                            >
                              −
                            </button>
                            <button
                              type="button"
                              style={{ padding: '2px 8px', fontSize: 12 }}
                              onClick={() => patchResource(r, +1)}
                              disabled={r.available >= r.total}
                              title="Recover one unit"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      </div>

      {/* DISPATCH EXECUTION MATRIX */}
      <section className="card">
        <div className="card-header-bar">
          <div>
            <h3>
              <ShieldAlert size={18} style={{ color: 'var(--sky)' }} />
              Live Emergency Dispatch Priority Matrix
            </h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Ranked dynamically by severity, water level, entrapment count, and shortest unobstructed road routing.
            </p>
          </div>
          <span className="pill HIGH">{plan.length} ACTIVE DISPATCHES</span>
        </div>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Incident Details</th>
                <th>Priority</th>
                <th>Optimal Base & Route</th>
                <th>Nearest Trauma Hospital</th>
                <th>Designated Safe Shelter</th>
                <th style={{ textAlign: 'right' }}>Routing</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((p) => (
                <tr key={p.incident.id} className={p.accessible ? '' : 'inaccessible'}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>#{p.rank}</td>
                  <td>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{p.incident.type.replace(/_/g, ' ')}</span>
                      <span className={`pill sev-${p.incident.severity}`}>{p.incident.severity}</span>
                    </div>
                    <span className="muted" style={{ fontSize: 11 }}>{p.incident.locality ?? 'Coordinates logged'}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: '#f87171' }}>
                    {p.incident.priority}
                  </td>
                  <td>
                    {p.accessible ? (
                      <div>
                        <b>{p.rescueBase}</b>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {p.routeFromBase.distanceKm} km · ~{p.routeFromBase.etaMinutes} min ETA
                          {p.routeFromBase.detoured && (
                            <span style={{ color: '#fbbf24', marginLeft: 4 }}>
                              (detour +{p.routeFromBase.extraKmVsNormal} km via bypass)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="error" style={{ display: 'inline-flex', padding: '3px 8px', fontSize: 11 }}>
                        ⚠ Unreachable by road — Deploy amphibious boat or airlift
                      </span>
                    )}
                  </td>
                  <td>
                    {p.nearestHospital ?? '—'}
                    {p.hospitalKm != null && <div className="muted">{p.hospitalKm} km away</div>}
                  </td>
                  <td>
                    {p.nearestShelter ?? '—'}
                    {p.shelterKm != null && <div className="muted">{p.shelterKm} km away</div>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {p.accessible && (
                      <button
                        type="button"
                        className="primary"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => handleShowRoute(p)}
                      >
                        <NavigationIcon size={12} />
                        Trace Route
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {plan.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    No pending emergency dispatches. All reported incidents are resolved or standby.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ALL INCIDENTS AUDIT & COMMAND LOG */}
      <section className="card">
        <div className="card-header-bar">
          <h3>
            <ActivityIcon size={18} style={{ color: 'var(--sky)' }} />
            Master Incidents Incident Board & Evidence
          </h3>
          <div style={{ position: 'relative', width: 260 }}>
            <input
              type="text"
              placeholder="Search reports or assigned units..."
              value={searchIncident}
              onChange={(e) => setSearchIncident(e.target.value)}
              style={{ width: '100%', paddingLeft: 28, fontSize: 12 }}
            />
            <SearchIcon size={13} style={{ position: 'absolute', left: 8, top: 11, color: 'var(--ink-secondary)' }} />
          </div>
        </div>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Reported At</th>
                <th>Type & Severity</th>
                <th>Citizen Description</th>
                <th>Photo Evidence</th>
                <th>Operational Status</th>
                <th>Assigned Task Force</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>#{i.id}</td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(i.createdAt).toLocaleString()}</div>
                    <span className="muted" style={{ fontSize: 11 }}>Reporter: {i.reporter ?? 'Anonymous'}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{i.type.replace(/_/g, ' ')}</div>
                    <span className={`pill sev-${i.severity}`}>{i.severity}</span>
                  </td>
                  <td className="desc" style={{ maxWidth: 300, fontSize: 13, lineHeight: 1.4 }}>
                    {i.description}
                  </td>
                  <td>{i.imageFile ? <Photo file={i.imageFile} token={t} /> : <span className="muted">None</span>}</td>
                  <td>
                    <select
                      value={i.status}
                      onChange={(e) => patchIncident(i.id, { status: e.target.value as IncidentStatus })}
                      style={{ fontSize: 12, fontWeight: 600 }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      defaultValue={i.assignedTo ?? ''}
                      placeholder="e.g. NDRF Unit 4..."
                      maxLength={80}
                      style={{ fontSize: 12 }}
                      onBlur={(e) => {
                        if (e.target.value !== (i.assignedTo ?? '')) {
                          patchIncident(i.id, { assignedTo: e.target.value });
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
              {filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    No incident records match query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* DISASTER SITREP MODAL */}
      {showSitRep && (
        <div
          onClick={() => setShowSitRep(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 4000,
            background: 'rgba(3, 7, 18, 0.8)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 700,
              background: 'rgba(9, 20, 15, 0.88)',
              backdropFilter: 'blur(28px) saturate(200%)',
              border: '1px solid rgba(52, 211, 153, 0.35)',
              borderRadius: 16,
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.14)',
              padding: 24,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className="card-header-bar">
              <h3>
                <FileTextIcon size={18} style={{ color: 'var(--sky)' }} />
                NDRF / District Emergency Situation Report (SitRep)
              </h3>
              <button type="button" onClick={() => setShowSitRep(false)} style={{ padding: '4px 10px', fontSize: 11 }}>
                ✕ Close
              </button>
            </div>

            <pre className="script" style={{ maxHeight: 380, overflowY: 'auto', fontSize: 12, lineHeight: 1.6 }}>
{`===================================================================
NATIONAL DISASTER RESPONSE FORCE & FLOOD CONTROL ROOM
OFFICIAL SITUATION REPORT (SITREP) · RESTRICTED OPERATIONAL RECORD
Generated: ${new Date().toLocaleString('en-IN', { timeZoneName: 'short' })}
Command Duty Officer: ${user.fullName} (${user.role})
===================================================================

1. EXECUTIVE THREAT ASSESSMENT:
   - Alert Status: DEFCON 2 / MONSOON RAIN SURVEILLANCE
   - Active Incidents Logged: ${summary?.activeIncidents ?? 0}
   - Critical Life-Threat Calls: ${summary?.activeBySeverity?.CRITICAL ?? 0}
   - Arterial Roads Inundated: ${summary?.blockedRoads ?? 0}
   - High-Risk Basins Identified: ${summary?.localitiesByRisk?.HIGH ?? 0}

2. RESCUE FLEET & RESOURCE STATUS:
${summary?.resources.map((r) => `   * ${r.name} (${r.base}): ${r.available}/${r.total} Available (${Math.round((r.available / (r.total || 1)) * 100)}% Readiness)`).join('\n') ?? '   No resources registered.'}

3. ACTIVE PRIORITY DISPATCHES (TOP 5):
${plan.slice(0, 5).map((p) => `   #${p.rank} [Priority ${p.incident.priority}] ${p.incident.type} @ ${p.incident.locality ?? 'Coordinates'}:
     Assigned Base: ${p.rescueBase} | ETA: ~${p.routeFromBase.etaMinutes} min | Route: ${p.routeFromBase.distanceKm} km
     ${p.routeFromBase.detoured ? `Detour Avoidance: +${p.routeFromBase.extraKmVsNormal} km via safe high ground` : 'Direct unobstructed road'}`).join('\n') || '   No active dispatches.'}

4. STRATEGIC OPERATIONAL DIRECTIVES:
   - Ground truth recon must confirm detour navigability before vehicle movement.
   - For road-inaccessible zones, deploy inflatable assault boats or state helicopter airlifts.
   - Medical triage units prepositioned at designated trauma facilities.
===================================================================`}
            </pre>

            <div className="row spread" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const dateStr = new Date().toLocaleString();
                  const text = `NATIONAL DISASTER RESPONSE FORCE - SITUATION REPORT\nGenerated: ${dateStr}\nActive Incidents: ${summary?.activeIncidents}\nCritical Calls: ${summary?.activeBySeverity?.CRITICAL}\nBlocked Roads: ${summary?.blockedRoads}`;
                  navigator.clipboard.writeText(text);
                  playSuccess();
                  setSitRepCopied(true);
                  setTimeout(() => setSitRepCopied(false), 2500);
                }}
              >
                <CheckCircleIcon size={14} />
                {sitRepCopied ? '✓ Copied SitRep to Clipboard' : 'Copy SitRep to Clipboard'}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
              >
                🖨️ Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
