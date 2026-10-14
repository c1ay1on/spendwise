function localDateParts(date) {
  return {
    year: date.getFullYear(),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    day: String(date.getDate()).padStart(2, "0"),
  };
}

export function getCurrentDate() {
  const { year, month, day } = localDateParts(new Date());
  return `${year}-${month}-${day}`;
}

export function getCurrentMonth() {
  const { year, month } = localDateParts(new Date());
  return `${year}-${month}`;
}
