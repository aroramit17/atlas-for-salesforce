import { parseCsv } from './import.js';
import { assertObjectName } from './salesforce.js';
import { makeZip } from './zip.js';

const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export function fieldPackage(source) {
  const { headers, rows } = parseCsv(source);
  const expected = ['Object', 'ApiName', 'Label', 'Type', 'Length', 'Scale'];
  if (headers.join(',').toLowerCase() !== expected.join(',').toLowerCase()) throw new Error(`Use CSV headers: ${expected.join(',')}.`);
  const groups = new Map(), members = new Set();
  for (const values of rows) {
    const [rawObject, rawName, rawLabel, rawType, rawLength, rawScale] = values.map(value => value.trim());
    const object = assertObjectName(rawObject);
    const name = assertObjectName(rawName);
    if (!name.endsWith('__c')) throw new Error(`${name} must end with __c.`);
    const label = rawLabel;
    if (!label || label.length > 40) throw new Error(`Give ${name} a label of 1–40 characters.`);
    const type = ['Text', 'Number', 'Checkbox', 'Date'].find(value => value.toLowerCase() === rawType.toLowerCase());
    if (!type) throw new Error(`${name}: choose Text, Number, Checkbox, or Date.`);
    const fullName = `${object}.${name}`;
    if (members.has(fullName)) throw new Error(`${fullName} appears more than once.`);
    members.add(fullName);
    let details = '';
    if (type === 'Text') {
      const length = Number(rawLength);
      if (!Number.isInteger(length) || length < 1 || length > 255) throw new Error(`${name}: Text length must be 1–255.`);
      details = `<length>${length}</length>`;
    } else if (type === 'Number') {
      const precision = Number(rawLength), scale = Number(rawScale || '0');
      if (!Number.isInteger(precision) || precision < 1 || precision > 18 || !Number.isInteger(scale) || scale < 0 || scale >= precision) throw new Error(`${name}: Number needs precision 1–18 and a smaller scale.`);
      details = `<precision>${precision}</precision><scale>${scale}</scale>`;
    } else if (type === 'Checkbox') details = '<defaultValue>false</defaultValue>';
    const xml = `<fields><fullName>${escapeXml(name)}</fullName><label>${escapeXml(label)}</label><type>${type}</type>${details}</fields>`;
    groups.set(object, [...(groups.get(object) || []), xml]);
  }
  const files = [];
  for (const [object, fields] of groups) files.push([`objects/${object}.object`, `<?xml version="1.0" encoding="UTF-8"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">${fields.join('')}</CustomObject>`]);
  files.push(['package.xml', `<?xml version="1.0" encoding="UTF-8"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types>${[...members].map(name => `<members>${escapeXml(name)}</members>`).join('')}<name>CustomField</name></types><version>61.0</version></Package>`]);
  return { zip: makeZip(files), count: members.size, objects: groups.size };
}
