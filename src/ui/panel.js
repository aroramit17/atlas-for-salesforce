import { recordsToCsv, flattenValue } from '../core/csv.js';
import { assertObjectName, assertRelativeSalesforcePath, orgColor } from '../core/salesforce.js';
import { prepareMutation } from '../core/import.js';
import { fieldPackage } from '../core/fields.js';

const $ = selector => document.querySelector(selector);
const state = { context: null, objects: [], query: null, schema: null, links: [], colors: {}, dataPlan: null, toastTimer: null, refreshId: 0 };
const standardLinks = [
  ['Setup home', '/lightning/setup/SetupOneHome/home'],
  ['Object Manager', '/lightning/setup/ObjectManager/home'],
  ['Accounts', '/lightning/o/Account/list'],
  ['Contacts', '/lightning/o/Contact/list'],
  ['Reports', '/lightning/o/Report/list']
];

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function clear(element) { element.replaceChildren(); }
function notice(target, text, error = false) {
  clear(target);
  target.append(node('div', `message${error ? ' error' : ''}`, text));
}
function toast(text, error = false) {
  const element = $('#toast');
  element.textContent = text;
  element.className = `toast${error ? ' error' : ''}`;
  element.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { element.hidden = true; }, 5000);
}
async function request(type, args = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...args });
  if (!response?.ok) throw new Error(response?.error || 'The extension did not respond. Reload it and try again.');
  if (type !== 'context' && type !== 'orgTabs' && state.context && response.context?.host !== state.context.host) {
    throw new Error('The active org changed. Run the operation again.');
  }
  return response;
}
function show(view) {
  for (const element of document.querySelectorAll('.view')) element.hidden = element.id !== `view-${view}`;
  for (const button of document.querySelectorAll('.nav-item')) {
    const selected = button.dataset.view === view;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-current', selected ? 'page' : 'false');
  }
  if (view === 'schema' && state.context && !state.objects.length) loadObjects();
  if (view === 'links') renderLinks();
  if (view === 'orgs') loadOrgTabs();
}
function updateOrg(context, status = 'Session found', error = false) {
  state.context = context;
  $('#org-name').textContent = context ? context.label : 'No Salesforce org';
  $('#org-status').textContent = context ? context.host : 'Open an authenticated Salesforce tab';
  $('#org-state').textContent = error ? 'Unavailable' : context ? status : 'Waiting';
  $('#org-state').classList.toggle('error', error);
  const color = context ? state.colors[new URL(context.origin).host] || orgColor(new URL(context.origin).host) : '#93a6a6';
  $('#org-dot').style.background = color;
  $('#org-color').value = color;
  $('#home-empty').hidden = Boolean(context);
  $('#home-ready').hidden = !context;
  if (context?.record) {
    $('#record-object').value = context.record.object;
    $('#record-id').value = context.record.id;
  }
}
async function refresh() {
  const refreshId = ++state.refreshId;
  try {
    const { context } = await request('context');
    if (refreshId !== state.refreshId) return;
    updateOrg(context, 'Checking');
    if (context.record) inspectRecord(context.record.object, context.record.id);
    try {
      const { data } = await request('limits');
      if (refreshId !== state.refreshId) return;
      const daily = data.DailyApiRequests;
      $('#api-remaining').textContent = daily?.Remaining?.toLocaleString() ?? '—';
      $('#api-used').textContent = daily ? (daily.Max - daily.Remaining).toLocaleString() : '—';
      updateOrg(context, 'Connected');
    } catch (error) {
      if (refreshId !== state.refreshId) return;
      updateOrg(context, 'API blocked', true);
      $('#api-remaining').textContent = '—';
      $('#api-used').textContent = '—';
      toast(error.message, true);
    }
  } catch {
    if (refreshId !== state.refreshId) return;
    updateOrg(null);
    $('#api-remaining').textContent = '—';
    $('#api-used').textContent = '—';
  }
}
function resultTitle(title, count) {
  const row = node('div', 'result-title');
  row.append(node('h2', '', title), node('small', '', count));
  return row;
}
function table(headers, rows) {
  const wrap = node('div', 'table-wrap');
  const table = node('table');
  const thead = node('thead');
  const headRow = node('tr');
  for (const heading of headers) headRow.append(node('th', '', heading));
  thead.append(headRow);
  const tbody = node('tbody');
  for (const row of rows) {
    const tr = node('tr');
    for (const value of row) tr.append(node('td', '', flattenValue(value)));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}
async function inspectRecord(object, id) {
  const result = $('#record-result');
  notice(result, 'Loading record…');
  try {
    const [{ data: record }, { data: metadata }] = await Promise.all([
      request('record', { object, id }), request('describe', { object })
    ]);
    const fields = metadata.fields || [];
    const rows = fields.filter(field => Object.hasOwn(record, field.name)).map(field => [field.label, field.name, field.type, record[field.name]]);
    clear(result);
    result.append(resultTitle(`${metadata.label || object} · ${id}`, `${rows.length} fields`), table(['Field', 'API name', 'Type', 'Value'], rows));
  } catch (error) { notice(result, error.message, true); }
}
async function runQuery() {
  const result = $('#query-result');
  const soql = $('#soql').value;
  $('#export-csv').disabled = true;
  notice(result, 'Running query…');
  try {
    const { data } = await request('query', { soql });
    state.query = data;
    const records = data.records || [];
    clear(result);
    const label = `${records.length.toLocaleString()} returned${data.truncated ? ` · capped at ${data.rowCap.toLocaleString()}` : ''}`;
    result.append(resultTitle('Results', label));
    if (!records.length) { result.append(node('div', 'message', 'No records matched this query.')); return; }
    if (data.truncated) result.append(node('p', 'message', 'This export is partial. Narrow the query or add a LIMIT to control the result set.'));
    const columns = [...new Set(records.slice(0, 100).flatMap(row => Object.keys(row).filter(key => key !== 'attributes')))];
    result.append(table(columns, records.slice(0, 100).map(row => columns.map(key => row[key]))));
    if (records.length > 100) result.append(node('p', 'muted small', 'Showing the first 100 rows here. CSV includes every returned row.'));
    $('#export-csv').disabled = false;
  } catch (error) { state.query = null; notice(result, error.message, true); }
}
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = node('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function loadObjects() {
  const target = $('#object-list');
  notice(target, 'Loading objects…');
  try {
    const { data } = await request('objects');
    state.objects = data.sobjects || [];
    $('#export-objects').disabled = !state.objects.length;
    renderObjects();
  } catch (error) { notice(target, error.message, true); }
}
function renderObjects() {
  const target = $('#object-list');
  clear(target);
  const term = $('#object-filter').value.trim().toLowerCase();
  const objects = state.objects.filter(item => `${item.label} ${item.name}`.toLowerCase().includes(term)).slice(0, 100);
  if (!objects.length) { target.append(node('div', 'message', 'No matching objects.')); return; }
  for (const item of objects) {
    const button = node('button', 'object-row');
    button.type = 'button';
    button.append(node('span', '', item.label), node('small', '', item.name));
    button.addEventListener('click', () => loadFields(item.name));
    target.append(button);
  }
}
async function loadFields(object) {
  const target = $('#field-result');
  notice(target, `Loading ${object} fields…`);
  try {
    const { data } = await request('describe', { object });
    const fields = data.fields || [];
    state.schema = data;
    $('#export-fields').disabled = !fields.length;
    clear(target);
    target.append(resultTitle(`${data.label} fields`, `${fields.length} fields`), table(['Label', 'API name', 'Type', 'Required'], fields.map(field => [field.label, field.name, field.type, field.nillable ? 'No' : 'Yes'])));
  } catch (error) { notice(target, error.message, true); }
}
async function findComponents() {
  const target = $('#component-result');
  notice(target, 'Searching component names…');
  try {
    const { data } = await request('components', { term: $('#component-term').value });
    clear(target);
    target.append(resultTitle('Matches', `${data.length} found`));
    if (!data.length) { target.append(node('div', 'message', 'No matching components.')); return; }
    for (const item of data) {
      const button = node('button', 'component-row');
      button.type = 'button';
      button.title = 'Copy component ID';
      button.append(node('span', '', item.name), node('small', '', item.type));
      button.addEventListener('click', async () => { await navigator.clipboard.writeText(item.id); toast('Component ID copied.'); });
      target.append(button);
    }
  } catch (error) { notice(target, error.message, true); }
}
async function loadLogs() {
  const target = $('#log-list');
  notice(target, 'Loading recent logs…');
  try {
    const { data } = await request('logs');
    clear(target);
    target.append(resultTitle('Recent logs', `${data.records.length} shown`));
    if (!data.records.length) { target.append(node('div', 'message', 'No debug logs are available to this user.')); return; }
    const list = node('div', 'link-list');
    for (const log of data.records) {
      const button = node('button', 'log-row');
      button.type = 'button';
      button.append(node('span', '', `${log.Operation || 'Operation'} · ${log.LogUser?.Name || 'User'}`), node('small', '', log.Status || 'Log'));
      button.addEventListener('click', () => viewLog(log));
      list.append(button);
    }
    target.append(list);
  } catch (error) { notice(target, error.message, true); }
}
async function viewLog(log) {
  const target = $('#log-detail');
  notice(target, 'Loading log body…');
  try {
    const { data } = await request('logBody', { id: log.Id });
    clear(target);
    const heading = resultTitle(log.Operation || 'Debug log', `${(log.LogLength || data.length).toLocaleString()} bytes`);
    const button = node('button', '', 'Download .log');
    button.type = 'button';
    button.addEventListener('click', () => download(`salesforce-log-${log.Id}.log`, data, 'text/plain'));
    heading.append(button);
    target.append(heading, node('pre', 'log-body', data));
  } catch (error) { notice(target, error.message, true); }
}
function openPath(path) {
  if (!state.context) { toast('Open a Salesforce org tab first.', true); return; }
  try {
    const safe = assertRelativeSalesforcePath(path);
    chrome.tabs.create({ url: `https://${state.context.host}${safe}` });
  } catch (error) { toast(error.message, true); }
}
function renderLinks() {
  const standard = $('#standard-links');
  const custom = $('#custom-links');
  clear(standard); clear(custom);
  for (const [label, path] of standardLinks) {
    const button = node('button', 'link-row');
    button.type = 'button';
    button.append(node('span', '', label), node('small', '', 'Open ↗'));
    button.addEventListener('click', () => openPath(path));
    standard.append(button);
  }
  const hostLinks = state.links.filter(item => item.host === state.context?.host);
  if (!hostLinks.length) custom.append(node('div', 'message', 'No custom links for this org yet.'));
  for (const item of hostLinks) {
    const row = node('div', 'link-row');
    const open = node('button', '', item.label);
    open.type = 'button';
    open.addEventListener('click', () => openPath(item.path));
    const remove = node('button', '', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      state.links = state.links.filter(link => link !== item);
      await chrome.storage.local.set({ customLinks: state.links });
      renderLinks();
    });
    row.append(open, remove);
    custom.append(row);
  }
}

