export const API_VERSION = 'v61.0';
export const MAX_EXPORT_ROWS = 10000;

const OBJECT_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const RECORD_ID = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;

export function salesforceContext(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  let apiHost = host;
  if (host.endsWith('.lightning.force.com')) {
    apiHost = host.replace(/\.lightning\.force\.com$/, '.my.salesforce.com');
  } else if (host.endsWith('.visual.force.com')) {
    return null;
  } else if (!host.endsWith('.salesforce.com')) {
    return null;
  }
  if (['login.salesforce.com', 'test.salesforce.com', 'help.salesforce.com'].includes(apiHost)) return null;
  if (!apiHost.endsWith('.salesforce.com')) return null;
  const match = url.pathname.match(/\/lightning\/r\/([A-Za-z][A-Za-z0-9_]*)\/([A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?)\/view(?:\/|$)/);
  const record = match ? { object: match[1], id: match[2] } : null;
  return { host, origin: `https://${apiHost}`, record, label: host.split('.')[0].replace(/--/g, ' / ') };
}

export function assertObjectName(value) {
  if (typeof value !== 'string' || !OBJECT_NAME.test(value)) throw new Error('Choose a valid Salesforce object.');
  return value;
}

export function assertRecordId(value) {
  if (typeof value !== 'string' || !RECORD_ID.test(value)) throw new Error('Enter a 15 or 18 character Salesforce record ID.');
  return value;
}

export function assertReadOnlySoql(value) {
  const query = String(value ?? '').trim();
  if (!/^SELECT\s+/i.test(query) || query.length > 10000 || query.includes(';') || /\bFOR\s+UPDATE\b/i.test(query)) {
    throw new Error('Enter one read-only SELECT query (maximum 10,000 characters).');
  }
  return query;
}

export function assertRelativeSalesforcePath(value) {
  const path = String(value ?? '').trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\x00-\x1f]/.test(path)) {
    throw new Error('Use a Salesforce path starting with one slash.');
  }
  return path;
}

export function soqlString(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

export function isSafeNextUrl(path) {
  return typeof path === 'string' && /^\/services\/data\/v[0-9]+\.[0-9]+\/(?:query|tooling\/query)\/[A-Za-z0-9-]+(?:\?.*)?$/.test(path);
}

export function assertApiPath(value) {
  const path = String(value || '').trim();
  if (!path.startsWith(`/services/data/${API_VERSION}/`) || path.startsWith('//') || path.includes('\\') || path.includes('#') || /[\x00-\x20]/.test(path)) {
    throw new Error(`Use a relative /services/data/${API_VERSION}/ path.`);
  }
  const url = new URL(path, 'https://example.salesforce.com');
  if (url.origin !== 'https://example.salesforce.com' || !url.pathname.startsWith(`/services/data/${API_VERSION}/`)) throw new Error('Blocked an unexpected API path.');
  return `${url.pathname}${url.search}`;
}

export function orgColor(host) {
  let hash = 2166136261;
  for (const char of host) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ['#1b7a72', '#2563a5', '#8b5cba', '#b15c4a', '#94712e', '#357a4c'][(hash >>> 0) % 6];
}
