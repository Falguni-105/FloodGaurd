import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Risk, RiskLevel } from './types';
import {
  PUNE_WARDS, actionWindows, applyRain, basisLabel, loadRain, placeFromRisk,
  type ActionWindow, type DayRain, type Place, type PlanSeed, type Series,
} from './ops';
import { playClick, playSonar } from './sound';
import {
  CalendarIcon, CloudRainIcon, SparklesIcon, ChevronRightIcon,
  RefreshCwIcon, ShieldAlert, ActivityIcon
} from './icons';

type Scope = 'pune' | 'national';

function dayLabel(iso: string): string {
  return iso.slice(8);
}

export default function Outlook({ canPlan, onPlan }: { canPlan: boolean; onPlan: (seed: PlanSeed) => void }) {
  const [scope, setScope] = useState<Scope>('pune');
  const [places, setPlaces] = useState<Place[]>(PUNE_WARDS);
  const [rain, setRain] = useState<Map<string, DayRain[]> | null>(null);
  const [live, setLive] = useState(false);
  const [drill, setDrill] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState<{ key: string; date: string } | null>(null);

  const load = useCallback(async (nextScope: Scope) => {
    setBusy(true);
    setErr('');
    try {
      let list = PUNE_WARDS;
      if (nextScope === 'national') {
        try {
          const risks = await api<Risk[]>('/api/risk/map');
          if (risks.length) list = risks.map(placeFromRisk);
        } catch {
          setErr('National hotspots need the FloodGuard server. Showing the Pune pilot instead.');
          list = PUNE_WARDS;
          setScope('pune');
        }
      }
      const got = await loadRain(list);
      setPlaces(list);
      setRain(got.rain);
      setLive(got.live);
      setPicked((cur) => cur && list.some((p) => p.key === cur.key) ? cur : { key: list[0].key, date: got.rain.values().next().value?.[0]?.date ?? '' });
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load('pune'); }, [load]);

  const series = useMemo(() => (rain ? applyRain(places, rain, drill) : []), [places, rain, drill]);
  const windows = useMemo(() => actionWindows(series), [series]);
  const dates = series[0]?.days.map((d) => d.date) ?? [];

  const highDays = series.reduce((n, s) => n + s.days.filter((d) => d.level === 'HIGH').length, 0);
  const peak = series.reduce((m, s) => Math.max(m, ...s.days.map((d) => d.score)), 0);
  const first = windows[0];

  const selected: { series: Series; index: number } | null = useMemo(() => {
    if (!picked) return null;
    const s = series.find((x) => x.place.key === picked.key);
    if (!s) return null;
    const index = s.days.findIndex((d) => d.date === picked.date);
    return index >= 0 ? { series: s, index } : null;
  }, [picked, series]);

  const seedFor = (w: ActionWindow): PlanSeed => ({
    title: `${w.level === 'HIGH' ? 'High' : 'Elevated'} water response ${w.start.slice(5)} to ${w.end.slice(5)}`,
    startDate: w.start,
    endDate: w.end,
    localityNames: w.localities,
    peakLevel: w.level,
    basis: basisLabel(drill, live),
  });

  return (
    <div className="stack">
      {/* 30-DAY OUTLOOK HERO & DRILL CONTROLS */}
      <section className="card">
        <div className="card-header-bar">
          <div>
            <h3>
              <CalendarIcon size={18} style={{ color: 'var(--sky)' }} />
              30-Day Predictive Inundation Outlook
            </h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              High-resolution hydrological predictive modeling across 30 days combining 72h antecedence, daily intensity, and terrain exposure.
            </p>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={scope === 'pune' ? 'on' : ''}
              onClick={() => {
                playClick();
                setScope('pune');
                load('pune');
              }}
            >
              Pune Wards (Pilot)
            </button>
            <button
              type="button"
              className={scope === 'national' ? 'on' : ''}
              onClick={() => {
                playClick();
                setScope('national');
                load('national');
              }}
            >
              National Hotspots
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="kpis" style={{ margin: '14px 0' }}>
          <div className={`kpi ${highDays > 0 ? 'hi' : 'safe'}`}>
            <b>{busy ? '…' : highDays}</b>
            <span>High-Risk Locality-Days</span>
          </div>
          <div className="kpi warn">
            <b>{busy || !Number.isFinite(peak) ? '…' : peak.toFixed(0)}</b>
            <span>Peak Inundation Score</span>
          </div>
          <div className="kpi">
            <b>{first ? first.start.slice(5) : '—'}</b>
            <span>First Action Window</span>
          </div>
          <div className="kpi">
            <b>{windows.length}</b>
            <span>Identified Action Windows</span>
          </div>
        </div>

        {/* DRILL SIMULATOR CONTROL */}
        <div style={{
          background: 'rgba(10, 18, 32, 0.5)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          margin: '14px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sky)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <SparklesIcon size={15} />
              Stress-Test / Monsoon Scenario Multiplier:
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: drill > 1 ? '#fbbf24' : '#34d399' }}>
              ×{drill.toFixed(2)} Rainfall
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.25}
              value={drill}
              onChange={(e) => setDrill(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#34d399', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {[1.0, 1.5, 2.0, 2.5].map((val) => (
                <button
                  key={val}
                  type="button"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  className={drill === val ? 'primary' : ''}
                  onClick={() => {
                    playClick();
                    setDrill(val);
                  }}
                >
                  ×{val.toFixed(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Informative Banner */}
        <div className="banner">
          <CloudRainIcon size={18} style={{ color: 'var(--sky)', flexShrink: 0, marginTop: 2 }} />
          <div>
            {live
              ? 'Days 1–16 are powered by live ECMWF & Open-Meteo precipitation forecasts. Days 17–30 repeat a dampened harmonic pattern to allow strategic resource prepositioning.'
              : 'Live weather feed unreachable; running on local high-precision standby scenario patterns.'}
            {drill !== 1 && ` Stress drill is scaling precipitation intensity by ×${drill}. Operational field map remains synced to live baseline.`}
          </div>
        </div>

        {err && <div className="error">{err}</div>}

        <div className="row spread" style={{ marginTop: 12 }}>
          <button type="button" disabled={busy} onClick={() => { playClick(); load(scope); }}>
            <RefreshCwIcon size={14} className={busy ? 'spinning' : ''} />
            {busy ? 'Computing Hydro-Model…' : 'Reload Forecast'}
          </button>
          <span className="legend">
            <i className="lo" /> Low Risk (0–40)
            <i className="mo" /> Moderate (40–70)
            <i className="hi" /> High Risk (70–100)
          </span>
        </div>
      </section>

      {/* STRATEGIC ACTION WINDOWS */}
      {windows.length > 0 && (
        <section className="card">
          <div className="card-header-bar">
            <h3>
              <ActivityIcon size={18} style={{ color: 'var(--sky)' }} />
              Strategic Preparedness Windows
            </h3>
            <span className="muted">{windows.length} critical windows flagged</span>
          </div>

          <div className="window-grid">
            {windows.map((w) => (
              <article key={`${w.start}-${w.end}`} className="window">
                <div>
                  <div className="row spread" style={{ margin: '0 0 8px' }}>
                    <span className={`pill ${w.level}`}>{w.level} RISK</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                      {w.start} → {w.end}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    Peak Score: <b style={{ color: w.level === 'HIGH' ? '#f87171' : '#fbbf24', fontFamily: 'var(--font-mono)' }}>{w.peak}</b>
                  </div>
                  <p className="muted" style={{ fontSize: 12, lineHeight: 1.4, margin: '0 0 14px' }}>
                    Impacted: {w.localities.join(', ')}
                  </p>
                </div>

                {canPlan ? (
                  <button
                    type="button"
                    className="primary"
                    style={{ width: '100%', justifyContent: 'space-between' }}
                    onClick={() => {
                      playSonar();
                      onPlan(seedFor(w));
                    }}
                  >
                    <span>Deploy Execution Plan</span>
                    <ChevronRightIcon size={14} />
                  </button>
                ) : (
                  <p className="muted" style={{ fontSize: 11, fontStyle: 'italic', margin: 0 }}>
                    Authority login required to generate evacuation plan.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 30-DAY HEATMAP MATRIX */}
      <section className="card">
        <div className="card-header-bar">
          <h3>
            <CalendarIcon size={18} style={{ color: 'var(--sky)' }} />
            30-Day Geospatial Heatmap Matrix
          </h3>
          <span className="muted">Click any day tile to inspect hydrological telemetry</span>
        </div>

        <div className="scroll">
          <table className="heat-table">
            <thead>
              <tr>
                <th>Locality / Ward</th>
                {dates.map((d) => (
                  <th key={d}>{dayLabel(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.place.key}>
                  <th>
                    <div style={{ fontWeight: 600 }}>{s.place.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-secondary)' }}>
                      Vuln: {s.place.vulnerability} · Elev: {s.place.elevationM}m
                    </div>
                  </th>
                  {s.days.map((d) => {
                    const isSelected = picked?.key === s.place.key && picked.date === d.date;
                    return (
                      <td key={d.date}>
                        <button
                          type="button"
                          className={`cell ${d.level} ${isSelected ? 'on' : ''}`}
                          title={`${s.place.name} on ${d.date}: Score ${d.score} (${d.level}) · Rain: ${d.rainMm}mm`}
                          onClick={() => {
                            playClick();
                            setPicked({ key: s.place.key, date: d.date });
                          }}
                        >
                          {d.score}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* INSPECTED DAY TELEMETRY CARD */}
      {selected && (
        <DayDetail
          series={selected.series}
          index={selected.index}
          canPlan={canPlan}
          basis={basisLabel(drill, live)}
          onPlan={onPlan}
        />
      )}
    </div>
  );
}

function DayDetail({
  series,
  index,
  canPlan,
  basis,
  onPlan,
}: {
  series: Series;
  index: number;
  canPlan: boolean;
  basis: string;
  onPlan: (seed: PlanSeed) => void;
}) {
  const day = series.days[index];
  const level: RiskLevel = day.level;

  return (
    <section className="card" style={{ borderLeft: `6px solid ${level === 'HIGH' ? '#ef4444' : level === 'MODERATE' ? '#f59e0b' : '#10b981'}` }}>
      <div className="card-header-bar">
        <h3>
          <ShieldAlert size={18} style={{ color: level === 'HIGH' ? '#f87171' : '#34d399' }} />
          Detailed Telemetry: {series.place.name} · {day.date}
        </h3>
        <span className={`pill ${level}`}>{level} RISK</span>
      </div>

      <div className="kpis" style={{ margin: '14px 0' }}>
        <div className={`kpi ${level === 'HIGH' ? 'hi' : level === 'MODERATE' ? 'warn' : 'safe'}`}>
          <b>{day.score}</b>
          <span>Computed Risk Score</span>
        </div>
        <div className="kpi">
          <b>{day.rainMm} mm</b>
          <span>24h Daily Rain</span>
        </div>
        <div className="kpi">
          <b>{day.rain72} mm</b>
          <span>72h Prior Rain</span>
        </div>
        <div className="kpi">
          <b>{day.pop}%</b>
          <span>Precipitation Probability</span>
        </div>
        <div className="kpi">
          <b>{series.place.elevationM}m</b>
          <span>Terrain Elevation</span>
        </div>
        <div className="kpi">
          <b>{series.place.vulnerability}/100</b>
          <span>Exposure Susceptibility</span>
        </div>
      </div>

      <div className="row spread" style={{ marginTop: 14 }}>
        <span className="muted" style={{ fontSize: 12 }}>
          Data Source: {day.source === 'extended' ? 'Extended Cycle Model' : day.source === 'fallback' ? 'Standby Matrix' : 'Live Open-Meteo Satellite'} · Basis: {basis}
        </span>

        {canPlan && level !== 'LOW' && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              playSonar();
              onPlan({
                title: `${level === 'HIGH' ? 'High' : 'Elevated'} water response — ${series.place.name} ${day.date}`,
                startDate: day.date,
                endDate: day.date,
                localityNames: [series.place.name],
                peakLevel: level,
                basis,
              });
            }}
          >
            Deploy One-Day Emergency Plan
          </button>
        )}
      </div>
    </section>
  );
}
