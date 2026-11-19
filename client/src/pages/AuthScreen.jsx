import { useState } from 'react';
import { api } from '../api.js';
export default function AuthScreen({ onAuthenticated }) {
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
