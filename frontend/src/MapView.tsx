import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Facility, PublicIncident, Risk, Road } from './types';

const RISK_COLOR = { LOW: '#2e9e5b', MODERATE: '#f2b01e', HIGH: '#d64545' } as const;
const SEV_COLOR = { LOW: '#5b8def', MEDIUM: '#f2b01e', HIGH: '#f28c28', CRITICAL: '#b3001b' } as const;
const FAC_LETTER = { HOSPITAL: 'H', SHELTER: 'S', RESCUE_BASE: 'R' } as const;

const facIcon = (t: Facility['type']) =>
  L.divIcon({ className: `fac fac-${t}`, html: FAC_LETTER[t], iconSize: [24, 24], iconAnchor: [12, 12] });

function ClickHandler({ onPick }: { onPick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

interface Props {
  risk?: Risk[]; incidents?: PublicIncident[]; roads?: Road[]; facilities?: Facility[];
  route?: [number, number][]; picked?: [number, number] | null;
  onPick?: (p: [number, number]) => void; height?: number | string;
}

export default function MapView({ risk = [], incidents = [], roads = [], facilities = [], route, picked, onPick, height = 520 }: Props) {
  return (
    <MapContainer center={[22.5, 78.9]} zoom={5} style={{ height, width: '100%' }} scrollWheelZoom>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {onPick && <ClickHandler onPick={onPick} />}

      {roads.map((r) => (
        <Polyline key={r.id} positions={[[r.fromLat, r.fromLon], [r.toLat, r.toLon]]}
          pathOptions={r.blocked ? { color: '#d64545', weight: 5, dashArray: '8 8' } : { color: '#7a8a99', weight: 3, opacity: 0.7 }}>
          <Tooltip sticky>{r.name}{r.blocked ? ' — BLOCKED' : ''}</Tooltip>
        </Polyline>
      ))}

      {risk.map((l) => (
        <CircleMarker key={l.id} center={[l.latitude, l.longitude]} radius={22 + l.riskScore / 8}
          pathOptions={{ color: RISK_COLOR[l.riskLevel], fillColor: RISK_COLOR[l.riskLevel], fillOpacity: 0.35, weight: 2 }}>
          <Tooltip sticky>
            <b>{l.name}</b><br />Risk: {l.riskLevel} ({l.riskScore.toFixed(0)}/100)<br />
            Rain 24h: {l.rainfall24hMm} mm · peak {l.rainfallIntensityMmh} mm/h
          </Tooltip>
        </CircleMarker>
      ))}

      {incidents.map((i) => (
        <CircleMarker key={i.id} center={[i.latitude, i.longitude]} radius={7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: SEV_COLOR[i.severity], fillOpacity: 1 }}>
          <Tooltip>{i.type.replace(/_/g, ' ')} · {i.severity} · {i.status}</Tooltip>
        </CircleMarker>
      ))}

      {facilities.map((f) => (
        <Marker key={f.id} position={[f.latitude, f.longitude]} icon={facIcon(f.type)}>
          <Tooltip>{f.name}{f.capacity ? ` (capacity ${f.capacity})` : ''}</Tooltip>
        </Marker>
      ))}

      {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#1d6fa5', weight: 6 }} />}
      {picked && <CircleMarker center={picked} radius={9} pathOptions={{ color: '#0b2545', fillColor: '#13a89e', fillOpacity: 1, weight: 3 }} />}
    </MapContainer>
  );
}
