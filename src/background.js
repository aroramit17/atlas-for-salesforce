import { API_VERSION, MAX_EXPORT_ROWS, salesforceContext, assertObjectName, assertRecordId, assertReadOnlySoql, assertApiPath, soqlString, isSafeNextUrl } from './core/salesforce.js';
import { prepareMutation } from './core/import.js';
import { makeMetadataRequest } from './core/metadata.js';

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

async function api(context, path, { text = false, method = 'GET', body } = {}) {
  if (!path.startsWith('/services/data/') || path.startsWith('//')) throw new Error('Blocked an unexpected API path.');
  const token = await sessionFor(context);
  const response = await fetch(`${context.origin}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: text ? 'text/plain' : 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
  if (!raw) return {};
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
  let context;
  try { context = await activeContext(); }
  catch (error) { if (message?.type !== 'orgTabs') throw error; }
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
    case 'orgTabs': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return { context, data: tabs.flatMap(tab => {
        const item = tab.url && salesforceContext(tab.url);
        return item ? [{ tabId: tab.id, host: item.host, label: item.label, title: tab.title || item.label, active: tab.active }] : [];
      }) };
    }
    case 'mutateRows': {
      if (context.host !== message.expectedHost) throw new Error('The active org changed. Review the CSV again.');
      const object = assertObjectName(message.object);
      const describe = await api(context, `${base}/sobjects/${encodeURIComponent(object)}/describe/`);
      const plan = prepareMutation(message.csv, object, message.mode, describe, message.externalIdField);
      if (message.confirm !== `APPLY ${plan.count} ${object}`) throw new Error('Type the exact confirmation shown in the review.');
      let result;
      if (plan.mode === 'delete') {
        const ids = plan.records.map(row => row.id).join(',');
        result = await api(context, `${base}/composite/sobjects?ids=${ids}&allOrNone=true`, { method: 'DELETE' });
      } else {
        const path = plan.mode === 'upsert'
          ? `${base}/composite/sobjects/${encodeURIComponent(object)}/${encodeURIComponent(plan.externalIdField)}`
          : `${base}/composite/sobjects`;
        result = await api(context, path, { method: plan.mode === 'create' ? 'POST' : 'PATCH', body: { allOrNone: true, records: plan.records } });
      }
      const outcomes = Array.isArray(result) ? result : result?.results || [];
      return { context, data: { count: plan.count, succeeded: outcomes.filter(row => row.success).length, outcomes } };
    }
    case 'apiExplore': {
      if (context.host !== message.expectedHost) throw new Error('The active org changed. Review the API request again.');
      const method = String(message.method || '').toUpperCase();
      if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) throw new Error('Choose an allowed HTTP method.');
      const path = assertApiPath(message.path);
      if (method !== 'GET' && message.confirm !== 'WRITE') throw new Error('Type WRITE to confirm this API request.');
      const rawBody = String(message.body || '').trim();
      if (rawBody.length > 100_000) throw new Error('Limit the JSON body to 100 KB.');
      let body;
      if (rawBody) { try { body = JSON.parse(rawBody); } catch { throw new Error('The request body must be valid JSON.'); } }
      if (method === 'GET' && body !== undefined) throw new Error('Remove the JSON body from a GET request.');
      return { context, data: await api(context, path, { method, body }) };
    }
    case 'metadataDeploy': {
      if (context.host !== message.expectedHost) throw new Error('The active org changed. Review the deployment again.');
      const checkOnly = message.checkOnly === true;
      if (message.confirm !== (checkOnly ? 'VALIDATE' : 'DEPLOY')) throw new Error('Type the exact deployment confirmation.');
      const testLevel = String(message.testLevel || 'RunLocalTests');
      if (!['NoTestRun', 'RunLocalTests', 'RunAllTestsInOrg'].includes(testLevel)) throw new Error('Choose a supported test level.');
      const encoded = String(message.zipBase64 || '');
      if (!/^UEs[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length > 14_000_000) throw new Error('Choose a metadata ZIP up to 10 MB.');
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      if (bytes.length > 10_000_000) throw new Error('Choose a metadata ZIP up to 10 MB.');
      const boundary = `atlas-${crypto.randomUUID()}`;
      const { body, contentType } = makeMetadataRequest(bytes, { checkOnly, singlePackage: true, rollbackOnError: true, testLevel }, boundary);
      const token = await sessionFor(context);
      const response = await fetch(`${context.origin}${base}/metadata/deployRequest`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': contentType }, body,
        credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`Metadata API ${response.status}: ${raw.slice(0, 400)}`);
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error('Salesforce returned an unreadable deployment response.'); }
      return { context, data };
    }
    case 'metadataStatus': {
      const id = assertRecordId(message.id);
      return { context, data: await api(context, `${base}/metadata/deployRequest/${id}?includeDetails=true`) };
    }
    case 'sourceSearch': {
      const term = String(message.term || '').trim();
      if (term.length < 3 || term.length > 80) throw new Error('Enter 3–80 characters to search source.');
      const types = [
        ['Apex class', 'ApexClass', 'Body', 'Name'],
        ['Apex trigger', 'ApexTrigger', 'Body', 'Name'],
        ['Visualforce page', 'ApexPage', 'Markup', 'Name'],
        ['Lightning resource', 'LightningComponentResource', 'Source', 'FilePath']
      ];
      const settled = await Promise.allSettled(types.map(async ([label, object, field, name]) => {
        const data = await queryAll(context, `SELECT Id, ${name}, ${field} FROM ${object} LIMIT 500`, true);
        return (data.records || []).flatMap(row => {
          const source = String(row[field] || '');
          const at = source.toLowerCase().indexOf(term.toLowerCase());
          if (at < 0) return [];
          return [{ id: row.Id, name: row[name] || row.Id, type: label, excerpt: source.slice(Math.max(0, at - 90), Math.min(source.length, at + term.length + 90)) }];
        });
      }));
      return { context, data: { matches: settled.flatMap(item => item.status === 'fulfilled' ? item.value : []).slice(0, 100), warnings: settled.flatMap((item, index) => item.status === 'rejected' ? [`${types[index][0]}: ${item.reason.message}`] : []), scanCap: 500 } };
    }
    default: throw new Error('Unknown operation.');
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message).then(value => sendResponse({ ok: true, ...value })).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
