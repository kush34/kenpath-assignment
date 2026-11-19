import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { readingsResponseSchema, reportResponseSchema, validateResponse } from '../schemas.js';
import { todayISO, displayDate, displayFullDate } from '../date.js';
import { SLOT_LIST } from '../constants/slots.js';
import DailyLineChart from '../components/DailyLineChart.jsx';
import Stat from '../components/Stat.jsx';
import ReadingRow from '../components/ReadingRow.jsx';
import ReadingDialog from '../components/ReadingDialog.jsx';
export default function Dashboard({ session, onSignOut }) {
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
