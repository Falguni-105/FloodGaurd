import { useState, useEffect, useMemo, useRef } from 'react';
import { PUNE_WARDS } from './ops';
import { playClick, playSonar, playSiren } from './sound';
import {
  SearchIcon, NavigationIcon, ShieldAlert, CalendarIcon,
  PhoneCallIcon, FileTextIcon, ActivityIcon, SirenIcon, Volume2Icon
} from './icons';

interface CommandItem {
  id: string;
  title: string;
  category: 'Hotspots' | 'Actions' | 'Navigation';
  icon: React.ReactNode;
  hint?: string;
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onFocusMap,
  toggleSound,
}: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'map' | 'outlook' | 'report' | 'control' | 'execute' | 'alerts') => void;
  onFocusMap: (point: [number, number]) => void;
  toggleSound: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigation & Actions
      {
        id: 'nav-map',
        title: 'Open Live Risk Geospatial Map',
        category: 'Navigation',
        hint: 'View national hotspots & blocked arteries',
        icon: <NavigationIcon size={14} style={{ color: 'var(--sky)' }} />,
        action: () => {
          onNavigate('map');
          onClose();
        },
      },
      {
        id: 'nav-outlook',
        title: 'Inspect 30-Day Predictive Outlook',
        category: 'Navigation',
        hint: 'Run monsoon stress tests & 30-day hydro model',
        icon: <CalendarIcon size={14} style={{ color: '#fbbf24' }} />,
        action: () => {
          onNavigate('outlook');
          onClose();
        },
      },
      {
        id: 'nav-report',
        title: 'Transmit Citizen Emergency SOS Report',
        category: 'Navigation',
        hint: 'Submit waterlogging & trapped citizen alerts',
        icon: <ShieldAlert size={14} style={{ color: '#f43f5e' }} />,
        action: () => {
          onNavigate('report');
          onClose();
        },
      },
      {
        id: 'nav-alerts',
        title: 'Telephone Desk & Voice IVR Synthesizer',
        category: 'Navigation',
        hint: 'Automated citizen blast & delivery queue',
        icon: <PhoneCallIcon size={14} style={{ color: '#34d399' }} />,
        action: () => {
          onNavigate('alerts');
          onClose();
        },
      },
      {
        id: 'nav-control',
        title: 'Command Control Room & Route Dispatch',
        category: 'Navigation',
        hint: 'Active dispatch matrix & resource balancing',
        icon: <ActivityIcon size={14} style={{ color: '#34d399' }} />,
        action: () => {
          onNavigate('control');
          onClose();
        },
      },
      {
        id: 'nav-execute',
        title: 'Disaster Evacuation Execution Plans',
        category: 'Navigation',
        hint: 'NDMA statutory directives & ward tasking',
        icon: <FileTextIcon size={14} style={{ color: '#a855f7' }} />,
        action: () => {
          onNavigate('execute');
          onClose();
        },
      },
      {
        id: 'action-siren',
        title: 'Trigger 6-Second Emergency Warning Siren',
        category: 'Actions',
        hint: 'Civil defense acoustic test sweep',
        icon: <SirenIcon size={14} style={{ color: '#f87171' }} />,
        action: () => {
          playSiren();
          onClose();
        },
      },
      {
        id: 'action-sound',
        title: 'Toggle Tactical Sound Audio FX',
        category: 'Actions',
        hint: 'Turn feedback audio on/off',
        icon: <Volume2Icon size={14} style={{ color: 'var(--sky)' }} />,
        action: () => {
          toggleSound();
          onClose();
        },
      },
    ];

    // Localities / Wards
    PUNE_WARDS.forEach((w) => {
      list.push({
        id: `ward-${w.key}`,
        title: `${w.name} (Pune Basin)`,
        category: 'Hotspots',
        hint: `Elevation: ${w.elevationM}m · Susceptibility: ${w.vulnerability}/100`,
        icon: <NavigationIcon size={14} style={{ color: 'var(--sky)' }} />,
        action: () => {
          playSonar();
          onNavigate('map');
          onFocusMap([w.latitude, w.longitude]);
          onClose();
        },
      });
    });

    // National Basins & Mountain Disasters
    const nationalList: [string, [number, number]][] = [
      ['Mumbai (Mithi River Basin - Kurla/Kalina)', [19.07, 72.87]],
      ['Chennai (Adyar Basin - Saidapet/Velachery)', [13.01, 80.22]],
      ['Srinagar (Jhelum Basin - Rajbagh)', [34.07, 74.81]],
      ['Kedarnath (Mandakini River Valley)', [30.73, 79.06]],
      ['Kullu & Manali (Beas River Basin - HP)', [31.96, 77.11]],
      ['Chungthang & Singtam (Teesta GLOF Basin - Sikkim)', [27.60, 88.65]],
      ['Rishikesh & Chamoli (Alaknanda Basin - UK)', [30.38, 79.33]],
      ['Cherrapunji & Mawsynram (Khasi Hills - Meghalaya)', [25.30, 91.73]],
      ['Pasighat (Siang River Basin - Arunachal)', [28.07, 95.33]],
      ['Kochi & Aluva (Periyar Basin)', [10.11, 76.35]],
      ['Wayanad (Chooralmala / Meppadi)', [11.55, 76.13]],
      ['Patna (Rajendra Nagar / Ganga Basin)', [25.60, 85.15]],
      ['Guwahati (Brahmaputra / Bharalu Basin)', [26.14, 91.73]],
    ];

    nationalList.forEach(([name, coords]) => {
      list.push({
        id: `nat-${name}`,
        title: `${name}`,
        category: 'Hotspots',
        hint: 'National High-Risk Flood Disaster Zone',
        icon: <ShieldAlert size={14} style={{ color: '#f87171' }} />,
        action: () => {
          playSonar();
          onNavigate('map');
          onFocusMap(coords);
          onClose();
        },
      });
    });

    return list;
  }, [onNavigate, onFocusMap, onClose, toggleSound]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10);
    const q = query.toLowerCase();
    return items.filter((i) => i.title.toLowerCase().includes(q) || (i.hint && i.hint.toLowerCase().includes(q)));
  }, [items, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((cur) => (cur + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((cur) => (cur - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        playClick();
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'rgba(3, 7, 18, 0.75)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'fadeInDown 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'rgba(9, 20, 15, 0.85)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: '1px solid rgba(52, 211, 153, 0.35)',
          borderRadius: 16,
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.14), 0 0 30px rgba(16, 185, 129, 0.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* COMMAND SEARCH INPUT */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--line)',
        }}>
          <SearchIcon size={18} style={{ color: 'var(--sky)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search hotspots, jump to basin, trigger siren, or run command... (↑↓ to select, ↵ to run)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: '#fff',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
          <span style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'var(--ink-secondary)',
          }}>
            ESC
          </span>
        </div>

        {/* COMMAND RESULTS LIST */}
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={() => {
                  playClick();
                  item.action();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 18px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? '#34d399' : 'transparent'}`,
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: isSelected ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#fff' : 'var(--ink)' }}>
                      {item.title}
                    </div>
                    {item.hint && (
                      <div style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>
                        {item.hint}
                      </div>
                    )}
                  </div>
                </div>

                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: isSelected ? '#34d399' : 'var(--ink-dim)',
                  textTransform: 'uppercase',
                }}>
                  {item.category}
                </span>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--ink-secondary)', fontSize: 13 }}>
              No commands or hotspots match "{query}".
            </div>
          )}
        </div>

        {/* PALETTE FOOTER */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 18px',
          background: 'rgba(8, 14, 25, 0.8)',
          borderTop: '1px solid var(--line)',
          fontSize: 11,
          color: 'var(--ink-secondary)',
        }}>
          <span>Tactical Quick Jump · Press <b>Ctrl + K</b> anywhere</span>
          <span><b>↑↓</b> to navigate · <b>↵</b> to execute</span>
        </div>
      </div>
    </div>
  );
}

