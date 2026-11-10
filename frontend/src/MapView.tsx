import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Facility, PublicIncident, Risk, Road } from './types';

export type TileTheme = 'dark' | 'satellite' | 'street';

const TILES: Record<TileTheme, { url: string; attribution: string; name: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
    name: 'Tactical Dark',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; Earthstar Geographics',
    name: 'Satellite Topo',
  },
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
    name: 'Light Street',
  },
};

const RISK_COLOR = { LOW: '#10b981', MODERATE: '#f59e0b', HIGH: '#ef4444' } as const;
const SEV_COLOR = { LOW: '#34d399', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#f43f5e' } as const;

// Create custom glowing facility icon
const createFacIcon = (t: Facility['type']) => {
  const symbol = t === 'HOSPITAL' ? '🏥' : t === 'SHELTER' ? '⛺' : '🚒';
  return L.divIcon({
    className: 'custom-fac-marker',
    html: `<div class="fac fac-${t}" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:14px;border:2px solid rgba(255,255,255,0.8);">${symbol}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// Pulsing ripple icon for critical incidents
const createCriticalPulseIcon = () => {
  return L.divIcon({
    className: 'critical-pulse-container',
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(244,63,94,0.4);animation:sonar-wave 1.6s infinite ease-out;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#f43f5e;border:2px solid #fff;box-shadow:0 0 10px #f43f5e;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function ClickHandler({ onPick }: { onPick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

// Controller component to smoothly fly to focused coordinates or routes
function MapFlyController({ focus, route }: { focus?: [number, number] | null; route?: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (route && route.length > 1) {
      const bounds = L.latLngBounds(route.map((p) => [p[0], p[1]]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
    } else if (focus) {
      map.flyTo(focus, Math.max(map.getZoom(), 13), { duration: 1.2 });
    }
  }, [focus, route, map]);

  return null;
}

interface Props {
  risk?: Risk[];
  incidents?: PublicIncident[];
  roads?: Road[];
  facilities?: Facility[];
  route?: [number, number][];
  picked?: [number, number] | null;
  focusPoint?: [number, number] | null;
  onPick?: (p: [number, number]) => void;
  height?: number | string;
  theme?: TileTheme;
}

export default function MapView({
  risk = [],
  incidents = [],
  roads = [],
  facilities = [],
  route,
  picked,
  focusPoint,
  onPick,
  height = 540,
  theme: initialTheme = 'dark',
}: Props) {
  const [theme, setTheme] = useState<TileTheme>(initialTheme);
  const [radarSweep, setRadarSweep] = useState(true);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {/* Floating Tactical Layer Switcher on Map */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(8, 18, 13, 0.92)',
        backdropFilter: 'blur(12px)',
        padding: '4px 6px',
        borderRadius: 99,
        border: '1px solid rgba(52, 211, 153, 0.30)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        <button
          type="button"
          onClick={() => setRadarSweep(!radarSweep)}
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            borderRadius: 99,
            border: '1px solid rgba(52, 211, 153, 0.25)',
            background: radarSweep ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
            color: radarSweep ? '#34d399' : '#698774',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
          title="Toggle animated tactical Doppler radar sweep"
        >
          🛰️ {radarSweep ? 'RADAR' : 'OFF'}
        </button>

        <div style={{ width: 1, height: 14, background: 'rgba(52, 211, 153, 0.2)' }} />

        {(['dark', 'satellite', 'street'] as TileTheme[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            style={{
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: theme === t ? 700 : 500,
              borderRadius: 99,
              border: 0,
              background: theme === t ? '#059669' : 'transparent',
              color: theme === t ? '#fff' : '#9eb8a8',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {TILES[t].name}
          </button>
        ))}
      </div>

      {/* DOPPLER RADAR SWEEP ANIMATION OVERLAY */}
      {radarSweep && theme === 'dark' && (
        <div className="radar-sweep-container">
          <div className="radar-beam" />
          <div className="radar-grid-ring" style={{ width: 280, height: 280 }} />
          <div className="radar-grid-ring" style={{ width: 560, height: 560 }} />
        </div>
      )}

      <MapContainer
        center={[22.5, 78.9]}
        zoom={5}
        style={{ height: '100%', width: '100%', borderRadius: 14 }}
        scrollWheelZoom
      >
        <TileLayer
          key={theme}
          attribution={TILES[theme].attribution}
          url={TILES[theme].url}
          maxZoom={19}
        />

        <MapFlyController focus={focusPoint || picked} route={route} />
        {onPick && <ClickHandler onPick={onPick} />}

        {/* ROADS & BLOCKED CORRIDORS */}
        {roads.map((r) => (
          <Polyline
            key={r.id}
            positions={[[r.fromLat, r.fromLon], [r.toLat, r.toLon]]}
            pathOptions={
              r.blocked
                ? { color: '#ef4444', weight: 6, dashArray: '8 8', opacity: 0.95 }
                : { color: theme === 'satellite' ? '#ffffff' : '#64748b', weight: 3, opacity: 0.65 }
            }
          >
            <Tooltip sticky>
              <div style={{ fontWeight: 600 }}>
                {r.blocked ? '⛔ BLOCKED: ' : '🛣️ '} {r.name}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Length: {r.lengthM}m</div>
            </Tooltip>
          </Polyline>
        ))}

        {/* FLOOD RISK HOTSPOT CIRCLES */}
        {risk.map((l) => (
          <CircleMarker
            key={l.id}
            center={[l.latitude, l.longitude]}
            radius={20 + l.riskScore / 6}
            pathOptions={{
              color: RISK_COLOR[l.riskLevel],
              fillColor: RISK_COLOR[l.riskLevel],
              fillOpacity: l.riskLevel === 'HIGH' ? 0.45 : 0.28,
              weight: l.riskLevel === 'HIGH' ? 2.5 : 1.5,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: 2 }}>{l.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}>
                <span className={`pill ${l.riskLevel}`}>{l.riskLevel}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{l.riskScore.toFixed(0)}/100</span>
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                Rain 24h: <b>{l.rainfall24hMm} mm</b> · Peak {l.rainfallIntensityMmh} mm/h<br />
                Elev: {l.elevationM} m · Source: {l.weatherSource}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* INCIDENT PINS */}
        {incidents.map((i) => {
          if (i.severity === 'CRITICAL') {
            return (
              <Marker key={i.id} position={[i.latitude, i.longitude]} icon={createCriticalPulseIcon()}>
                <Tooltip>
                  <b>CRITICAL SOS: {i.type.replace(/_/g, ' ')}</b>
                  <div>Status: {i.status}</div>
                </Tooltip>
              </Marker>
            );
          }
          return (
            <CircleMarker
              key={i.id}
              center={[i.latitude, i.longitude]}
              radius={8}
              pathOptions={{
                color: '#fff',
                weight: 2,
                fillColor: SEV_COLOR[i.severity],
                fillOpacity: 1,
              }}
            >
              <Tooltip>
                <b>{i.type.replace(/_/g, ' ')}</b>
                <div>Severity: {i.severity} · Status: {i.status}</div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* FACILITY ICONS */}
        {facilities.map((f) => (
          <Marker key={f.id} position={[f.latitude, f.longitude]} icon={createFacIcon(f.type)}>
            <Tooltip>
              <b>{f.name}</b>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Type: {f.type.replace(/_/g, ' ')} {f.capacity ? `· Capacity: ${f.capacity}` : ''}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* DISPATCH ROUTE POLYLINE WITH GLOW */}
        {route && route.length > 1 && (
          <>
            <Polyline
              positions={route}
              pathOptions={{ color: '#047857', weight: 9, opacity: 0.45 }}
            />
            <Polyline
              positions={route}
              pathOptions={{ color: '#34d399', weight: 4, opacity: 1 }}
            />
          </>
        )}

        {/* PICKED LOCATION MARKER */}
        {picked && (
          <CircleMarker
            center={picked}
            radius={10}
            pathOptions={{
              color: '#059669',
              fillColor: '#34d399',
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Tooltip permanent>📍 Target Coordinates</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
