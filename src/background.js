import { API_VERSION, MAX_EXPORT_ROWS, salesforceContext, assertObjectName, assertRecordId, assertReadOnlySoql, soqlString, isSafeNextUrl } from './core/salesforce.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

async function activeContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const context = tab?.url && salesforceContext(tab.url);
  if (!context) throw new Error('Open a Salesforce org tab, then try again.');
  return { ...context, tabId: tab.id, tabUrl: tab.url };
}

async function cookieStoreId(tabId) {
  const stores = await chrome.cookies.getAllCookieStores();
  return stores.find(store => store.tabIds.includes(tabId))?.id;
}

async function sessionFor(context) {
  const storeId = await cookieStoreId(context.tabId);
  const options = storeId ? { storeId } : {};
  const candidates = [context.origin, new URL(context.tabUrl).origin];
  for (const origin of new Set(candidates)) {
    const cookie = await chrome.cookies.get({ url: `${origin}/`, name: 'sid', ...options });
    if (cookie?.value) return cookie.value;
  }
  throw new Error('No Salesforce session cookie was found for this tab. Sign in to the org and reload it.');
}

async function api(context, path, { text = false } = {}) {
  if (!path.startsWith('/services/data/') || path.startsWith('//')) throw new Error('Blocked an unexpected API path.');
  const token = await sessionFor(context);
  const response = await fetch(`${context.origin}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: text ? 'text/plain' : 'application/json' },
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer'
  });
  const raw = await response.text();
  if (!response.ok) {
    let detail = raw;
    try {
      const payload = JSON.parse(raw);
      detail = Array.isArray(payload) ? payload.map(item => item.message || item.errorCode).join('; ') : payload.message || raw;
    } catch { /* use response text */ }
    throw new Error(`Salesforce API ${response.status}: ${String(detail).slice(0, 300)}`);
  }
  if (text) return raw;
  try { return JSON.parse(raw); } catch { throw new Error('Salesforce returned an unreadable response.'); }
}

async function queryAll(context, soql, tooling = false) {
  const base = `/services/data/${API_VERSION}/${tooling ? 'tooling/' : ''}query`;
  let next = `${base}?q=${encodeURIComponent(soql)}`;
  const records = [];
  let totalSize = 0;
  let done = false;
  let pages = 0;
  while (next && records.length < MAX_EXPORT_ROWS && pages < 20) {
    const result = await api(context, next);
    records.push(...(result.records || []).slice(0, MAX_EXPORT_ROWS - records.length));
    totalSize = result.totalSize ?? records.length;
    done = Boolean(result.done);
    next = result.nextRecordsUrl;
    if (next && !isSafeNextUrl(next)) throw new Error('Salesforce returned an unexpected query cursor.');
    pages++;
  }
  return { records, totalSize, truncated: !done, rowCap: MAX_EXPORT_ROWS };
}

async function handle(message) {
  const context = await activeContext();
  const base = `/services/data/${API_VERSION}`;
  switch (message?.type) {
    case 'context': return { context };
    case 'limits': return { context, data: await api(context, `${base}/limits`) };
    case 'objects': return { context, data: await api(context, `${base}/sobjects/`) };
    case 'describe': return { context, data: await api(context, `${base}/sobjects/${encodeURIComponent(assertObjectName(message.object))}/describe/`) };
    case 'record': {
      const object = assertObjectName(message.object);
      const id = assertRecordId(message.id);
      return { context, data: await api(context, `${base}/sobjects/${encodeURIComponent(object)}/${encodeURIComponent(id)}`) };
    }
    case 'query': return { context, data: await queryAll(context, assertReadOnlySoql(message.soql)) };
    case 'components': {
      const term = String(message.term || '').trim();
      if (!term || term.length > 80) throw new Error('Enter a component name to find.');
      const pattern = `%${soqlString(term)}%`;
      const types = [
        ['Apex class', 'ApexClass'], ['Apex trigger', 'ApexTrigger'], ['Visualforce page', 'ApexPage']
      ];
      const results = await Promise.all(types.map(async ([label, object]) => {
        const result = await queryAll(context, `SELECT Id, Name FROM ${object} WHERE Name LIKE '${pattern}' ORDER BY Name LIMIT 50`, true);
        return result.records.map(row => ({ id: row.Id, name: row.Name, type: label }));
      }));
      return { context, data: results.flat() };
    }
    case 'logs': return { context, data: await queryAll(context, 'SELECT Id, LogUser.Name, Operation, Status, StartTime, LogLength FROM ApexLog ORDER BY StartTime DESC LIMIT 30', true) };
    case 'logBody': return { context, data: await api(context, `${base}/tooling/sobjects/ApexLog/${encodeURIComponent(assertRecordId(message.id))}/Body`, { text: true }) };
    default: throw new Error('Unknown operation.');
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message).then(value => sendResponse({ ok: true, ...value })).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
