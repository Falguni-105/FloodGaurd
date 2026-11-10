import { useEffect, useState } from 'react';
import type { Risk, RiskLevel } from './types';

export type RainSource = 'open-meteo' | 'extended' | 'fallback';
export type PlanStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'COMPLETED';
export type TaskPhase = 'PREPARE' | 'RESPOND' | 'RECOVER';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
export type CallState = 'QUEUED' | 'DIALING' | 'ANSWERED' | 'ACKNOWLEDGED' | 'NO_ANSWER' | 'FAILED';
export type Channel = 'VOICE' | 'SMS';
export type Language = 'en' | 'hi' | 'mr';

export interface Place {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
  elevationM: number;
  /** Geographic susceptibility, 0–100, before rainfall is applied. */
  vulnerability: number;
  weatherKey: string;
}

export interface DayRain {
  date: string;
  rainMm: number;
  pop: number;
  source: RainSource;
}

export interface ScoredDay extends DayRain {
  rain72: number;
  score: number;
  level: RiskLevel;
}

export interface Series {
  place: Place;
  days: ScoredDay[];
}

export interface ActionWindow {
  start: string;
  end: string;
  peak: number;
  level: RiskLevel;
  localities: string[];
}

export interface PlanTask {
  id: string;
  title: string;
  phase: TaskPhase;
  owner: string;
  status: TaskStatus;
  notes: string;
  updatedAt: string;
}

export interface PlanEvent {
  at: string;
  by: string;
  note: string;
}

export interface ExecutionPlan {
  id: string;
  title: string;
  localityNames: string[];
  startDate: string;
  endDate: string;
  objective: string;
  status: PlanStatus;
  leadOfficer: string;
  peakLevel: RiskLevel;
  basis: string;
  tasks: PlanTask[];
  history: PlanEvent[];
  revision: number;
  updatedAt: string;
}

export interface PlanSeed {
  title: string;
  startDate: string;
  endDate: string;
  localityNames: string[];
  peakLevel: RiskLevel;
  basis: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  localityName: string;
  language: Language;
  kind: 'RESIDENT' | 'WARD_OFFICER' | 'HOSPITAL';
  sample: boolean;
  ownerUsername: string;
}

export interface TelemetryCall {
  id: string;
  contactId: string;
  name: string;
  phoneMasked: string;
  localityName: string;
  language: Language;
  channel: Channel;
  state: CallState;
  script: string;
  planId: string;
  planTitle: string;
  attempts: number;
  durationSec: number;
  queuedAt: string;
  updatedAt: string;
}

const PLANS = 'floodguard.plans.v1';
const CONTACTS = 'floodguard.contacts.v1';
const CALLS = 'floodguard.calls.v1';
const BUS = 'floodguard-ops';

/** Pilot wards. Rainfall is one Pune grid; scores differ by local exposure. */
export const PUNE_WARDS: Place[] = [
  { key: 'pune-dhayari', name: 'Dhayari / Khadakwasla outlet', latitude: 18.442, longitude: 73.812, elevationM: 590, vulnerability: 74, weatherKey: 'pune' },
  { key: 'pune-sinhagad', name: 'Sinhagad Road / Vadgaon', latitude: 18.456, longitude: 73.816, elevationM: 580, vulnerability: 76, weatherKey: 'pune' },
  { key: 'pune-hadapsar', name: 'Hadapsar / Magarpatta', latitude: 18.501, longitude: 73.925, elevationM: 555, vulnerability: 72, weatherKey: 'pune' },
  { key: 'pune-pcmc', name: 'Pimpri-Chinchwad / Sangvi', latitude: 18.629, longitude: 73.8, elevationM: 560, vulnerability: 70, weatherKey: 'pune' },
  { key: 'pune-yerawada', name: 'Yerawada', latitude: 18.553, longitude: 73.887, elevationM: 555, vulnerability: 64, weatherKey: 'pune' },
  { key: 'pune-camp', name: 'Camp / Pune Station', latitude: 18.513, longitude: 73.878, elevationM: 560, vulnerability: 61, weatherKey: 'pune' },
  { key: 'pune-deccan', name: 'Deccan / JM Road', latitude: 18.519, longitude: 73.841, elevationM: 570, vulnerability: 58, weatherKey: 'pune' },
  { key: 'pune-shivaji', name: 'Shivajinagar', latitude: 18.531, longitude: 73.844, elevationM: 560, vulnerability: 55, weatherKey: 'pune' },
  { key: 'pune-katraj', name: 'Katraj', latitude: 18.452, longitude: 73.864, elevationM: 600, vulnerability: 50, weatherKey: 'pune' },
  { key: 'pune-kothrud', name: 'Kothrud', latitude: 18.507, longitude: 73.807, elevationM: 575, vulnerability: 48, weatherKey: 'pune' },
  { key: 'pune-koregaon', name: 'Koregaon Park', latitude: 18.536, longitude: 73.893, elevationM: 560, vulnerability: 44, weatherKey: 'pune' },
  { key: 'pune-baner', name: 'Baner', latitude: 18.559, longitude: 73.787, elevationM: 590, vulnerability: 36, weatherKey: 'pune' },
];

