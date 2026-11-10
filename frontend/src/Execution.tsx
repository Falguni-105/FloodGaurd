import { useEffect, useState } from 'react';
import type { User } from './types';
import {
  PUNE_WARDS, ALL_OPERATIONAL_LOCALITIES, blankPlan, commitPlan, deletePlan, ensureSampleContacts, loadContacts, loadPlans,
  queueAlerts, useStored,
  type Channel, type ExecutionPlan, type PlanStatus, type TaskPhase, type TaskStatus,
} from './ops';
import { playClick, playSonar, playSuccess } from './sound';
import {
  ShieldAlert, PlusIcon, TrashIcon, CheckCircleIcon, RadioIcon,
  PhoneCallIcon, FileTextIcon, ActivityIcon, ClockIcon, ChevronRightIcon
} from './icons';

const STATUSES: PlanStatus[] = ['DRAFT', 'APPROVED', 'ACTIVE', 'COMPLETED'];
const PHASES: TaskPhase[] = ['PREPARE', 'RESPOND', 'RECOVER'];
const TASKS: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'];

export default function Execution({
  user,
  focusId,
  onOpenDesk,
}: {
  user: User;
  focusId: string | null;
  onOpenDesk: () => void;
}) {
  const plans = useStored(loadPlans);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExecutionPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!focusId) return;
    const plan = loadPlans().find((p) => p.id === focusId);
    if (!plan) return;
    setSelected(plan.id);
    setDraft(structuredClone(plan));
    setDirty(false);
    setMsg('Draft loaded. Review operational tasks and advance state to APPROVED to enable telephone warnings.');
  }, [focusId]);

  const choose = (id: string) => {
    if (dirty && !window.confirm('Discard unsaved edits on this plan?')) return;
    playClick();
    const plan = plans.find((p) => p.id === id) ?? null;
    setSelected(id);
    setDraft(plan ? structuredClone(plan) : null);
    setDirty(false);
    setMsg('');
  };

  const edit = (patch: Partial<ExecutionPlan>) => {
    setDraft((cur) => (cur ? { ...cur, ...patch } : cur));
    setDirty(true);
  };

  const save = (note: string, patch: Partial<ExecutionPlan> = {}) => {
    if (!draft) return;
    playSuccess();
    const next = commitPlan({ ...draft, ...patch }, user.fullName, note);
    setDraft(next);
    setSelected(next.id);
    setDirty(false);
    setMsg(`Revision ${next.revision} committed to operational record.`);
  };

  const startBlank = () => {
    playClick();
    const plan = blankPlan(user.fullName, PUNE_WARDS.map((p) => p.name));
    setSelected(plan.id);
    setDraft(plan);
    setDirty(false);
    setMsg('Blank execution framework initialized.');
  };

  return (
    <div className="stack">
      {/* HEADER CARD */}
      <section className="card">
        <div className="card-header-bar">
          <div>
            <h3>
              <FileTextIcon size={18} style={{ color: 'var(--sky)' }} />
              Disaster Response & Evacuation Action Plans
            </h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Statutory disaster plans according to National Disaster Management Authority (NDMA) guidelines: phased tasking, lead officer accountability, and automated citizen warning triggers.
            </p>
          </div>
          <button type="button" className="primary" onClick={startBlank}>
            <PlusIcon size={14} />
            Initialize Blank Plan
          </button>
        </div>
        {msg && <div className="ok">{msg}</div>}
      </section>

      {/* OPERATIONS WORKSPACE: SIDEBAR PLANS + EDITOR */}
      <div className="ops">
        {/* PLANS DIRECTORY */}
        <aside className="card planlist">
          <div className="card-header-bar">
            <h3 style={{ fontSize: 14 }}>Active Registry</h3>
            <span className="muted">{plans.length} plans</span>
          </div>

          {plans.length === 0 && (
            <p className="muted" style={{ padding: 10 }}>
              No plans recorded. You can generate one from any 30-day action window or initialize a blank plan.
            </p>
          )}

          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`plan ${selected === p.id ? 'on' : ''}`}
              onClick={() => choose(p.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span className={`pill ${p.status}`}>{p.status}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                  Rev {p.revision}
                </span>
              </div>
              <b style={{ fontSize: 13, color: '#fff', marginTop: 2 }}>{p.title}</b>
              <span className="muted" style={{ fontSize: 11 }}>
                📅 {p.startDate} → {p.endDate}
              </span>
            </button>
          ))}
        </aside>

        {/* PLAN EDITOR */}
        <section className="card">
          {!draft && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-secondary)' }}>
              <FileTextIcon size={36} style={{ color: 'var(--line-strong)', marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>No Plan Selected</div>
              <p className="muted" style={{ maxWidth: 400, margin: '8px auto 0' }}>
                Select an operational plan from the left registry, or draft one from the 30-Day Predictive Outlook.
              </p>
            </div>
          )}

          {draft && (
            <PlanEditor
              draft={draft}
              dirty={dirty}
              officer={user.fullName}
              onEdit={edit}
              onSave={save}
              onDelete={() => {
                if (!window.confirm('Permanently delete this execution plan?')) return;
                playClick();
                deletePlan(draft.id);
                setDraft(null);
                setSelected(null);
                setDirty(false);
                setMsg('Plan deleted.');
              }}
              onOpenDesk={onOpenDesk}
              onInformResult={(text) => setMsg(text)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function PlanEditor({
  draft,
  dirty,
  officer,
  onEdit,
  onSave,
  onDelete,
  onOpenDesk,
  onInformResult,
}: {
  draft: ExecutionPlan;
  dirty: boolean;
  officer: string;
  onEdit: (patch: Partial<ExecutionPlan>) => void;
  onSave: (note: string, patch?: Partial<ExecutionPlan>) => void;
  onDelete: () => void;
  onOpenDesk: () => void;
  onInformResult: (text: string) => void;
}) {
  const [locFilter, setLocFilter] = useState('');

  const toggleLocality = (name: string) => {
    playClick();
    const has = draft.localityNames.includes(name);
    onEdit({
      localityNames: has
        ? draft.localityNames.filter((n) => n !== name)
        : [...draft.localityNames, name],
    });
  };

  const selectMountainZones = () => {
    playClick();
    const mountainKeywords = ['Kedarnath', 'Manali', 'Teesta', 'Chamoli', 'Cherrapunji', 'Srinagar', 'Wayanad', 'Pasighat'];
    const mountainNames = ALL_OPERATIONAL_LOCALITIES.filter((name) =>
      mountainKeywords.some((k) => name.toLowerCase().includes(k.toLowerCase()))
    );
    const merged = Array.from(new Set([...draft.localityNames, ...mountainNames]));
    onEdit({ localityNames: merged });
  };

  const clearAllLocalities = () => {
    playClick();
    onEdit({ localityNames: [] });
  };

  const setStatus = (status: PlanStatus) => {
    playClick();
    if (status !== 'DRAFT' && draft.localityNames.length === 0) {
      onInformResult('Add at least one target locality before advancing the plan status.');
      return;
    }
    onSave(`Status escalated to ${status}.`, { status });
  };

  return (
    <div>
      {/* STATUS STEPPER */}
      <div className="card-header-bar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={draft.status === s ? 'primary' : ''}
              onClick={() => setStatus(s)}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
          Lead Officer: <b style={{ color: '#fff' }}>{draft.leadOfficer}</b> · Rev <b style={{ color: 'var(--sky)' }}>{draft.revision}</b>
          {dirty && <span style={{ color: '#fbbf24', marginLeft: 6 }}>● unsaved changes</span>}
        </div>
      </div>

      {/* TITLE & DATES */}
      <label>
        Operation Title
        <input
          value={draft.title}
          maxLength={120}
          onChange={(e) => onEdit({ title: e.target.value })}
          style={{ fontWeight: 600, fontSize: 14 }}
        />
      </label>

      <div className="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <label>
          Window Start Date
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => onEdit({ startDate: e.target.value })}
          />
        </label>
        <label>
          Window End Date
          <input
            type="date"
            value={draft.endDate}
            onChange={(e) => onEdit({ endDate: e.target.value })}
          />
        </label>
        <label>
          Peak Expected Severity
          <select
            value={draft.peakLevel}
            onChange={(e) => onEdit({ peakLevel: e.target.value as ExecutionPlan['peakLevel'] })}
          >
            <option value="LOW">LOW</option>
            <option value="MODERATE">MODERATE</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>
      </div>

      <label>
        Tactical Directive & Objective
        <textarea
          rows={3}
          maxLength={600}
          value={draft.objective}
          onChange={(e) => onEdit({ objective: e.target.value })}
          placeholder="State evacuation thresholds, designated shelter facilities, and transit route protections..."
        />
      </label>

      <p className="muted" style={{ fontSize: 11 }}>Hydrological Basis: {draft.basis}</p>

      {/* LOCALITIES */}
      <h4>Target Impact Localities ({draft.localityNames.length})</h4>
      <div className="checks">
        {PUNE_WARDS.map((p) => (
          <label key={p.key}>
            <input
              type="checkbox"
              checked={draft.localityNames.includes(p.name)}
              onChange={() => toggleLocality(p.name)}
            />
            {p.name}
          </label>
        ))}
      </div>

      {/* TASKS TABLE */}
      <h4>NDMA Phased Action Directives ({draft.tasks.length})</h4>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: 110 }}>Phase</th>
              <th>Task Directives</th>
              <th style={{ width: 140 }}>Owner Unit</th>
              <th style={{ width: 120 }}>Status</th>
              <th>Field Progress Notes</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {draft.tasks.map((task, idx) => (
              <tr key={task.id}>
                <td>
                  <select
                    value={task.phase}
                    onChange={(e) => {
                      const tasks = draft.tasks.slice();
                      tasks[idx] = { ...task, phase: e.target.value as TaskPhase, updatedAt: new Date().toISOString() };
                      onEdit({ tasks });
                    }}
                    style={{ fontSize: 11, padding: 4 }}
                  >
                    {PHASES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={task.title}
                    maxLength={160}
                    onChange={(e) => {
                      const tasks = draft.tasks.slice();
                      tasks[idx] = { ...task, title: e.target.value, updatedAt: new Date().toISOString() };
                      onEdit({ tasks });
                    }}
                    style={{ fontSize: 12 }}
                  />
                </td>
                <td>
                  <input
                    value={task.owner}
                    maxLength={80}
                    onChange={(e) => {
                      const tasks = draft.tasks.slice();
                      tasks[idx] = { ...task, owner: e.target.value, updatedAt: new Date().toISOString() };
                      onEdit({ tasks });
                    }}
                    style={{ fontSize: 12 }}
                  />
                </td>
                <td>
                  <select
                    value={task.status}
                    onChange={(e) => {
                      const tasks = draft.tasks.slice();
                      tasks[idx] = { ...task, status: e.target.value as TaskStatus, updatedAt: new Date().toISOString() };
                      onEdit({ tasks });
                    }}
                    style={{ fontSize: 11, padding: 4, fontWeight: 700 }}
                  >
                    {TASKS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={task.notes}
                    maxLength={200}
                    placeholder="Field status notes..."
                    onChange={(e) => {
                      const tasks = draft.tasks.slice();
                      tasks[idx] = { ...task, notes: e.target.value, updatedAt: new Date().toISOString() };
                      onEdit({ tasks });
                    }}
                    style={{ fontSize: 12 }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    style={{ padding: '3px 6px' }}
                    onClick={() => {
                      playClick();
                      onEdit({ tasks: draft.tasks.filter((t) => t.id !== task.id) });
                    }}
                    title="Remove task"
                  >
                    <TrashIcon size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        style={{ marginTop: 10, fontSize: 12 }}
        onClick={() => {
          playClick();
          onEdit({
            tasks: [
              ...draft.tasks,
              {
                id: crypto.randomUUID(),
                title: 'New Emergency Directive',
                phase: 'RESPOND',
                owner: officer,
                status: 'PENDING',
                notes: '',
                updatedAt: new Date().toISOString(),
              },
            ],
          });
        }}
      >
        <PlusIcon size={13} /> Add Task Directive
      </button>

      {/* ACTIONS BOTTOM BAR */}
      <div className="row spread" style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="primary"
            onClick={() => onSave(dirty ? 'Operational plan revised by command officer.' : 'Plan reviewed and certified.')}
          >
            <CheckCircleIcon size={14} /> Commit Changes
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            <TrashIcon size={14} /> Delete Plan
          </button>
        </div>

        <InformButton
          draft={draft}
          dirty={dirty}
          onSave={onSave}
          onOpenDesk={onOpenDesk}
          onInformResult={onInformResult}
        />
      </div>

      {/* REVISION AUDIT TIMELINE */}
      <h4 style={{ marginTop: 24 }}>Command Audit Timeline</h4>
      <ul className="book" style={{ maxHeight: 180 }}>
        {draft.history.map((h, i) => (
          <li key={`${h.at}-${i}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ color: 'var(--sky)' }}>{h.by}</b>
              <span className="muted" style={{ fontSize: 11 }}>{new Date(h.at).toLocaleString()}</span>
            </div>
            <span style={{ fontSize: 12 }}>{h.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InformButton({
  draft,
  dirty,
  onSave,
  onOpenDesk,
  onInformResult,
}: {
  draft: ExecutionPlan;
  dirty: boolean;
  onSave: (note: string, patch?: Partial<ExecutionPlan>) => void;
  onOpenDesk: () => void;
  onInformResult: (text: string) => void;
}) {
  const [channels, setChannels] = useState({ VOICE: true, SMS: true });
  const ready = draft.status === 'APPROVED' || draft.status === 'ACTIVE';

  const send = () => {
    if (!ready) {
      onInformResult('Plan must be elevated to APPROVED or ACTIVE before broadcasting to subscribers.');
      return;
    }
    if (dirty) onSave('Committed pending telephone blast.');
    const picked = (['VOICE', 'SMS'] as const).filter((c) => channels[c]);
    if (picked.length === 0) {
      onInformResult('Select at least one broadcast vector (Voice IVR or SMS).');
      return;
    }
    ensureSampleContacts();
    const result = queueAlerts(draft, loadContacts(), picked as Channel[]);
    if (result.queued === 0) {
      onInformResult(
        result.skipped
          ? 'Subscriber numbers are already queued for this plan execution.'
          : 'No registered subscriber numbers match the selected localities. Register numbers in the Telephone Desk.'
      );
      return;
    }
    playSonar();
    onInformResult(`${result.queued} emergency telephone alert(s) queued. Switched to Telemetry Desk.`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <label className="inline">
        <input
          type="checkbox"
          checked={channels.VOICE}
          onChange={(e) => setChannels({ ...channels, VOICE: e.target.checked })}
        />
        Voice IVR
      </label>
      <label className="inline">
        <input
          type="checkbox"
          checked={channels.SMS}
          onChange={(e) => setChannels({ ...channels, SMS: e.target.checked })}
        />
        SMS Blast
      </label>
      <button type="button" className="primary" onClick={send}>
        <RadioIcon size={14} /> Launch Citizen Broadcast
      </button>
      <button type="button" onClick={onOpenDesk}>
        <PhoneCallIcon size={14} /> Open Telephone Desk
      </button>
    </div>
  );
}
