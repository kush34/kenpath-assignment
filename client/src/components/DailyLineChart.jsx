import { useState } from 'react';
import { SLOT_LIST, SLOT_COLORS } from '../constants/slots.js';
export default function DailyLineChart({ readings, isToday, selectedDate, range, rangeStart, rangeEnd, loading, onRangeChange }) {
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
