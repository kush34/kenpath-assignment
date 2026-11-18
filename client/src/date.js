const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function todayISO(now = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
