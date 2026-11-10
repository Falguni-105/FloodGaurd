import { useEffect, useMemo, useState } from 'react';
import type { User } from './types';
import {
  PUNE_WARDS, advanceCalls, callsChanged, ensureSampleContacts, loadCalls, loadContacts,
  maskPhone, patchCall, redialCall, removeContact, saveCalls, uid, upsertContact, useStored,
  type Language,
} from './ops';
import { playClick, playSonar, playSuccess, speakScript, stopSpeech, isSpeaking } from './sound';
import {
  PhoneCallIcon, PlayIcon, StopIcon, RadioIcon, PlusIcon,
  TrashIcon, CheckCircleIcon, RefreshCwIcon, UserIcon
} from './icons';

export default function Telemetry({ user }: { user: User }) {
  const authority = user.role === 'AUTHORITY' || user.role === 'ADMIN';
  const contacts = useStored(loadContacts);
  const calls = useStored(loadCalls);
  const [msg, setMsg] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: user.fullName,
    phone: '',
    localityName: PUNE_WARDS[0].name,
    language: 'mr' as Language,
  });

  useEffect(() => {
    if (authority) ensureSampleContacts();
  }, [authority]);

  // Simulate automated carrier dialing cycle every 700ms
  useEffect(() => {
    const timer = setInterval(() => {
      const cur = loadCalls();
      const next = advanceCalls(cur);
      if (callsChanged(cur, next)) saveCalls(next);
    }, 700);
    return () => clearInterval(timer);
  }, []);

  const visibleCalls = authority
    ? calls
    : calls.filter((c) => {
        const mine = contacts.filter((contact) => contact.ownerUsername === user.username).map((contact) => contact.id);
        return mine.includes(c.contactId);
      });
  const book = authority ? contacts : contacts.filter((c) => c.ownerUsername === user.username);

  const counts = useMemo(
    () => ({
      queued: visibleCalls.filter((c) => c.state === 'QUEUED' || c.state === 'DIALING').length,
      answered: visibleCalls.filter((c) => c.state === 'ANSWERED').length,
      ack: visibleCalls.filter((c) => c.state === 'ACKNOWLEDGED').length,
      failed: visibleCalls.filter((c) => c.state === 'FAILED' || c.state === 'NO_ANSWER').length,
    }),
    [visibleCalls]
  );

  const register = (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    const phone = form.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setMsg('Enter a 10-digit mobile number starting with 6–9.');
      return;
    }
    upsertContact({
      id: uid(),
      name: form.name.trim(),
      phone,
      localityName: form.localityName,
      language: form.language,
      kind: 'RESIDENT',
      sample: false,
      ownerUsername: user.username,
    });
    setForm({ ...form, phone: '' });
    playSuccess();
    setMsg(`Registered ${maskPhone(phone)} for ${form.localityName}. Alerts trigger automatically when an evacuation plan is approved.`);
  };

  const handlePlayAudio = (callId: string, scriptText: string, lang: Language) => {
    if (speakingId === callId && isSpeaking()) {
      stopSpeech();
      setSpeakingId(null);
    } else {
      playClick();
      setSpeakingId(callId);
      speakScript(
        scriptText,
        lang,
        () => setSpeakingId(callId),
        () => setSpeakingId(null)
      );
    }
  };

  return (
    <div className="stack">
      {/* TELEMETRY OVERVIEW HERO */}
      <section className="card">
        <div className="card-header-bar">
          <h3>
            <RadioIcon size={18} style={{ color: 'var(--sky)' }} />
            Automated Telephony & Voice IVR Broadcast Desk
          </h3>
          <span className="status-badge-live">
            <span className="status-beacon" />
            TELEMETRY DISPATCH ACTIVE
          </span>
        </div>

        <div className="banner">
          <PhoneCallIcon size={18} style={{ color: 'var(--sky)', flexShrink: 0, marginTop: 2 }} />
          <div>
            Automated multilingual Voice IVR and SMS broadcast pipelines. Delivery states simulate automated carrier handshakes, ring detection, and resident touch-tone acknowledgments. You can click <b>"Play Voice IVR"</b> on any row to hear the AI synthesized voice alert!
          </div>
        </div>

        {msg && <div className="ok">{msg}</div>}

        {/* METRICS TILES */}
        <div className="kpis">
          <div className="kpi">
            <b>{counts.queued}</b>
            <span>Queued or Dialing</span>
          </div>
          <div className="kpi safe">
            <b>{counts.answered}</b>
            <span>Answered / In-Call</span>
          </div>
          <div className="kpi safe">
            <b>{counts.ack}</b>
            <span>Touch-Tone Confirmed</span>
          </div>
          <div className={`kpi ${counts.failed > 0 ? 'crit' : 'safe'}`}>
            <b>{counts.failed}</b>
            <span>No Answer / Failed</span>
          </div>
        </div>
      </section>

      {/* OPERATIONS WORKSPACE: CONTACT BOOK + DELIVERY LOG */}
      <div className="ops">
        {/* CONTACT REGISTRY */}
        <section className="card">
          <div className="card-header-bar">
            <h3>
              <UserIcon size={17} style={{ color: 'var(--sky)' }} />
              {authority ? 'Ward Contact Directory' : 'My Emergency Mobile'}
            </h3>
            <span className="muted">{book.length} registered</span>
          </div>

          <form onSubmit={register}>
            <label>
              Full Name
              <input
                value={form.name}
                maxLength={80}
                required
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Officer Kulkarni / Resident"
              />
            </label>
            <label>
              Mobile Number (10 Digits)
              <input
                inputMode="numeric"
                placeholder="98xxxxxxxx"
                value={form.phone}
                maxLength={14}
                required
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Assigned Locality
              <select value={form.localityName} onChange={(e) => setForm({ ...form, localityName: e.target.value })}>
                {PUNE_WARDS.map((p) => (
                  <option key={p.key}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              IVR Broadcast Language
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as Language })}>
                <option value="mr">मराठी (Marathi)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="en">English</option>
              </select>
            </label>
            <button className="primary" type="submit" style={{ width: '100%', marginTop: 8 }}>
              <PlusIcon size={14} />
              {authority ? 'Add Ward Number' : 'Register Alert Phone'}
            </button>
          </form>

          <h4 style={{ marginTop: 20 }}>Registered Subscribers</h4>
          <ul className="book">
            {book.map((c) => (
              <li key={c.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <b>{c.name}</b>
                  <span className="pill LOW" style={{ fontSize: 9 }}>{c.language.toUpperCase()}</span>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>
                  {maskPhone(c.phone)} · {c.localityName}
                  {c.sample ? ' · (sample)' : ''}
                </span>
                {authority && (
                  <button
                    type="button"
                    style={{ alignSelf: 'flex-start', padding: '2px 8px', fontSize: 11, marginTop: 4 }}
                    onClick={() => {
                      playClick();
                      removeContact(c.id);
                    }}
                  >
                    <TrashIcon size={12} /> Remove
                  </button>
                )}
              </li>
            ))}
            {book.length === 0 && <li className="muted">No numbers registered.</li>}
          </ul>
        </section>

        {/* REAL-TIME DELIVERY LOG */}
        <section className="card">
          <div className="card-header-bar">
            <h3>
              <PhoneCallIcon size={17} style={{ color: 'var(--sky)' }} />
              Automated Blast Delivery Queue
            </h3>
            <span className="muted">{visibleCalls.length} logs</span>
          </div>

          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Recipient</th>
                  <th>Channel</th>
                  <th>Call State</th>
                  <th>Evacuation Plan</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCalls.map((c) => {
                  const isPlayingThis = speakingId === c.id;
                  return (
                    <tr key={c.id} className={openId === c.id ? 'inaccessible' : ''}>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(c.queuedAt).toLocaleTimeString()}</div>
                        <span className="muted" style={{ fontSize: 10 }}>
                          Attempt {c.attempts} {c.durationSec ? `· ${c.durationSec}s` : ''}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {c.phoneMasked} · {c.localityName}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className={`pill ${c.channel === 'VOICE' ? 'APPROVED' : 'LOW'}`} style={{ fontSize: 9 }}>
                            {c.channel}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sky)' }}>{c.language.toUpperCase()}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {c.state === 'DIALING' && <span className="status-beacon" />}
                          <span className={`st-${c.state}`}>{c.state.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 220 }}>
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.planTitle}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          {/* Audio Player Button */}
                          <button
                            type="button"
                            className={isPlayingThis ? 'primary' : ''}
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => handlePlayAudio(c.id, c.script, c.language)}
                            title={isPlayingThis ? 'Stop voice broadcast' : 'Listen to AI Voice IVR Alert'}
                          >
                            {isPlayingThis ? (
                              <>
                                <StopIcon size={12} />
                                <span className="soundwave-box">
                                  <span className="soundwave-bar" />
                                  <span className="soundwave-bar" />
                                  <span className="soundwave-bar" />
                                </span>
                              </>
                            ) : (
                              <>
                                <PlayIcon size={12} />
                                Play IVR
                              </>
                            )}
                          </button>

                          {/* Script toggle */}
                          <button
                            type="button"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => {
                              playClick();
                              setOpenId(openId === c.id ? null : c.id);
                            }}
                          >
                            Text
                          </button>

                          {c.state === 'ANSWERED' && (
                            <button
                              type="button"
                              className="primary"
                              style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => {
                                playSuccess();
                                patchCall(c.id, { state: 'ACKNOWLEDGED' });
                              }}
                            >
                              <CheckCircleIcon size={12} /> Ack
                            </button>
                          )}

                          {(c.state === 'FAILED' || c.state === 'NO_ANSWER') && authority && (
                            <button
                              type="button"
                              style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => {
                                playSonar();
                                redialCall(c.id);
                              }}
                            >
                              <RefreshCwIcon size={12} /> Redial
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visibleCalls.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      No telephone alerts queued. Officers launch automated blasts from approved execution plans.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {openId && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sky)', marginBottom: 4 }}>
                📄 Broadcast Audio Script & SMS Content:
              </div>
              <pre className="script">{visibleCalls.find((c) => c.id === openId)?.script}</pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
