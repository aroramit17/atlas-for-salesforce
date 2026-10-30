export function flattenValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.attributes && Object.keys(value).length === 1) return '';
    return JSON.stringify(value);
  }
  return String(value);
}

export function csvCell(value) {
  let text = flattenValue(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function recordsToCsv(records) {
  const columns = [...new Set(records.flatMap(row => Object.keys(row).filter(key => key !== 'attributes')))];
  return [columns.map(csvCell).join(','), ...records.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\r\n');
}
