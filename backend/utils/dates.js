function isValidMonth(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// '2026-12' -> { start: '2026-12-01', end: '2027-01-01' } (end is exclusive)
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { start: `${month}-01`, end: `${ny}-${String(nm).padStart(2, '0')}-01` };
}

module.exports = { isValidMonth, isValidDate, currentMonth, monthRange };