function buildSimpleQuery() {
  try {
    const object = assertObjectName($('#builder-object').value.trim());
    const fields = $('#builder-fields').value.split(',').map(name => assertObjectName(name.trim()));
    if (!fields.length || fields.length > 30) throw new Error('Choose 1–30 fields.');
    const limit = Number($('#builder-limit').value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('Choose a limit from 1 to 10,000.');
    $('#soql').value = `SELECT ${fields.join(', ')} FROM ${object} LIMIT ${limit}`;
    toast('Query added to the editor.');
  } catch (error) { toast(error.message, true); }
}

async function generateFields() {
  const target = $('#field-package-result');
  try {
    const file = $('#field-file').files[0];
    if (!file || file.size > 2_000_000) throw new Error('Choose a field definitions CSV up to 2 MB.');
    const result = fieldPackage(await file.text());
    download('atlas-custom-fields.zip', result.zip, 'application/zip');
    notice(target, `Generated ${result.count} field definitions across ${result.objects} objects. Review the ZIP, then use Metadata deployment in the API tab to validate it.`);
  } catch (error) { notice(target, error.message, true); }
}

async function reviewData() {
  const target = $('#data-review');
  $('#data-confirm').hidden = true;
  state.dataPlan = null;
  clear($('#data-result'));
  notice(target, 'Reading and checking CSV…');
  try {
    const file = $('#data-file').files[0];
    if (!file || file.size > 2_000_000) throw new Error('Choose a CSV file up to 2 MB.');
    const csv = await file.text();
    const object = $('#data-object').value.trim();
    const mode = $('#data-mode').value;
    const externalIdField = $('#external-field').value.trim();
    const { data: describe } = await request('describe', { object });
    const plan = prepareMutation(csv, object, mode, describe, externalIdField);
    const phrase = `APPLY ${plan.count} ${plan.object}`;
    state.dataPlan = { csv, object: plan.object, mode, externalIdField, count: plan.count, phrase, host: state.context.host };
    clear(target);
    target.append(resultTitle(`${mode[0].toUpperCase()}${mode.slice(1)} ${plan.object}`, `${plan.count} rows`));
    target.append(node('p', 'muted small', `Columns: ${plan.headers.join(', ')}. Previewing the first five rows. All ${plan.count} rows will be sent together with allOrNone enabled.`));
    target.append(table(plan.headers, plan.records.slice(0, 5).map(record => plan.headers.map(name => name.toLowerCase() === 'id' ? record.id : record[Object.keys(record).find(key => key.toLowerCase() === name.toLowerCase())] ?? ''))));
    $('#data-phrase').textContent = phrase;
    $('#data-confirm-input').value = '';
    $('#data-confirm').hidden = false;
  } catch (error) { notice(target, error.message, true); }
}

async function applyData() {
  const plan = state.dataPlan;
  if (!plan || plan.host !== state.context?.host) { toast('Review the CSV again for the active org.', true); return; }
  if ($('#data-confirm-input').value !== plan.phrase) { toast('Type the exact confirmation phrase.', true); return; }
  const button = $('#data-apply');
  const target = $('#data-result');
  button.disabled = true;
  notice(target, `Sending ${plan.count} rows to Salesforce…`);
  try {
    const { data } = await request('mutateRows', { csv: plan.csv, object: plan.object, mode: plan.mode, externalIdField: plan.externalIdField, confirm: plan.phrase, expectedHost: plan.host });
    clear(target);
    target.append(resultTitle('Salesforce result', `${data.succeeded} of ${data.count} succeeded`));
    const errors = data.outcomes.flatMap((row, index) => row.success ? [] : [{ row: index + 2, message: (row.errors || []).map(error => error.message || error.statusCode).join('; ') }]);
    if (errors.length) target.append(table(['CSV row', 'Error'], errors.map(error => [error.row, error.message])));
    else target.append(node('div', 'message', 'Operation completed. Refresh Salesforce to see the changes.'));
    state.dataPlan = null;
    $('#data-confirm').hidden = true;
  } catch (error) { notice(target, `${error.message} Check Salesforce before retrying in case the request succeeded but its response was lost.`, true); }
  finally { button.disabled = false; }
}

async function sendApiRequest() {
  const target = $('#api-result');
  const method = $('#api-method').value;
  const path = $('#api-path').value.trim();
  const body = $('#api-body').value;
  const confirm = $('#api-confirm').value;
  if (method !== 'GET' && confirm !== 'WRITE') { toast('Type WRITE to confirm the request.', true); return; }
  notice(target, `Sending ${method} request…`);
  try {
    const { data } = await request('apiExplore', { method, path, body, confirm, expectedHost: state.context?.host });
    clear(target);
    target.append(resultTitle(`${method} response`, path));
    target.append(node('pre', '', JSON.stringify(data, null, 2).slice(0, 100_000)));
    $('#api-confirm').value = '';
  } catch (error) { notice(target, error.message, true); }
}

async function searchSource() {
  const target = $('#source-result');
  notice(target, 'Scanning accessible source…');
  try {
    const { data } = await request('sourceSearch', { term: $('#source-term').value });
    clear(target);
    target.append(resultTitle('Source matches', `${data.matches.length} shown`));
    target.append(node('p', 'muted small', `Scanned up to ${data.scanCap} items per source type; this is not a full-org index.`));
    for (const warning of data.warnings) target.append(node('div', 'message', warning));
    if (!data.matches.length) target.append(node('div', 'message', 'No matches in the scanned source.'));
    for (const item of data.matches) {
      const row = node('div', 'component-row');
      row.append(node('strong', '', `${item.type} · ${item.name}`), node('small', '', item.excerpt));
      target.append(row);
    }
  } catch (error) { notice(target, error.message, true); }
}

function generateTestStarter() {
  try {
    const name = assertObjectName($('#test-class-name').value.trim());
    const source = `@IsTest\nprivate class ${name}Test {\n    @IsTest\n    static void testExpectedBehavior() {\n        // Arrange: create only the data this test needs.\n        Test.startTest();\n        // Act: call ${name} here.\n        Test.stopTest();\n        // Assert: replace this placeholder with a specific expected result.\n        System.assert(true, 'Replace with a meaningful assertion');\n    }\n}\n`;
    download(`${name}Test.cls`, source, 'text/plain');
    toast('Apex test starter downloaded. Replace the placeholders before deploying.');
  } catch (error) { toast(error.message, true); }
}

async function loadOrgTabs() {
  const target = $('#org-tabs');
  notice(target, 'Finding open org tabs…');
  try {
    const { data } = await request('orgTabs');
    clear(target);
    target.append(resultTitle('Open Salesforce tabs', `${data.length} found`));
    if (!data.length) target.append(node('div', 'message', 'No open Salesforce org tabs.'));
    for (const item of data) {
      const button = node('button', 'link-row');
      button.type = 'button';
      button.append(node('span', '', item.title), node('small', '', item.host));
      button.addEventListener('click', () => chrome.tabs.update(item.tabId, { active: true }));
      target.append(button);
    }
  } catch (error) { notice(target, error.message, true); }
}

async function saveOrgColor(reset = false) {
  if (!state.context) { toast('Open a Salesforce org tab first.', true); return; }
  const host = new URL(state.context.origin).host;
  if (reset) delete state.colors[host];
  else state.colors[host] = $('#org-color').value;
  await chrome.storage.local.set({ orgColors: state.colors });
  updateOrg(state.context, $('#org-state').textContent, $('#org-state').classList.contains('error'));
  toast(reset ? 'Automatic color restored.' : 'Org color saved.');
}

function renderMetadataResult(data, id) {
  const target = $('#metadata-result');
  clear(target);
  target.append(resultTitle('Metadata request', id || data?.id || 'Response'));
  const button = node('button', '', 'Refresh deployment status');
  button.type = 'button';
  button.disabled = !id;
  button.addEventListener('click', async () => {
    notice(target, 'Checking deployment status…');
    try {
      const response = await request('metadataStatus', { id });
      renderMetadataResult(response.data, id);
    } catch (error) { notice(target, error.message, true); }
  });
  target.append(button, node('pre', '', JSON.stringify(data, null, 2).slice(0, 100_000)));
}

async function deployMetadata() {
  const target = $('#metadata-result');
  const file = $('#metadata-file').files[0];
  const checkOnly = $('#metadata-check-only').checked;
  const phrase = checkOnly ? 'VALIDATE' : 'DEPLOY';
  if ($('#metadata-confirm').value !== phrase) { toast(`Type ${phrase} to start.`, true); return; }
  if (!file || file.size > 10_000_000 || !file.name.toLowerCase().endsWith('.zip')) { toast('Choose a metadata ZIP up to 10 MB.', true); return; }
  const button = $('#metadata-form button[type=submit]');
  button.disabled = true;
  notice(target, checkOnly ? 'Submitting validation…' : 'Submitting deployment…');
  try {
    const bytes = await file.arrayBuffer();
    const magic = new Uint8Array(bytes.slice(0, 4));
    if (magic[0] !== 0x50 || magic[1] !== 0x4b) throw new Error('This file is not a ZIP archive.');
    const zipBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read the ZIP file.'));
      reader.readAsDataURL(file);
    });
    const { data } = await request('metadataDeploy', { zipBase64, checkOnly, testLevel: $('#metadata-test-level').value, confirm: phrase, expectedHost: state.context?.host });
    renderMetadataResult(data, data.id);
    $('#metadata-confirm').value = '';
  } catch (error) { notice(target, `${error.message} Check deployment status in Salesforce before retrying.`, true); }
  finally { button.disabled = false; }
}

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => show(button.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => show(button.dataset.jump)));
$('#refresh').addEventListener('click', refresh);
$('#record-form').addEventListener('submit', event => { event.preventDefault(); inspectRecord($('#record-object').value.trim(), $('#record-id').value.trim()); });
$('#query-form').addEventListener('submit', event => { event.preventDefault(); runQuery(); });
$('#build-query').addEventListener('click', buildSimpleQuery);
$('#soql').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); runQuery(); } });
$('#export-csv').addEventListener('click', () => {
  if (state.query?.records?.length) download(`salesforce-query-${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + recordsToCsv(state.query.records), 'text/csv;charset=utf-8');
});
$('#object-filter').addEventListener('input', renderObjects);
$('#export-objects').addEventListener('click', () => {
  if (state.objects.length) download('salesforce-objects.csv', '\uFEFF' + recordsToCsv(state.objects.map(item => ({ Label: item.label, ApiName: item.name, Custom: item.custom, Queryable: item.queryable, Createable: item.createable, Updateable: item.updateable }))), 'text/csv;charset=utf-8');
});
$('#export-fields').addEventListener('click', () => {
  if (state.schema?.fields?.length) download(`${state.schema.name}-fields.csv`, '\uFEFF' + recordsToCsv(state.schema.fields.map(field => ({ Label: field.label, ApiName: field.name, Type: field.type, Length: field.length, Required: !field.nillable, Createable: field.createable, Updateable: field.updateable, ExternalId: field.externalId }))), 'text/csv;charset=utf-8');
});
$('#generate-fields').addEventListener('click', generateFields);
$('#data-mode').addEventListener('change', () => { $('#external-field-label').hidden = $('#data-mode').value !== 'upsert'; $('#data-confirm').hidden = true; state.dataPlan = null; });
for (const selector of ['#data-object', '#external-field', '#data-file']) $(selector).addEventListener('change', () => { $('#data-confirm').hidden = true; state.dataPlan = null; });
$('#data-form').addEventListener('submit', event => { event.preventDefault(); reviewData(); });
$('#data-apply').addEventListener('click', applyData);
$('#component-form').addEventListener('submit', event => { event.preventDefault(); findComponents(); });
$('#source-form').addEventListener('submit', event => { event.preventDefault(); searchSource(); });
$('#generate-test').addEventListener('click', generateTestStarter);
$('#load-logs').addEventListener('click', loadLogs);
$('#api-method').addEventListener('change', () => { $('#api-confirm-label').hidden = $('#api-method').value === 'GET'; $('#api-confirm').value = ''; });
$('#api-form').addEventListener('submit', event => { event.preventDefault(); sendApiRequest(); });
$('#metadata-check-only').addEventListener('change', () => { $('#metadata-phrase').textContent = $('#metadata-check-only').checked ? 'VALIDATE' : 'DEPLOY'; $('#metadata-confirm').value = ''; });
$('#metadata-form').addEventListener('submit', event => { event.preventDefault(); deployMetadata(); });
$('#load-org-tabs').addEventListener('click', loadOrgTabs);
$('#save-color').addEventListener('click', () => saveOrgColor());
$('#reset-color').addEventListener('click', () => saveOrgColor(true));
$('#link-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.context) { toast('Open a Salesforce org tab first.', true); return; }
  try {
    const item = { host: state.context.host, label: $('#link-label').value.trim(), path: assertRelativeSalesforcePath($('#link-path').value) };
    if (!item.label) throw new Error('Enter a label.');
    state.links.push(item);
    await chrome.storage.local.set({ customLinks: state.links });
    $('#link-form').reset();
    renderLinks();
    toast('Link saved for this org.');
  } catch (error) { toast(error.message, true); }
});
chrome.tabs.onActivated.addListener(() => { state.objects = []; refresh(); });
chrome.tabs.onUpdated.addListener((_id, info, tab) => { if (tab.active && info.url) { state.objects = []; refresh(); } });
chrome.storage.local.get({ customLinks: [], orgColors: {} }).then(({ customLinks, orgColors }) => {
  state.links = Array.isArray(customLinks) ? customLinks : [];
  state.colors = orgColors && typeof orgColors === 'object' ? orgColors : {};
  if (state.context) updateOrg(state.context, $('#org-state').textContent, $('#org-state').classList.contains('error'));
});
refresh();
