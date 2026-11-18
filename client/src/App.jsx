import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { doctorPatientsResponseSchema, readingFormSchema, readingsResponseSchema, reportResponseSchema, validateResponse } from './schemas.js';

const SLOT_LIST = [
  { id: 'morning', title: 'Morning', detail: 'Fasting' },
  { id: 'breakfast', title: 'After breakfast', detail: 'Post-meal' },
  { id: 'lunch', title: 'After lunch', detail: 'Post-meal' },
  { id: 'dinner', title: 'After dinner', detail: 'Post-meal' }
];
const SLOT_COLORS = {
  morning: '#347c78',
  breakfast: '#5476c5',
  lunch: '#c07a36',
  dinner: '#a9526b'
};
const todayISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localDate = value => new Date(`${value}T12:00:00`);
const displayDate = value => new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(localDate(value));
const displayFullDate = value => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(localDate(value));

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sweety-token');
    if (!token) { setCheckingSession(false); return; }
    api('/api/auth/me', { token })
      .then(data => setSession({ token, user: data.user }))
      .catch(() => localStorage.removeItem('sweety-token'))
      .finally(() => setCheckingSession(false));
  }, []);

  const onAuthenticated = value => {
    localStorage.setItem('sweety-token', value.token);
    setSession(value);
  };
  const signOut = useCallback(() => {
    localStorage.removeItem('sweety-token');
    setSession(null);
  }, []);

  if (checkingSession) return <div className="page-loading">Opening your tracker…</div>;
  if (!session) return <AuthScreen onAuthenticated={onAuthenticated} />;
  return session.user.role === 'doctor'
    ? <DoctorDashboard session={session} onSignOut={signOut} />
    : <Dashboard session={session} onSignOut={signOut} />;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [fields, setFields] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setFields(previous => ({ ...previous, [key]: value }));
    setFieldErrors(previous => ({ ...previous, [key]: '' }));
  }
  async function submit(event) {
    event.preventDefault();
    setError(''); setFieldErrors({}); setSubmitting(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(fields) });
      onAuthenticated(data);
    } catch (requestError) {
      setError(requestError.message);
      setFieldErrors(requestError.fields || {});
    } finally { setSubmitting(false); }
  }

  return <main className="auth-screen">
    <header className="auth-brand"><span className="brand-dot" />sweety</header>
    <section className="auth-panel">
      <div className="auth-mark" aria-hidden="true">s</div>
      <p className="eyebrow">YOUR PERSONAL GLUCOSE LOG</p>
      <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="auth-intro">{mode === 'login' ? 'Sign in to see your readings and reports.' : 'A simple place to record and review your readings.'}</p>
      <form onSubmit={submit} noValidate>
        {mode === 'signup' && <TextField label="Name" name="name" autoComplete="name" value={fields.name} error={fieldErrors.name} onChange={value => update('name', value)} />}
        <TextField label="Email" name="email" type="email" autoComplete="email" value={fields.email} error={fieldErrors.email} onChange={value => update('email', value)} />
        <TextField label="Password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={fields.password} error={fieldErrors.password} onChange={value => update('password', value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary auth-submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p className="auth-switch">{mode === 'login' ? 'New to Sweety?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setFieldErrors({}); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </section>
    <p className="auth-foot">Your readings are private to your account.</p>
  </main>;
}

function TextField({ label, name, type = 'text', autoComplete, value, error, onChange }) {
  return <div className="field"><label htmlFor={`auth-${name}`}>{label}</label><input id={`auth-${name}`} name={name} type={type} autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error && <p className="field-error">{error}</p>}</div>;
}