const NATIONAL_VULN: Record<string, number> = {
  'Mumbai (Mithi Basin - Kurla/Kalina)': 88,
  'Chennai (Adyar Basin - Saidapet/Velachery)': 84,
  'Srinagar (Jhelum Basin - Rajbagh)': 62,
  'Kedarnath (Mandakini River Valley)': 80,
  'Kullu & Manali (Beas River Basin)': 86,
  'Chungthang & Singtam (Teesta River Basin)': 89,
  'Rishikesh & Chamoli (Alaknanda Basin)': 82,
  'Cherrapunji & Mawsynram (Wah Umngot Basin)': 81,
  'Pasighat (Siang River Basin)': 77,
  'Kochi & Aluva (Periyar Basin)': 78,
  'Wayanad (Chooralmala / Meppadi)': 83,
  'Patna (Rajendra Nagar / Ganga Basin)': 86,
  'Guwahati (Brahmaputra / Bharalu Basin)': 90,
  'Surat (Tapi Basin - Adajan)': 70,
  'Vijayawada (Budameru & Krishna Basin)': 76,
  'Delhi (Yamuna Floodplain - Kashmere Gate)': 74,
  'Hyderabad (Musi Basin - Falaknuma)': 68,
  'Bengaluru (Bellandur Lake Basin)': 60,
  'Kolkata (Hooghly Basin - Kalighat)': 85,
  'Cuttack & Bhubaneswar (Mahanadi Basin)': 77,
  'Gorakhpur (Rapti & Rohini Basin)': 82,
  'Barmer (Luni River Basin - Kawas)': 34,
  'Agartala (Howrah Basin)': 72,
  'Pune (Mutha Basin - Deccan / Sinhagad Rd)': 66,
  'Ahmedabad (Sabarmati Basin)': 58,
};

export const ALL_OPERATIONAL_LOCALITIES: string[] = [
  ...Object.keys(NATIONAL_VULN),
  ...PUNE_WARDS.map((p) => p.name).filter((n) => !Object.keys(NATIONAL_VULN).includes(n)),
];

export function placeFromRisk(r: Risk): Place {
  return {
    key: `city-${r.id}`,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    elevationM: r.elevationM,
    vulnerability: NATIONAL_VULN[r.name] ?? 55,
    weatherKey: `city-${r.id}`,
  };
}

