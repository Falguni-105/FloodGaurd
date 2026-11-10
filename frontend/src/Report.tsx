import { useState, useEffect, useCallback } from 'react';
import MapView from './MapView';
import { api, useLive } from './api';
import type { Incident, IncidentType, Risk, Severity, User } from './types';
import { playClick, playSonar, playSuccess } from './sound';
import {
  ShieldAlert, MapPinIcon, CrosshairIcon, LifeBuoyIcon,
  NavigationIcon, CheckCircleIcon, AlertTriangleIcon
} from './icons';

const TYPE_CONFIG: Record<IncidentType, { label: string; icon: string; desc: string }> = {
  WATERLOGGING: { label: 'Waterlogging / Flash Flood', icon: '🌊', desc: 'Streets submerged, water entering homes' },
  BLOCKED_ROAD: { label: 'Arterial Road Blocked', icon: '⛔', desc: 'Submerged bridge, landslide, debris' },
  DRAINAGE_OVERFLOW: { label: 'Drainage / Nullah Overflow', icon: '🚰', desc: 'Canal breaching, drain backing up' },
  PEOPLE_TRAPPED: { label: 'Civilians Stranded / Trapped', icon: '🆘', desc: 'People stranded on roofs or rising water' },
  MEDICAL_EMERGENCY: { label: 'Medical Crisis in Flood Zone', icon: '🚑', desc: 'Critical patient or injury requiring boat' },
  OTHER: { label: 'Other Flood Incident', icon: '⚠️', desc: 'Structural failure or electric hazard' },
};

