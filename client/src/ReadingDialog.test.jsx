import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReadingDialog from './components/ReadingDialog.jsx';
import { todayISO } from './date.js';

function renderForm(value = '') {
  const onSave = vi.fn();
  render(<ReadingDialog initial={{ date: todayISO(), slot: 'morning', value }} onClose={vi.fn()} onSave={onSave} />);
  return { onSave, user: userEvent.setup() };
}

describe('reading form', () => {
  it('shows a required-value error without submitting', async () => {
    const { onSave, user } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Save reading' }));
    expect(screen.getByText('Please enter a glucose value.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects readings outside the supported range', async () => {
    const { onSave, user } = renderForm();
    await user.type(screen.getByLabelText(/Glucose value/), '601');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));
    expect(screen.getByText('Value must be between 40 and 600 mg/dL.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects fractional readings', async () => {
    const { onSave, user } = renderForm();
    await user.type(screen.getByLabelText(/Glucose value/), '108.5');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));
    expect(screen.getByText('Value must be a whole number between 40 and 600 mg/dL.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits a validated integer reading', async () => {
    const { onSave, user } = renderForm();
    await user.type(screen.getByLabelText(/Glucose value/), '108');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));
    expect(onSave).toHaveBeenCalledWith({ date: todayISO(), slot: 'morning', value: 108 });
  });
});
