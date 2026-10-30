import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, prepareMutation } from '../src/core/import.js';

const describe = { fields: [
  { name: 'Name', createable: true, updateable: true },
  { name: 'Description', createable: true, updateable: true },
  { name: 'External_Id__c', createable: true, updateable: true, externalId: true },
  { name: 'CreatedDate', createable: false, updateable: false }
] };

test('CSV parser handles quotes, newlines, BOM, and rejects uneven rows', () => {
  const parsed = parseCsv('\uFEFFName,Description\r\n"Acme, Inc.","first\nsecond"\r\n');
  assert.deepEqual(parsed.headers, ['Name', 'Description']);
  assert.deepEqual(parsed.rows, [['Acme, Inc.', 'first\nsecond']]);
  assert.throws(() => parseCsv('Name,Description\nAcme'));
  assert.throws(() => parseCsv('Name,Name\nA,B'));
});

test('mutation preparation honors field permissions and operation keys', () => {
  const create = prepareMutation('Name,Description\nAcme,#NULL', 'Account', 'create', describe);
  assert.deepEqual(create.records[0], { attributes: { type: 'Account' }, Name: 'Acme', Description: null });
  assert.throws(() => prepareMutation('CreatedDate\n2026-01-01', 'Account', 'create', describe));
  assert.throws(() => prepareMutation('Name\nAcme', 'Account', 'update', describe));
  const update = prepareMutation('Id,Name\n001000000000000AAA,New name', 'Account', 'update', describe);
  assert.equal(update.records[0].id, '001000000000000AAA');
  const upsert = prepareMutation('External_Id__c,Name\nA-1,Acme', 'Account', 'upsert', describe, 'External_Id__c');
  assert.equal(upsert.records[0].External_Id__c, 'A-1');
  assert.throws(() => prepareMutation('Name\nAcme', 'Account', 'upsert', describe, 'External_Id__c'));
  assert.throws(() => prepareMutation('Id,External_Id__c\n001000000000000AAA,A-1', 'Account', 'upsert', describe, 'External_Id__c'));
  assert.throws(() => prepareMutation('Name\nAcme', 'Account', 'create', { ...describe, createable: false }));
});

test('delete requires only valid IDs and operations have a 200-row cap', () => {
  const plan = prepareMutation('Id\n001000000000000AAA', 'Account', 'delete', describe);
  assert.equal(plan.count, 1);
  assert.throws(() => prepareMutation('Id,Name\n001000000000000AAA,Acme', 'Account', 'delete', describe));
  assert.throws(() => prepareMutation('Id\ninvalid', 'Account', 'delete', describe));
  assert.throws(() => parseCsv(`Name\n${'Acme\n'.repeat(201)}`));
});