const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function Report({ user }: { user: User }) {
  const [type, setType] = useState<IncidentType>('WATERLOGGING');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Incident[]>([]);
  const [risk, setRisk] = useState<Risk[]>([]);

  const load = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([
        api<Incident[]>('/api/incidents/mine', { token: user.token }),
        api<Risk[]>('/api/risk/map'),
      ]);
      setMine(m);
      setRisk(r);
    } catch {
      // server offline
    }
  }, [user.token]);

  useLive(load);

  useEffect(() => {
    locate(false);
  }, []); // eslint-disable-line

  function locate(report = true) {
    if (!navigator.geolocation) return;
    playClick();
    navigator.geolocation.getCurrentPosition(
      (p) => {
        playSonar();
        setPoint([p.coords.latitude, p.coords.longitude]);
      },
      () => report && setStatus({ ok: false, text: 'Could not access GPS — click anywhere on the map to drop pin.' }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImage(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!point) {
      setStatus({ ok: false, text: 'Please set the location by clicking GPS or selecting on the map.' });
      return;
    }
    if (image && image.size > 5 * 1024 * 1024) {
      setStatus({ ok: false, text: 'Image file must be under 5 MB.' });
      return;
    }
    setBusy(true);
    setStatus(null);
    playSonar();

    const form = new FormData();
    form.append('type', type);
    form.append('severity', severity);
    form.append('description', description);
    form.append('latitude', String(point[0]));
    form.append('longitude', String(point[1]));
    if (image) form.append('image', image);

    try {
      await api<Incident>('/api/incidents', { method: 'POST', form, token: user.token });
      playSuccess();
      setStatus({
        ok: true,
        text: 'Emergency SOS registered! Municipal Control Room and nearest SDRF team have been alerted.',
      });
      setDescription('');
      setImage(null);
      setImagePreview(null);
      load();
    } catch (ex) {
      setStatus({ ok: false, text: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid2">
      {/* CITIZEN SOS SUBMISSION FORM */}
      <form className="card" onSubmit={submit}>
        <div className="card-header-bar">
          <h3>
            <ShieldAlert size={18} style={{ color: '#f43f5e' }} />
            Citizen Emergency SOS & Incident Dispatch
          </h3>
          <span className="pill CRITICAL">LIVE DISPATCH LINK</span>
        </div>

        <div className="banner" style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          <AlertTriangleIcon size={18} style={{ flexShrink: 0, marginTop: 2, color: '#f87171' }} />
          <div>
            If life is in imminent danger, dial <b>112 (Police/Fire/Ambulance)</b> immediately. This digital portal triggers tactical disaster room response and route mapping.
          </div>
        </div>

        {/* INCIDENT TYPE PICKER */}
        <div style={{ margin: '14px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sky)', marginBottom: 8 }}>
            1. Select Emergency Type:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {(Object.keys(TYPE_CONFIG) as IncidentType[]).map((t) => {
              const cfg = TYPE_CONFIG[t];
              const isSelected = type === t;
              return (
                <div
                  key={t}
                  onClick={() => {
                    playClick();
                    setType(t);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'rgba(8, 18, 13, 0.6)',
                    border: `1px solid ${isSelected ? '#34d399' : 'var(--line)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: isSelected ? '#fff' : 'var(--ink)' }}>
                    <span>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-secondary)', marginTop: 4 }}>{cfg.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEVERITY LEVEL */}
        <div style={{ margin: '14px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sky)', marginBottom: 8 }}>
            2. Threat Severity:
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                className={severity === s ? 'primary' : ''}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderColor: severity === s ? (s === 'CRITICAL' ? '#f43f5e' : undefined) : undefined,
                  background: severity === s ? (s === 'CRITICAL' ? 'rgba(244,63,94,0.3)' : undefined) : undefined,
                }}
                onClick={() => {
                  playClick();
                  setSeverity(s);
                }}
              >
                {s === 'CRITICAL' ? '🚨 CRITICAL (LIFE AT RISK)' : s}
              </button>
            ))}
          </div>
        </div>

        {/* SITUATION BRIEF */}
        <label>
          3. Incident Description & Urgency Details:
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={1000}
            rows={3}
            placeholder="Describe water depth, how many adults/children stranded, nearest landmark or building..."
          />
        </label>

        {/* PHOTO ATTACHMENT */}
        <label>
          4. Photo Evidence (Optional, max 5 MB):
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
        </label>

        {imagePreview && (
          <div style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={imagePreview} alt="upload preview" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
            <span className="muted" style={{ fontSize: 12 }}>Photo attached. It will be sent to the control room.</span>
          </div>
        )}

        {/* LOCATION SELECTOR */}
        <div style={{
          padding: '12px 14px', borderRadius: 10, background: 'rgba(10, 18, 32, 0.6)',
          border: '1px solid var(--line)', margin: '14px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" onClick={() => locate(true)} style={{ fontSize: 12 }}>
              <NavigationIcon size={14} /> Detect My GPS Coordinates
            </button>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: point ? '#34d399' : 'var(--ink-secondary)' }}>
              {point ? `📍 Lat: ${point[0].toFixed(5)}, Lon: ${point[1].toFixed(5)}` : '⚠️ Coordinates not set — Click on the map'}
            </div>
          </div>
        </div>

        {status && <div className={status.ok ? 'ok' : 'error'}>{status.text}</div>}

        <button className="primary" disabled={busy} style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 8 }}>
          {busy ? 'Transmitting Emergency SOS…' : 'Transmit Emergency SOS to Control Room'}
        </button>

        {/* MY SUBMITTED REPORTS TRACKER */}
        <h4 style={{ marginTop: 24 }}>My Submitted Emergency Reports ({mine.length})</h4>
        {mine.length === 0 ? (
          <p className="muted">You have not submitted any emergency reports from this session.</p>
        ) : (
          <div className="scroll" style={{ maxHeight: 200 }}>
            <table>
              <thead>
                <tr>
                  <th>Type & Severity</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{i.type.replace(/_/g, ' ')}</div>
                      <span className={`pill sev-${i.severity}`}>{i.severity}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 11 }}>{new Date(i.createdAt).toLocaleString()}</td>
                    <td>
                      <span className={`pill ${i.status === 'RESOLVED' ? 'COMPLETED' : 'ACTIVE'}`}>
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </form>

      {/* MAP VIEW FOR PIN DROPPING */}
      <section className="card" style={{ padding: 16 }}>
        <div className="card-header-bar">
          <h3>
            <MapPinIcon size={18} style={{ color: 'var(--sky)' }} />
            Pinpoint Exact Flood Location
          </h3>
          <span className="muted">Click anywhere on the map to set coordinate pin</span>
        </div>

        <MapView
          risk={risk}
          picked={point}
          onPick={(pos) => {
            playSonar();
            setPoint(pos);
          }}
          height={580}
        />
      </section>
    </div>
  );
}