function DoctorDashboard({ session, onSignOut }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [range, setRange] = useState('daily');
  const [report, setReport] = useState(null);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    api('/api/doctor/patients', { token: session.token })
      .then(data => validateResponse(doctorPatientsResponseSchema, data, 'assigned patients'))
      .then(data => {
        if (!current) return;
        setPatients(data.patients);
        setSelectedPatientId(data.patients[0]?.id || '');
      })
      .catch(loadError => {
        if (loadError.status === 401) onSignOut();
        else if (current) setError(loadError.message);
      })
      .finally(() => { if (current) setPatientsLoading(false); });
    return () => { current = false; };
  }, [onSignOut, session.token]);

  useEffect(() => {
    if (!selectedPatientId) { setReport(null); return undefined; }
    let current = true;
    setLoading(true); setError(''); setReport(null);
    api(`/api/doctor/patients/${selectedPatientId}/reports?range=${range}&date=${selectedDate}`, { token: session.token })
      .then(data => validateResponse(reportResponseSchema, data, 'patient report'))
      .then(data => { if (current) setReport(data); })
      .catch(loadError => {
        if (loadError.status === 401) onSignOut();
        else if (current) setError(loadError.message);
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [onSignOut, range, selectedDate, selectedPatientId, session.token]);

  const selectedPatient = patients.find(patient => patient.id === selectedPatientId);
  return <div className="app-shell">
    <header className="topbar doctor-topbar"><div className="topbar-inner doctor-topbar-inner">
      <a className="brand" href="#patients"><span className="brand-dot" />sweety</a>
      <nav className="topnav" aria-label="Main navigation"><a href="#patients" aria-current="page">Patients</a></nav>
      <div className="user-menu"><div className="user-avatar" aria-hidden="true">{session.user.name.slice(0, 1).toUpperCase()}</div><span>{session.user.name}</span><button type="button" onClick={onSignOut}>Sign out</button></div>
    </div></header>
    <main className="dashboard doctor-dashboard" id="patients">
      <section className="page-heading"><div><p className="eyebrow">CARE TEAM</p><h1>Patient reports</h1><p className="page-description">Review glucose readings for patients assigned to your care.</p></div>
        <label className="date-control" htmlFor="doctor-selected-date"><span aria-hidden="true">▦</span><input id="doctor-selected-date" type="date" max={todayISO()} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></label>
      </section>
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <div className="doctor-layout">
        <aside className="card doctor-patient-card"><div className="doctor-patient-heading"><h2>Assigned patients</h2><span>{patients.length}</span></div>
          {patientsLoading ? <p className="doctor-empty">Loading patients…</p> : patients.length ? <div className="doctor-patient-list">{patients.map(patient => <button className="doctor-patient-option" type="button" key={patient.id} aria-pressed={selectedPatientId === patient.id} onClick={() => setSelectedPatientId(patient.id)}><span className="patient-avatar" aria-hidden="true">{patient.name.slice(0, 1).toUpperCase()}</span><span>{patient.name}</span><span aria-hidden="true">›</span></button>)}</div> : <p className="doctor-empty">No patients are assigned to this account.</p>}
        </aside>
        {selectedPatient ? <div className="doctor-results">
          <article className="card chart-card doctor-chart-card"><DailyLineChart readings={report?.readings || []} isToday={selectedDate === todayISO()} selectedDate={selectedDate} range={range} rangeStart={report?.start} rangeEnd={report?.end} loading={loading} onRangeChange={setRange} /></article>
          <article className="card doctor-report-card"><div className="report-title"><h2>Glucose report</h2><span>{selectedPatient.name}</span></div>
            <p className="report-range">{report ? report.start === report.end ? displayDate(report.start) : `${displayDate(report.start)} – ${displayDate(report.end)}` : loading ? 'Loading report…' : 'No report available'}</p>
            {report?.count ? <><div className="stat-grid"><Stat label="Highest" value={report.highest} /><Stat label="Lowest" value={report.lowest} /><Stat label="Average" value={Number(report.average).toFixed(1)} /></div><div className="reading-count"><span>Readings recorded</span><strong>{report.count}</strong></div></> : !loading && <div className="empty-report"><span className="empty-mark">↗</span><strong>No readings in this period</strong></div>}
          </article>
          {range === 'daily' && <section className="card doctor-reading-card"><div className="log-heading"><h2>Daily readings</h2><span>{report?.readings.length || 0} of 4 slots recorded</span></div>
            {SLOT_LIST.map(slot => {
              const reading = report?.readings.find(item => item.slot === slot.id);
              return <div className="doctor-reading-row" key={slot.id}><span>{slot.title}</span><strong>{reading ? <>{reading.value} <small>mg/dL</small></> : '—'}</strong><span>{reading ? 'Recorded' : 'Not recorded'}</span></div>;
            })}
          </section>}
        </div> : <section className="card doctor-no-patient"><h2>{patientsLoading ? 'Loading patients…' : 'No assigned patients'}</h2><p>Patient reports will appear here when an assignment is available.</p></section>}
      </div>
    </main>
  </div>;
}

function Dashboard({ session, onSignOut }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [range, setRange] = useState('daily');
  const [readings, setReadings] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async (date = selectedDate, selectedRange = range) => {
    setLoading(true); setError('');
    try {
      const [rawReadingData, rawReportData] = await Promise.all([
        api(`/api/readings?date=${date}`, { token: session.token }),
        api(`/api/reports?range=${selectedRange}&date=${date}`, { token: session.token })
      ]);
      const readingData = validateResponse(readingsResponseSchema, rawReadingData, 'daily readings');
      const reportData = validateResponse(reportResponseSchema, rawReportData, 'report');
      setReadings(readingData.readings);
      setReport(reportData);
    } catch (loadError) {
      if (loadError.status === 401) onSignOut();
      else setError(loadError.message);
    } finally { setLoading(false); }
  }, [onSignOut, range, selectedDate, session.token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function saveReading(payload) {
    const isEdit = Boolean(editing?.id);
    const path = isEdit ? `/api/readings/${editing.id}` : '/api/readings';
    const data = await api(path, { token: session.token, method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    setEditing(null);
    setSelectedDate(payload.date);
    setRange('daily');
    setToast(isEdit ? 'Reading updated.' : 'Reading saved.');
    await load(payload.date, 'daily');
    return data;
  }

  async function deleteReading(reading) {
    const slot = SLOT_LIST.find(item => item.id === reading.slot)?.title || 'this reading';
    if (!window.confirm(`Delete the ${slot.toLowerCase()} reading?`)) return;
    try {
      await api(`/api/readings/${reading.id}`, { token: session.token, method: 'DELETE' });
      setToast('Reading deleted.');
      await load();
    } catch (deleteError) { setError(deleteError.message); }
  }

  const bySlot = useMemo(() => Object.fromEntries(readings.map(reading => [reading.slot, reading])), [readings]);
  const isToday = selectedDate === todayISO();
  return <div className="app-shell">
    <header className="topbar patient-topbar"><div className="topbar-inner patient-topbar-inner">
      <a className="brand" href="#today"><span className="brand-dot" />sweety</a>
      <nav className="topnav" aria-label="Main navigation"><a href="#today" aria-current="page">Today</a></nav>
      <div className="user-menu"><div className="user-avatar" aria-hidden="true">{session.user.name.slice(0, 1).toUpperCase()}</div><span>{session.user.name}</span><button type="button" onClick={onSignOut}>Sign out</button></div>
    </div></header>
    <main className="dashboard patient-dashboard" id="today">
      <section className="page-heading"><div><p className="eyebrow">{displayFullDate(selectedDate).toUpperCase()}</p><h1>Your glucose</h1><p className="page-description">A clear record of your readings through the day.</p></div>
        <div className="heading-actions"><label className="date-control" htmlFor="selected-date"><span aria-hidden="true">▦</span><input id="selected-date" type="date" max={todayISO()} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></label><button className="button primary" type="button" onClick={() => setEditing({ date: selectedDate, slot: firstOpenSlot(bySlot), value: '' })}><span aria-hidden="true">＋</span> Log a reading</button></div>
      </section>
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <section className="overview-grid patient-overview-grid" aria-label="Daily glucose chart and report">
        <article className="card chart-card patient-chart-card"><DailyLineChart readings={range === 'daily' ? readings : report?.range === range ? report.readings : []} isToday={isToday} selectedDate={selectedDate} range={range} rangeStart={report?.start} rangeEnd={report?.end} loading={loading && range !== 'daily' && report?.range !== range} onRangeChange={setRange} /></article>
        <article className="card report-card patient-report-card" id="report"><div className="report-title"><h2>Glucose report</h2></div>
          <p className="report-range">{report ? report.start === report.end ? displayDate(report.start) : `${displayDate(report.start)} – ${displayDate(report.end)}` : 'Loading report…'}</p>
          {report?.count ? <><div className="stat-grid"><Stat label="Highest" value={report.highest} /><Stat label="Lowest" value={report.lowest} /><Stat label="Average" value={Number(report.average).toFixed(1)} /></div><div className="reading-count"><span>Readings recorded</span><strong>{report.count}</strong></div></> : !loading && <div className="empty-report"><span className="empty-mark">↗</span><strong>No readings in this period</strong><span>Log a reading to start building your report.</span></div>}
        </article>
      </section>
      <section className="card log-card patient-log-card" aria-labelledby="readings-title"><div className="log-heading"><h2 id="readings-title">{isToday ? 'Today’s readings' : 'Daily readings'}</h2><span>{readings.length} of 4 slots recorded</span></div>
        {loading ? <div className="loading-rows">Loading your readings…</div> : <div>{SLOT_LIST.map(slot => <ReadingRow key={slot.id} slot={slot} reading={bySlot[slot.id]} onEdit={() => setEditing(bySlot[slot.id] || { date: selectedDate, slot: slot.id, value: '' })} onDelete={deleteReading} />)}</div>}
      </section>
      <p className="page-foot">Measurements are for your personal tracking and care-team discussions.</p>
    </main>
    {editing && <ReadingDialog key={`${editing.id || 'new'}-${editing.slot}-${editing.date}`} initial={editing} token={session.token} onClose={() => setEditing(null)} onSave={saveReading} />}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </div>;
}

function firstOpenSlot(bySlot) { return SLOT_LIST.find(slot => !bySlot[slot.id])?.id || 'morning'; }

function Stat({ label, value }) {
  return <div className="stat"><span>{label}</span><strong>{value} <small>mg/dL</small></strong></div>;
}

function DailyLineChart({ readings, isToday, selectedDate, range, rangeStart, rangeEnd, loading, onRangeChange }) {
  const [activeReadingId, setActiveReadingId] = useState(null);
  const [pinned, setPinned] = useState(false);
  const slotIndices = Object.fromEntries(SLOT_LIST.map((slot, index) => [slot.id, index]));
  const orderedReadings = [...readings].sort((a, b) => a.date.localeCompare(b.date) || slotIndices[a.slot] - slotIndices[b.slot]);
  const values = orderedReadings.map(reading => Number(reading.value));
  const minimum = values.length ? Math.min(...values) : 80;
  const maximum = values.length ? Math.max(...values) : 160;
  const step = maximum > 400 ? 100 : maximum > 200 ? 50 : 20;
  let low = Math.max(0, Math.floor((minimum - 20) / step) * step);
  let high = Math.ceil((maximum + 20) / step) * step;
  if (high - low < step * 3) high = low + step * 3;
  const plot = { left: 54, top: 36, right: 620, bottom: 216 };
  const yFor = value => plot.bottom - ((value - low) / (high - low)) * (plot.bottom - plot.top);
  const chartStart = range === 'daily' ? selectedDate : rangeStart || selectedDate;
  const chartEnd = range === 'daily' ? selectedDate : rangeEnd || selectedDate;
  const startTime = Date.parse(`${chartStart}T00:00:00Z`);
  const totalDays = Math.max(1, (Date.parse(`${chartEnd}T00:00:00Z`) - startTime) / 86400000 + 1);
  const dailyX = [96, 265, 435, 604];
  const chartPoints = orderedReadings.map(reading => {
    const slotIndex = slotIndices[reading.slot];
    const x = range === 'daily'
      ? dailyX[slotIndex]
      : plot.left + (((Date.parse(`${reading.date}T00:00:00Z`) - startTime) / 86400000 + (slotIndex + 1) / 5) / totalDays) * (plot.right - plot.left);
    return { ...reading, x, y: yFor(Number(reading.value)) };
  });
  const activePoint = chartPoints.find(point => point.id === activeReadingId);
  const activeReading = activePoint;
  const descriptions = orderedReadings.map(reading => `${reading.date}, ${SLOT_LIST[slotIndices[reading.slot]].title}, ${reading.value} milligrams per deciliter`);
  const displayDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const formatAxisDate = time => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  function selectNearestReading(event) {
    if (!chartPoints.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = (event.clientX - bounds.left) * 640 / bounds.width;
    const nearest = chartPoints.reduce((best, point) => {
      const distance = Math.abs(point.x - chartX);
      return !best || distance < best.distance ? { id: point.id, distance } : best;
    }, null);
    setActiveReadingId(nearest.id);
    setPinned(false);
  }
  const dayTickCount = Math.min(4, Math.max(1, Math.floor(totalDays - 1)));
  const dateTicks = totalDays === 1 ? [{ x: (plot.left + plot.right) / 2, label: formatAxisDate(startTime) }] : Array.from({ length: dayTickCount + 1 }, (_, index) => {
    const time = startTime + ((totalDays - 1) * index / dayTickCount) * 86400000;
    const x = plot.left + ((plot.right - plot.left) * index / dayTickCount);
    return { x, label: formatAxisDate(time) };
  });
  return <>
    <div className="chart-topline"><div className="chart-title"><h2>{range === 'daily' ? (isToday ? 'Today' : 'Selected day') : range === 'mtd' ? 'Month to date' : 'Last month'}</h2><p>{range === 'daily' ? 'Glucose by time slot' : 'Glucose over time'} <span>·</span> mg/dL</p></div>
      <div className="range-tabs chart-range-tabs" role="group" aria-label="Chart date range">{[['daily', 'Daily'], ['mtd', 'Month to date'], ['monthly', 'Last month']].map(([id, label]) => <button type="button" key={id} aria-pressed={range === id} onClick={() => onRangeChange(id)}>{label}</button>)}</div>
    </div>
    <div className="chart-legend" aria-label="Chart colors by time slot">{SLOT_LIST.map(slot => <span className="legend-item" key={slot.id}><i style={{ '--series-color': SLOT_COLORS[slot.id] }} />{slot.title}</span>)}</div>
    <div className="chart-area">
    <svg className="daily-line-chart" viewBox="0 0 640 280" role="group" aria-label={readings.length ? `Blood glucose readings: ${descriptions.join('; ')}` : 'No glucose readings recorded for this date range'} onPointerMove={selectNearestReading} onPointerLeave={() => { if (!pinned) setActiveReadingId(null); }} onClick={event => { if (!event.target.classList.contains('chart-point')) { setActiveReadingId(null); setPinned(false); } }}>
      <g className="chart-axis-labels" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => {
        const value = high - ((high - low) / 4) * index;
        const y = plot.top + ((plot.bottom - plot.top) / 4) * index;
        return <g key={index}><line className="chart-gridline" x1={plot.left} x2={plot.right} y1={y} y2={y} /><text className="chart-tick" x="43" y={y + 3}>{Math.round(value)}</text></g>;
      })}</g>
      <g aria-hidden="true">{chartPoints.slice(0, -1).map((point, index) => {
        const next = chartPoints[index + 1];
        const dx = next.x - point.x;
        const x1 = point.x, x2 = next.x;
        const y1 = point.y, y2 = next.y;
        const curve = `M ${x1} ${y1} C ${x1 + dx * .42} ${y1}, ${x2 - dx * .42} ${y2}, ${x2} ${y2}`;
        return <path key={`${point.id}-${next.id}`} className="chart-connection" d={curve} stroke={SLOT_COLORS[next.slot]} />;
      })}</g>
      {chartPoints.map(point => <circle key={point.id} className="chart-point" cx={point.x} cy={point.y} r={point.id === activeReadingId ? 7 : 5} fill={SLOT_COLORS[point.slot]} tabIndex="0" role="button" aria-label={`${point.date}, ${SLOT_LIST[slotIndices[point.slot]].title}: ${point.value} mg/dL`} onFocus={() => { setActiveReadingId(point.id); setPinned(true); }} onBlur={() => { setPinned(false); setActiveReadingId(null); }} onClick={() => { setActiveReadingId(point.id); setPinned(true); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveReadingId(point.id); setPinned(true); } }} />)}
      {range === 'daily' ? SLOT_LIST.map((slot, index) => <text className="chart-slot-label" key={slot.id} x={dailyX[index]} y="251">{slot.title}</text>) : dateTicks.map(tick => <text className="chart-slot-label date-axis-label" key={tick.label} x={tick.x} y="251">{tick.label}</text>)}
      {!chartPoints.length && <text className="chart-no-data" x="332" y="123">{loading ? 'Loading chart…' : 'No readings for this date range'}</text>}
    </svg>
    {activePoint && <div className={`chart-tooltip ${activePoint.y < 92 ? 'below-point' : ''}`} style={{ left: `clamp(82px, ${(activePoint.x / 640) * 100}%, calc(100% - 82px))`, top: `${(activePoint.y / 280) * 100}%`, '--series-color': SLOT_COLORS[activePoint.slot] }} role="status" aria-live="polite">
      <span className="tooltip-date">{new Date(`${activeReading.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <div className="tooltip-row"><i className="tooltip-swatch" /><span>{SLOT_LIST.find(slot => slot.id === activeReading.slot)?.title}</span><strong>{activeReading.value} <small>mg/dL</small></strong></div>
    </div>}
    </div>
  </>;
}

function ReadingRow({ slot, reading, onEdit, onDelete }) {
  return <div className="reading-row"><div className="slot-name-wrap"><span className="slot-badge" aria-hidden="true">{slot.title === 'Morning' ? '☼' : '◷'}</span><div><strong>{slot.title}</strong><small>{slot.detail}</small></div></div>
    <div className="row-value">{reading ? <>{reading.value} <small>mg/dL</small></> : '—'}</div><span className="row-status">{reading ? 'Recorded' : 'Not recorded'}</span>
    <div className="row-actions"><button className="icon-button" type="button" onClick={onEdit} aria-label={`${reading ? 'Edit' : 'Add'} ${slot.title.toLowerCase()} reading`}>{reading ? '✎' : '＋'}</button>{reading && <button className="icon-button delete-button" type="button" onClick={() => onDelete(reading)} aria-label={`Delete ${slot.title.toLowerCase()} reading`}>×</button>}</div>
  </div>;
}

export function ReadingDialog({ initial, token, onClose, onSave }) {
  const [form, setForm] = useState({ date: initial.date, slot: initial.slot || 'morning', value: initial.value ?? '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial.id);
  function set(key, value) { setForm(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); }
  async function submit(event) {
    event.preventDefault(); setError(''); setErrors({});
    const validation = readingFormSchema.safeParse(form);
    if (!validation.success) {
      setErrors(Object.fromEntries(validation.error.issues.map(issue => [issue.path[0], issue.message])));
      return;
    }
    setSaving(true);
    try { await onSave(validation.data); }
    catch (saveError) { setError(saveError.message); setErrors(saveError.fields || {}); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="reading-dialog-title"><header className="modal-head"><div><h2 id="reading-dialog-title">{isEdit ? 'Edit reading' : 'Log a reading'}</h2><p>Enter one measurement for your daily record.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button></header>
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="reading-date">Date</label><input id="reading-date" type="date" max={todayISO()} value={form.date} onChange={event => set('date', event.target.value)} aria-invalid={Boolean(errors.date)} />{errors.date && <p className="field-error">{errors.date}</p>}</div>
        <div className="field"><label htmlFor="reading-slot">Time slot</label><select id="reading-slot" value={form.slot} onChange={event => set('slot', event.target.value)} aria-invalid={Boolean(errors.slot)}>{SLOT_LIST.map(slot => <option key={slot.id} value={slot.id}>{slot.title}{slot.id === 'morning' ? ' (fasting)' : ''}</option>)}</select>{errors.slot && <p className="field-error">{errors.slot}</p>}</div>
        <div className="field"><label htmlFor="reading-value">Glucose value <span>(mg/dL)</span></label><input id="reading-value" type="number" inputMode="numeric" min="40" max="600" step="1" placeholder="40–600" value={form.value} onChange={event => set('value', event.target.value)} aria-invalid={Boolean(errors.value)} />{errors.value && <p className="field-error">{errors.value}</p>}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save reading'}</button></div>
      </form>
    </section>
  </div>;
}
