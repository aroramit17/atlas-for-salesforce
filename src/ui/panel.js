import { recordsToCsv, flattenValue } from '../core/csv.js';
import { assertRelativeSalesforcePath, orgColor } from '../core/salesforce.js';

const $ = selector => document.querySelector(selector);
const state = { context: null, objects: [], query: null, links: [], toastTimer: null, refreshId: 0 };
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
  if (type !== 'context' && state.context && response.context?.host !== state.context.host) {
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
}
function updateOrg(context, status = 'Session found', error = false) {
  state.context = context;
  $('#org-name').textContent = context ? context.label : 'No Salesforce org';
  $('#org-status').textContent = context ? context.host : 'Open an authenticated Salesforce tab';
  $('#org-state').textContent = error ? 'Unavailable' : context ? status : 'Waiting';
  $('#org-state').classList.toggle('error', error);
  $('#org-dot').style.background = context ? orgColor(context.host) : '#93a6a6';
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

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => show(button.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => show(button.dataset.jump)));
$('#refresh').addEventListener('click', refresh);
$('#record-form').addEventListener('submit', event => { event.preventDefault(); inspectRecord($('#record-object').value.trim(), $('#record-id').value.trim()); });
$('#query-form').addEventListener('submit', event => { event.preventDefault(); runQuery(); });
$('#soql').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); runQuery(); } });
$('#export-csv').addEventListener('click', () => {
  if (state.query?.records?.length) download(`salesforce-query-${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + recordsToCsv(state.query.records), 'text/csv;charset=utf-8');
});
$('#object-filter').addEventListener('input', renderObjects);
$('#component-form').addEventListener('submit', event => { event.preventDefault(); findComponents(); });
$('#load-logs').addEventListener('click', loadLogs);
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
chrome.storage.local.get({ customLinks: [] }).then(({ customLinks }) => { state.links = Array.isArray(customLinks) ? customLinks : []; });
refresh();
