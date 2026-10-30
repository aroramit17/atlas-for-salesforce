import { assertObjectName, assertRecordId } from './salesforce.js';

export const MAX_MUTATION_ROWS = 200;

export function parseCsv(source) {
  const text = String(source ?? '').replace(/^\uFEFF/, '');
  if (!text || text.length > 2_000_000) throw new Error('Choose a CSV file up to 2 MB.');
  const rows = [];
  let row = [], cell = '', quoted = false, closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
    } else if (char === '"' && !cell && !closedQuote) {
      quoted = true;
    } else if (char === ',') {
      row.push(cell); cell = ''; closedQuote = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; closedQuote = false;
    } else if (closedQuote) {
      throw new Error(`Unexpected text after a quoted CSV value near character ${i + 1}.`);
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted value.');
  if (row.length || cell || closedQuote) { row.push(cell); rows.push(row); }
  if (rows.length < 2) throw new Error('The CSV needs a header and at least one data row.');
  const headers = rows.shift().map(value => value.trim());
  if (headers.some(value => !value || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value))) throw new Error('Use Salesforce field API names as CSV headers.');
  if (new Set(headers.map(value => value.toLowerCase())).size !== headers.length) throw new Error('The CSV contains duplicate field headers.');
  const data = rows.filter(values => values.some(value => value !== ''));
  if (!data.length || data.length > MAX_MUTATION_ROWS) throw new Error(`Include 1–${MAX_MUTATION_ROWS} nonblank data rows per operation.`);
  if (data.some(values => values.length !== headers.length)) throw new Error('Every CSV row must have the same number of columns as the header.');
  return { headers, rows: data };
}

export function prepareMutation(source, objectName, mode, describe, externalIdField = '') {
  const object = assertObjectName(objectName);
  if (!['create', 'update', 'upsert', 'delete'].includes(mode)) throw new Error('Choose a supported data operation.');
  const parsed = parseCsv(source);
  const fields = new Map((describe?.fields || []).map(field => [field.name.toLowerCase(), field]));
  const idIndex = parsed.headers.findIndex(name => name.toLowerCase() === 'id');
  const external = mode === 'upsert' ? assertObjectName(externalIdField) : '';
  const externalField = mode === 'upsert' ? fields.get(external.toLowerCase()) : null;
  if (mode === 'create' && describe?.createable === false) throw new Error(`${object} cannot be created by this user.`);
  if (mode === 'update' && describe?.updateable === false) throw new Error(`${object} cannot be updated by this user.`);
  if (mode === 'delete' && describe?.deletable === false) throw new Error(`${object} cannot be deleted by this user.`);
  if (mode === 'upsert' && (describe?.createable === false || describe?.updateable === false)) throw new Error(`${object} cannot be upserted by this user.`);
  if (mode === 'create' && idIndex !== -1) throw new Error('Remove the Id column when creating records.');
  if (mode === 'upsert' && idIndex !== -1) throw new Error('Remove the Id column when upserting by external ID.');
  if (['update', 'delete'].includes(mode) && idIndex === -1) throw new Error('Update and delete CSV files need an Id column.');
  if (mode === 'delete' && parsed.headers.length !== 1) throw new Error('Delete CSV files may contain only an Id column.');
  if (mode === 'upsert' && (!externalField?.externalId || !parsed.headers.some(name => name.toLowerCase() === external.toLowerCase()))) {
    throw new Error('Choose an external ID field that is present in the CSV.');
  }
  const metadata = parsed.headers.map(name => {
    if (name.toLowerCase() === 'id') return { name: 'Id' };
    const field = fields.get(name.toLowerCase());
    if (!field) throw new Error(`${name} is not a field on ${object}.`);
    if (mode === 'create' && !field.createable) throw new Error(`${name} cannot be created by this user.`);
    if (mode === 'update' && !field.updateable) throw new Error(`${name} cannot be updated by this user.`);
    if (mode === 'upsert' && !(field.createable && field.updateable)) throw new Error(`${name} must be both createable and updateable for upsert.`);
    return field;
  });
  const records = parsed.rows.map((values, index) => {
    const record = { attributes: { type: object } };
    for (let i = 0; i < metadata.length; i++) {
      const name = metadata[i].name;
      const value = values[i];
      if (name === 'Id') { record.id = assertRecordId(value.trim()); continue; }
      if (value === '') continue;
      record[name] = value === '#NULL' ? null : value;
    }
    if (mode === 'upsert' && !record[externalField.name]) throw new Error(`Row ${index + 2} has no external ID value.`);
    return record;
  });
  return { object, mode, records, headers: parsed.headers, count: records.length, externalIdField: externalField?.name || '' };
}
