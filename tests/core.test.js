import test from 'node:test';
import assert from 'node:assert/strict';
import { salesforceContext, assertObjectName, assertRecordId, assertReadOnlySoql, assertRelativeSalesforcePath, assertApiPath, isSafeNextUrl, orgColor } from '../src/core/salesforce.js';
import { recordsToCsv } from '../src/core/csv.js';

test('maps Lightning production and sandbox tabs to their API host', () => {
  const production = salesforceContext('https://acme.lightning.force.com/lightning/r/Account/001000000000000AAA/view');
  assert.equal(production.origin, 'https://acme.my.salesforce.com');
  assert.deepEqual(production.record, { object: 'Account', id: '001000000000000AAA' });
  const sandbox = salesforceContext('https://acme--qa.sandbox.lightning.force.com/lightning/page/home');
  assert.equal(sandbox.origin, 'https://acme--qa.sandbox.my.salesforce.com');
});

test('rejects non-org sites and dangerous paths', () => {
  assert.equal(salesforceContext('https://example.com/'), null);
  assert.equal(salesforceContext('http://acme.my.salesforce.com/'), null);
  assert.equal(salesforceContext('https://login.salesforce.com/'), null);
  assert.throws(() => assertRelativeSalesforcePath('//evil.example/'));
  assert.throws(() => assertRelativeSalesforcePath('/\\evil'));
  assert.equal(assertRelativeSalesforcePath('/lightning/page/home'), '/lightning/page/home');
});

test('validates Salesforce identifiers and read-only query form', () => {
  assert.equal(assertObjectName('Custom__c'), 'Custom__c');
  assert.throws(() => assertObjectName('../Account'));
  assert.equal(assertRecordId('001000000000000AAA'), '001000000000000AAA');
  assert.throws(() => assertRecordId('not-a-record'));
  assert.equal(assertReadOnlySoql(' SELECT Id FROM Account '), 'SELECT Id FROM Account');
  assert.throws(() => assertReadOnlySoql('DELETE FROM Account'));
  assert.throws(() => assertReadOnlySoql('SELECT Id FROM Account; DELETE'));
  assert.throws(() => assertReadOnlySoql('SELECT Id FROM Account FOR UPDATE'));
});

test('accepts only relative Salesforce query cursors', () => {
  assert.equal(isSafeNextUrl('/services/data/v61.0/query/01g000000000000-2000'), true);
  assert.equal(isSafeNextUrl('https://evil.example/'), false);
  assert.equal(isSafeNextUrl('//evil.example/services/data/v61.0/query/x'), false);
  assert.equal(isSafeNextUrl('/services/data/v61.0/sobjects/Account'), false);
});

test('REST workbench stays on the versioned Salesforce API path', () => {
  assert.equal(assertApiPath('/services/data/v61.0/limits?x=1'), '/services/data/v61.0/limits?x=1');
  assert.throws(() => assertApiPath('https://evil.example/services/data/v61.0/limits'));
  assert.throws(() => assertApiPath('/services/data/v61.0/../../Soap/m/61.0'));
  assert.throws(() => assertApiPath('//evil.example/services/data/v61.0/limits'));
});

test('CSV escapes quotes, unions columns, and guards spreadsheet formulas', () => {
  const csv = recordsToCsv([{ Name: 'Acme, "North"', Amount: '=2+2', attributes: {} }, { Name: 'Beta', Other: 'line\nbreak' }]);
  assert.match(csv, /^"Name","Amount","Other"\r\n/);
  assert.match(csv, /"Acme, ""North""","'=2\+2",""/);
  assert.match(csv, /"line\nbreak"/);
});

test('org mark color is stable', () => {
  assert.equal(orgColor('acme.lightning.force.com'), orgColor('acme.lightning.force.com'));
  assert.match(orgColor('acme.lightning.force.com'), /^#[0-9a-f]{6}$/);
});
