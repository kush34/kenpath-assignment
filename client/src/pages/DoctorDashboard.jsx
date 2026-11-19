import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { doctorPatientsResponseSchema, reportResponseSchema, validateResponse } from '../schemas.js';
import { todayISO, displayDate } from '../date.js';
import { SLOT_LIST } from '../constants/slots.js';
import DailyLineChart from '../components/DailyLineChart.jsx';
import Stat from '../components/Stat.jsx';
export default function DoctorDashboard({ session, onSignOut }) {
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
