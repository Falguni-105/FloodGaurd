import { useState } from 'react';
import type { User } from './types';
import { loadUser, saveUser } from './api';
import AuthPanel from './AuthPanel';
import LiveMap from './LiveMap';
import Report from './Report';
import ControlRoom from './ControlRoom';

type Tab = 'map' | 'report' | 'control';

export default function App() {
  const [user, setUser] = useState<User | null>(loadUser());
  const [tab, setTab] = useState<Tab>('map');
  const isAuthority = user?.role === 'AUTHORITY' || user?.role === 'ADMIN';

  const setAndSave = (u: User | null) => { saveUser(u); setUser(u); if (!u) setTab('map'); };

  return (
    <div className="app">
      <header>
        <div className="brand"><span className="drop" />FLOODGUARD<small>Predict Early. Respond Faster. Save Lives.</small></div>
        <nav>
          <button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>Live Risk Map</button>
          {user && <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>Report Emergency</button>}
          {isAuthority && <button className={tab === 'control' ? 'on' : ''} onClick={() => setTab('control')}>Control Room</button>}
        </nav>
        <AuthPanel user={user} onChange={setAndSave} />
      </header>
      <main>
        {tab === 'map' && <LiveMap />}
        {tab === 'report' && user && <Report user={user} />}
        {tab === 'control' && isAuthority && user && <ControlRoom user={user} />}
        {tab === 'map' && !user && <p className="hint">Sign in or register to report an emergency. Anyone can view the live map.</p>}
      </main>
      <footer>Decision-support tool. Predictions and routes must be validated against ground-truth data before operational use.</footer>
    </div>
  );
}
