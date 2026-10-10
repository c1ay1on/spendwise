// Accepts 12, "12", 12.5, "12.50"; max 8 digits before the decimal point, max 2 decimals, must be > 0.
function parseAmount(value) {
  const s = typeof value === 'number' ? String(value) : value;
  if (typeof s !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(s.trim())) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

// Positive whole number, or null
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { parseAmount, parseId };