export function uid(): string {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function todayISO(): string {
  const n = new Date();
  const local = new Date(n.getTime() - n.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function band(score: number): RiskLevel {
  if (score >= 68) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  return 'LOW';
}

export function scoreDay(vulnerability: number, rainMm: number, rain72: number, pop: number): number {
  const rainIdx = Math.min(100, rainMm * 3.2 + rain72 * 0.4);
  const popBump = pop >= 60 ? Math.min(10, (pop - 60) / 6) : 0;
  const raw = vulnerability * 0.34 + rainIdx * 0.66 + popBump * (0.35 + vulnerability / 280);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function fallbackRain(seed: string, start = todayISO()): DayRain[] {
  const days: DayRain[] = [];
  for (let i = 0; i < 30; i++) {
    const h = hash(`${seed}:${i}`);
    const pulse = (i >= 8 && i <= 12) || (i >= 20 && i <= 23);
    const rain = pulse ? 16 + (h % 36) : h % 8;
    days.push({
      date: addDays(start, i),
      rainMm: Math.round(rain * 10) / 10,
      pop: Math.min(92, Math.round(rain * 2.1)),
      source: 'fallback',
    });
  }
  return days;
}

export function extendRain(days: DayRain[]): DayRain[] {
  if (days.length === 0) return fallbackRain('empty');
  const out: DayRain[] = days.slice(0, 16).map((d) => ({ ...d, source: d.source === 'fallback' ? 'fallback' : 'open-meteo' }));
  const last = out[out.length - 1].date;
  const week = out.slice(-7);
  const need = 30 - out.length;
  for (let i = 1; i <= need; i++) {
    const src = week[(i - 1) % week.length];
    const damp = Math.pow(0.88, i);
    out.push({
      date: addDays(last, i),
      rainMm: Math.round(src.rainMm * damp * 10) / 10,
      pop: Math.round(src.pop * damp),
      source: 'extended',
    });
  }
  return out.slice(0, 30);
}

export async function fetchDaily(lat: number, lon: number): Promise<DayRain[] | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&daily=precipitation_sum,precipitation_probability_max&forecast_days=16&timezone=Asia%2FKolkata`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const j = await res.json() as { daily?: { time?: string[]; precipitation_sum?: Array<number | null>; precipitation_probability_max?: Array<number | null> } };
    const time = j.daily?.time ?? [];
    if (time.length === 0) return null;
    return time.map((date, i) => ({
      date,
      rainMm: Number(j.daily?.precipitation_sum?.[i] ?? 0),
      pop: Number(j.daily?.precipitation_probability_max?.[i] ?? 0),
      source: 'open-meteo' as const,
    }));
  } catch {
    return null;
  }
}

export async function loadRain(places: Place[]): Promise<{ rain: Map<string, DayRain[]>; live: boolean }> {
  const anchors = new Map<string, Place>();
  for (const p of places) if (!anchors.has(p.weatherKey)) anchors.set(p.weatherKey, p);
  const rain = new Map<string, DayRain[]>();
  let live = false;
  await Promise.all([...anchors.entries()].map(async ([key, place]) => {
    const got = await fetchDaily(place.latitude, place.longitude);
    if (got && got.length > 0) {
      live = true;
      rain.set(key, extendRain(got));
    } else {
      rain.set(key, fallbackRain(key));
    }
  }));
  return { rain, live };
}

export function applyRain(places: Place[], rain: Map<string, DayRain[]>, drill: number): Series[] {
  const factor = Math.max(0, drill);
  return places.map((place) => {
    const raw = rain.get(place.weatherKey) ?? fallbackRain(place.weatherKey);
    const scaled = raw.map((d) => ({ ...d, rainMm: Math.round(d.rainMm * factor * 10) / 10 }));
    const days: ScoredDay[] = scaled.map((d, i) => {
      const rain72 = scaled.slice(Math.max(0, i - 2), i + 1).reduce((s, x) => s + x.rainMm, 0);
      const score = scoreDay(place.vulnerability, d.rainMm, Math.round(rain72 * 10) / 10, d.pop);
      return { ...d, rain72: Math.round(rain72 * 10) / 10, score, level: band(score) };
    });
    return { place, days };
  });
}

export function actionWindows(series: Series[]): ActionWindow[] {
  if (series.length === 0) return [];
  const dates = series[0].days.map((d) => d.date);
  const flags = dates.map((date) => {
    const rows = series.map((s) => s.days.find((d) => d.date === date)!).filter(Boolean);
    const high = rows.filter((d) => d.level === 'HIGH');
    const elevated = rows.filter((d) => d.level !== 'LOW');
    const active = high.length > 0 || elevated.length >= Math.min(4, Math.ceil(series.length / 3));
    const peak = rows.reduce((m, d) => Math.max(m, d.score), 0);
    const level: RiskLevel = high.length > 0 ? 'HIGH' : 'MODERATE';
    const localities = (high.length > 0 ? high : elevated).map((d) => {
      const owner = series.find((s) => s.days.includes(d));
      return owner?.place.name ?? '';
    }).filter(Boolean);
    return { active, peak, level, localities: [...new Set(localities)] };
  });
  const windows: ActionWindow[] = [];
  let open: ActionWindow | null = null;
  flags.forEach((f, i) => {
    if (!f.active) { open = null; return; }
    if (!open) {
      open = { start: dates[i], end: dates[i], peak: f.peak, level: f.level, localities: f.localities };
      windows.push(open);
    } else {
      open.end = dates[i];
      open.peak = Math.max(open.peak, f.peak);
      if (f.level === 'HIGH') open.level = 'HIGH';
      open.localities = [...new Set([...open.localities, ...f.localities])].slice(0, 8);
    }
  });
  return windows;
}

export function basisLabel(drill: number, live: boolean): string {
  const rain = live
    ? 'Open-Meteo daily forecast for 16 days, then a damped 14-day planning extension'
    : 'Standby rainfall pattern (live forecast unreachable)';
  const drillNote = drill === 1 ? 'recorded rainfall' : `planning drill ×${drill}`;
  return `${rain}; ${drillNote}. Geographic exposure is held constant.`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) as T : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(BUS));
}

export function useStored<T>(load: () => T): T {
  const [value, setValue] = useState(load);
  useEffect(() => {
    const sync = () => setValue(load());
    window.addEventListener(BUS, sync);
    return () => window.removeEventListener(BUS, sync);
  }, [load]);
  return value;
}

export function loadPlans(): ExecutionPlan[] {
  return read<ExecutionPlan[]>(PLANS, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function savePlans(plans: ExecutionPlan[]) {
  write(PLANS, plans);
}

export function upsertPlan(plan: ExecutionPlan) {
  const rest = loadPlans().filter((p) => p.id !== plan.id);
  savePlans([plan, ...rest]);
}

export function deletePlan(id: string) {
  savePlans(loadPlans().filter((p) => p.id !== id));
}

export function defaultTasks(officer: string): PlanTask[] {
  const now = new Date().toISOString();
  const mk = (title: string, phase: TaskPhase, owner: string): PlanTask => ({
    id: uid(), title, phase, owner, status: 'PENDING', notes: '', updatedAt: now,
  });
  return [
    mk('Inspect drains and stormwater outfalls in the listed localities', 'PREPARE', officer),
    mk('Pre-position boats, pumps, and rescue teams', 'PREPARE', officer),
    mk('Confirm shelter capacity, drinking water, and medical stocks', 'PREPARE', 'Shelter desk'),
    mk('Alert hospital emergency desks and hold ambulances', 'PREPARE', 'Medical desk'),
    mk('Inform registered locals by telephone IVR and SMS', 'RESPOND', 'Telemetry desk'),
    mk('Open shelters and publish road diversions if risk stays high', 'RESPOND', officer),
    mk('Reopen cleared roads and send the all-clear call', 'RECOVER', officer),
  ];
}

export function createPlan(seed: PlanSeed, officer: string): ExecutionPlan {
  const now = new Date().toISOString();
  const plan: ExecutionPlan = {
    id: uid(),
    title: seed.title,
    localityNames: seed.localityNames,
    startDate: seed.startDate,
    endDate: seed.endDate,
    objective: `Execute preparedness and response for ${seed.localityNames.slice(0, 3).join(', ')}${seed.localityNames.length > 3 ? ' and other listed localities' : ''} from ${seed.startDate} to ${seed.endDate}.`,
    status: 'DRAFT',
    leadOfficer: officer,
    peakLevel: seed.peakLevel,
    basis: seed.basis,
    tasks: defaultTasks(officer),
    history: [{ at: now, by: officer, note: 'Draft opened from the 30-day outlook.' }],
    revision: 1,
    updatedAt: now,
  };
  upsertPlan(plan);
  return plan;
}

export function blankPlan(officer: string, localities: string[]): ExecutionPlan {
  const start = todayISO();
  return createPlan({
    title: `Execution plan ${start}`,
    startDate: start,
    endDate: addDays(start, 6),
    localityNames: localities.slice(0, 3),
    peakLevel: 'MODERATE',
    basis: 'Officer-defined window.',
  }, officer);
}

export function commitPlan(plan: ExecutionPlan, officer: string, note: string): ExecutionPlan {
  const now = new Date().toISOString();
  const next: ExecutionPlan = {
    ...plan,
    revision: plan.revision + 1,
    updatedAt: now,
    history: [{ at: now, by: officer, note }, ...plan.history].slice(0, 40),
  };
  upsertPlan(next);
  return next;
}

export function loadContacts(): Contact[] {
  return read<Contact[]>(CONTACTS, []);
}

export function saveContacts(contacts: Contact[]) {
  write(CONTACTS, contacts);
}

const SAMPLE: Omit<Contact, 'id'>[] = [
  { name: 'Anita Jadhav', phone: '9000000011', localityName: 'Sinhagad Road / Vadgaon', language: 'mr', kind: 'RESIDENT', sample: true, ownerUsername: '' },
  { name: 'Rahul Deshmukh', phone: '9000000012', localityName: 'Dhayari / Khadakwasla outlet', language: 'mr', kind: 'RESIDENT', sample: true, ownerUsername: '' },
  { name: 'Suresh Pawar', phone: '9000000013', localityName: 'Hadapsar / Magarpatta', language: 'hi', kind: 'RESIDENT', sample: true, ownerUsername: '' },
  { name: 'Meera Kulkarni', phone: '9000000014', localityName: 'Pimpri-Chinchwad / Sangvi', language: 'mr', kind: 'RESIDENT', sample: true, ownerUsername: '' },
  { name: 'Ward officer, Yerawada', phone: '9000000021', localityName: 'Yerawada', language: 'en', kind: 'WARD_OFFICER', sample: true, ownerUsername: '' },
  { name: 'Sassoon casualty desk', phone: '9000000031', localityName: 'Camp / Pune Station', language: 'en', kind: 'HOSPITAL', sample: true, ownerUsername: '' },
];

export function ensureSampleContacts(): Contact[] {
  const cur = loadContacts();
  if (cur.some((c) => c.sample)) return cur;
  const seeded = [...SAMPLE.map((c) => ({ ...c, id: uid() })), ...cur];
  saveContacts(seeded);
  return seeded;
}

export function upsertContact(contact: Contact) {
  const cur = loadContacts().filter((c) => c.id !== contact.id && c.phone !== contact.phone);
  saveContacts([contact, ...cur]);
}

export function removeContact(id: string) {
  saveContacts(loadContacts().filter((c) => c.id !== id));
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').slice(-10);
  if (d.length < 10) return '•••';
  return `+91 ${d.slice(0, 2)}••••${d.slice(-2)}`;
}

function actionLine(level: RiskLevel, language: Language): string {
  const lines: Record<Language, Record<RiskLevel, string>> = {
    en: {
      HIGH: 'Move to higher ground or the notified shelter. Avoid underpasses.',
      MODERATE: 'Avoid waterlogged roads and keep documents dry.',
      LOW: 'No movement order. Keep this phone reachable.',
    },
    hi: {
      HIGH: 'ऊंची जगह या सूचित शरणस्थल पर जाएँ। सबवे से बचें।',
      MODERATE: 'जलभराव वाली सड़कों से बचें और दस्तावेज़ सूखे रखें।',
      LOW: 'अभी स्थानांतरण की जरूरत नहीं है। यह फ़ोन चालू रखें।',
    },
    mr: {
      HIGH: 'उंच जागेवर किंवा सूचित निवारागृहात जा. भुयारी मार्ग टाळा.',
      MODERATE: 'पाणी साचलेले रस्ते टाळा आणि कागदपत्रे कोरडी ठेवा.',
      LOW: 'हलण्याची सूचना नाही. हा फोन उपलब्ध ठेवा.',
    },
  };
  return lines[language][level];
}

const LEVEL_WORD: Record<Language, Record<RiskLevel, string>> = {
  en: { HIGH: 'HIGH', MODERATE: 'MODERATE', LOW: 'LOW' },
  hi: { HIGH: 'उच्च', MODERATE: 'मध्यम', LOW: 'कम' },
  mr: { HIGH: 'उच्च', MODERATE: 'मध्यम', LOW: 'कमी' },
};

export function alertScript(language: Language, locality: string, level: RiskLevel, start: string, end: string): string {
  const word = LEVEL_WORD[language][level];
  const action = actionLine(level, language);
  if (language === 'hi') {
    return `FloodGuard चेतावनी। ${locality} में ${start} से ${end} तक बाढ़ जोखिम ${word} है। ${action} आपात स्थिति में 112 डायल करें।`;
  }
  if (language === 'mr') {
    return `FloodGuard सूचना। ${locality} भागात ${start} ते ${end} दरम्यान पूरधोका ${word} आहे। ${action} आणीबाणीसाठी 112 वापरा।`;
  }
  return `FloodGuard alert for ${locality}. Flood risk is ${word} from ${start} to ${end}. ${action} Emergencies: call 112.`;
}

export function queueAlerts(plan: ExecutionPlan, contacts: Contact[], channels: Channel[]): { queued: number; skipped: number } {
  const targets = contacts.filter((c) => plan.localityNames.includes(c.localityName));
  const existing = loadCalls();
  const fresh: TelemetryCall[] = [];
  const now = new Date().toISOString();
  let skipped = 0;
  for (const contact of targets) {
    for (const channel of channels) {
      const recent = existing.some((call) => call.contactId === contact.id && call.planId === plan.id && call.channel === channel && ['QUEUED', 'DIALING', 'ANSWERED'].includes(call.state));
      if (recent) { skipped++; continue; }
      fresh.push({
        id: uid(),
        contactId: contact.id,
        name: contact.name,
        phoneMasked: maskPhone(contact.phone),
        localityName: contact.localityName,
        language: contact.language,
        channel,
        state: 'QUEUED',
        script: alertScript(contact.language, contact.localityName, plan.peakLevel, plan.startDate, plan.endDate),
        planId: plan.id,
        planTitle: plan.title,
        attempts: 1,
        durationSec: 0,
        queuedAt: now,
        updatedAt: now,
      });
    }
  }
  if (fresh.length) saveCalls([...fresh, ...existing].slice(0, 300));
  return { queued: fresh.length, skipped };
}

export function loadCalls(): TelemetryCall[] {
  return read<TelemetryCall[]>(CALLS, []);
}

export function saveCalls(calls: TelemetryCall[]) {
  write(CALLS, calls.slice(0, 300));
}

function outcomeFor(id: string): CallState {
  const n = hash(id) % 10;
  if (n < 7) return 'ANSWERED';
  if (n < 9) return 'NO_ANSWER';
  return 'FAILED';
}

/** Move a few queued or dialing calls forward. Delivery states are simulated until a carrier gateway is connected. */
export function advanceCalls(calls: TelemetryCall[], now = Date.now()): TelemetryCall[] {
  let stepped = 0;
  return calls.map((call) => {
    if (stepped >= 4) return call;
    if (call.state !== 'QUEUED' && call.state !== 'DIALING') return call;
    const age = now - Date.parse(call.updatedAt);
    if (call.state === 'QUEUED' && age >= 700) {
      stepped++;
      return { ...call, state: 'DIALING' as const, updatedAt: new Date(now).toISOString() };
    }
    if (call.state === 'DIALING' && age >= 1400) {
      stepped++;
      const state = outcomeFor(call.id + call.attempts);
      return {
        ...call,
        state,
        durationSec: state === 'ANSWERED' ? 8 + (hash(call.id) % 28) : 0,
        updatedAt: new Date(now).toISOString(),
      };
    }
    return call;
  });
}

export function patchCall(id: string, patch: Partial<TelemetryCall>) {
  const now = new Date().toISOString();
  saveCalls(loadCalls().map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now } : c)));
}

export function redialCall(id: string) {
  const cur = loadCalls().find((c) => c.id === id);
  if (!cur) return;
  patchCall(id, { state: 'QUEUED', attempts: cur.attempts + 1, durationSec: 0 });
}

export function callsChanged(a: TelemetryCall[], b: TelemetryCall[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((call, i) => call.state !== b[i].state || call.updatedAt !== b[i].updatedAt);
}
