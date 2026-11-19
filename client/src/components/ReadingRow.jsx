
export default function ReadingRow({ slot, reading, onEdit, onDelete }) {
  return <div className="reading-row"><div className="slot-name-wrap"><span className="slot-badge" aria-hidden="true">{slot.title === 'Morning' ? '☼' : '◷'}</span><div><strong>{slot.title}</strong><small>{slot.detail}</small></div></div>
    <div className="row-value">{reading ? <>{reading.value} <small>mg/dL</small></> : '—'}</div><span className="row-status">{reading ? 'Recorded' : 'Not recorded'}</span>
    <div className="row-actions"><button className="icon-button" type="button" onClick={onEdit} aria-label={`${reading ? 'Edit' : 'Add'} ${slot.title.toLowerCase()} reading`}>{reading ? '✎' : '＋'}</button>{reading && <button className="icon-button delete-button" type="button" onClick={() => onDelete(reading)} aria-label={`Delete ${slot.title.toLowerCase()} reading`}>×</button>}</div>
  </div>;
}
