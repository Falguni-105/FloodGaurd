import { useState, useEffect } from 'react';
import type { User } from './types';
import { loadUser, saveUser } from './api';
import { createPlan, type PlanSeed } from './ops';
import { isSoundEnabled, setSoundEnabled, playClick, playSiren } from './sound';
import AuthPanel from './AuthPanel';
import LiveMap from './LiveMap';
import Outlook from './Outlook';
import Report from './Report';
import ControlRoom from './ControlRoom';
import Execution from './Execution';
import Telemetry from './Telemetry';
import CommandPalette from './CommandPalette';
import {
  LayersIcon, CalendarIcon, ShieldAlert, PhoneCallIcon,
  FileTextIcon, ActivityIcon, Volume2Icon, VolumeXIcon, SirenIcon, SearchIcon
} from './icons';

type Tab = 'map' | 'outlook' | 'report' | 'control' | 'execute' | 'alerts';

export default function App() {
  const [user, setUser] = useState<User | null>(loadUser());
  const [tab, setTab] = useState<Tab>('map');
  const [focusPlan, setFocusPlan] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled());
  const [currentTime, setCurrentTime] = useState<string>('');
  const [cmdOpen, setCmdOpen] = useState<boolean>(false);
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);

  const isAuthority = user?.role === 'AUTHORITY' || user?.role === 'ADMIN';

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Live Military Clock ticker
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-GB', { hour12: false }) + ' IST');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (nextTab: Tab) => {
    playClick();
    setTab(nextTab);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playClick();
  };

  const handleSirenTest = () => {
    playSiren();
  };

  const setAndSave = (u: User | null) => {
    saveUser(u);
    setUser(u);
    if (!u && (tab === 'report' || tab === 'control' || tab === 'execute' || tab === 'alerts')) {
      setTab('map');
    }
  };

  const openPlan = (seed: PlanSeed) => {
    if (!user || !isAuthority) return;
    const plan = createPlan(seed, user.fullName);
    setFocusPlan(plan.id);
    setTab('execute');
  };

  return (
    <div className="app">
      {/* TOP COMMAND SITUATION TICKER */}
      <div className="command-ticker">
        <div className="left">
          <span className="status-badge-live">
            <span className="status-beacon" />
            OPERATIONAL LEVEL 2 · MONSOON SURVEILLANCE
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            🕒 <b style={{ color: '#fff' }}>{currentTime}</b>
          </span>
          <span className="muted" style={{ display: 'none' }}>CWC Basin Sync: LIVE</span>
        </div>

        <div className="right">
          <button
            type="button"
            className="sound-toggle-btn"
            onClick={() => {
              playClick();
              setCmdOpen(true);
            }}
            title="Quick Command & Basin Jump (Ctrl + K)"
            style={{ borderColor: 'rgba(52, 211, 153, 0.35)', color: '#34d399' }}
          >
            <SearchIcon size={12} />
            <span>COMMAND (CTRL+K)</span>
          </button>

          <button
            type="button"
            className="sound-toggle-btn"
            onClick={toggleSound}
            title={soundOn ? 'Sound alerts enabled' : 'Sound alerts muted'}
          >
            {soundOn ? <Volume2Icon size={13} style={{ color: '#34d399' }} /> : <VolumeXIcon size={13} />}
            <span>{soundOn ? 'AUDIO ACTIVE' : 'MUTED'}</span>
          </button>

          <button
            type="button"
            className="sound-toggle-btn"
            onClick={handleSirenTest}
            title="Trigger 6-second emergency warning siren test"
            style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <SirenIcon size={13} />
            <span>TEST SIREN</span>
          </button>

          <a href="tel:112" className="hotline-pill" title="National Emergency Helpline">
            <span>🚨 112 SOS HELPLINE</span>
          </a>
        </div>
      </div>

      {/* MAIN APPLICATION HEADER */}
      <header className="app-header">
        <div className="brand" onClick={() => handleTabChange('map')}>
          <div className="brand-symbol">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8c-2 2-3 4-3 5.5a3 3 0 0 0 6 0C15 12 14 10 12 8z" fill="rgba(255,255,255,0.4)" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-title">FLOODGUARD</span>
            <span className="brand-sub">Predict Early · Respond Faster · Save Lives</span>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <nav className="app-nav">
          <button
            type="button"
            className={tab === 'map' ? 'on' : ''}
            onClick={() => handleTabChange('map')}
          >
            <LayersIcon size={15} />
            Live Risk Map
          </button>

          <button
            type="button"
            className={tab === 'outlook' ? 'on' : ''}
            onClick={() => handleTabChange('outlook')}
          >
            <CalendarIcon size={15} />
            30-Day Outlook
            <span className="tab-badge">30D</span>
          </button>

          {user && (
            <button
              type="button"
              className={tab === 'report' ? 'on' : ''}
              onClick={() => handleTabChange('report')}
            >
              <ShieldAlert size={15} />
              Report SOS
            </button>
          )}

          {user && (
            <button
              type="button"
              className={tab === 'alerts' ? 'on' : ''}
              onClick={() => handleTabChange('alerts')}
            >
              <PhoneCallIcon size={15} />
              Telephone Alerts
              <span className="tab-badge">IVR</span>
            </button>
          )}

          {isAuthority && (
            <button
              type="button"
              className={tab === 'execute' ? 'on' : ''}
              onClick={() => handleTabChange('execute')}
            >
              <FileTextIcon size={15} />
              Execution Plans
            </button>
          )}

          {isAuthority && (
            <button
              type="button"
              className={tab === 'control' ? 'on' : ''}
              onClick={() => handleTabChange('control')}
            >
              <ActivityIcon size={15} />
              Control Room
              <span className="tab-badge" style={{ background: '#ef4444', color: '#fff' }}>LIVE</span>
            </button>
          )}
        </nav>

        {/* AUTHENTICATION & PROFILE */}
        <AuthPanel user={user} onChange={setAndSave} />
      </header>

      {/* MAIN VIEWPORT */}
      <main>
        {tab === 'map' && <LiveMap externalFocus={mapFocus} />}
        {tab === 'outlook' && <Outlook canPlan={isAuthority} onPlan={openPlan} />}
        {tab === 'report' && user && <Report user={user} />}
        {tab === 'alerts' && user && <Telemetry user={user} />}
        {tab === 'execute' && isAuthority && user && (
          <Execution user={user} focusId={focusPlan} onOpenDesk={() => setTab('alerts')} />
        )}
        {tab === 'control' && isAuthority && user && <ControlRoom user={user} />}

        {tab === 'map' && !user && (
          <p className="hint">
            💡 Sign in or create a Citizen account to report local waterlogging emergencies or subscribe to automated telephone warning calls. Live map and 30-day outlook remain publicly accessible to all citizens and responders.
          </p>
        )}
      </main>

      {/* QUICK COMMAND PALETTE (CTRL + K) */}
      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={(nextTab) => handleTabChange(nextTab)}
        onFocusMap={(point) => {
          setMapFocus(point);
          handleTabChange('map');
        }}
        toggleSound={toggleSound}
      />

      {/* FOOTER */}
      <footer>
        FLOODGUARD Geospatial Decision-Support Platform · Built in compliance with NDMA & IMD early warning guidelines · Ground-truth sensor telemetry & drone reconnaissance must validate critical evacuation routes prior to dispatch.
      </footer>
    </div>
  );
}
