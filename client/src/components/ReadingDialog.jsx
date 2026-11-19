import { useState } from 'react';
import { readingFormSchema } from '../schemas.js';
import { todayISO } from '../date.js';
import { SLOT_LIST } from '../constants/slots.js';
export default function ReadingDialog({ initial, token, onClose, onSave }) {
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
