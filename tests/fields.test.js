import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldPackage } from '../src/core/fields.js';

test('field package builds a ZIP with a manifest and escaped definitions', () => {
  const result = fieldPackage('Object,ApiName,Label,Type,Length,Scale\nAccount,Atlas_Text__c,"A&B",Text,80,\nAccount,Atlas_Count__c,Count,Number,8,2\n');
  assert.equal(result.count, 2);
  assert.equal(result.objects, 1);
  assert.deepEqual([...result.zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const bytes = new TextDecoder().decode(result.zip);
  assert.match(bytes, /objects\/Account\.object/);
  assert.match(bytes, /Account\.Atlas_Text__c/);
  assert.match(bytes, /A&amp;B/);
  assert.match(bytes, /<precision>8<\/precision><scale>2<\/scale>/);
});

test('field package rejects invalid fields and dimensions', () => {
  const head = 'Object,ApiName,Label,Type,Length,Scale\n';
  assert.throws(() => fieldPackage(head + 'Account,Wrong,Wrong,Text,80,'));
  assert.throws(() => fieldPackage(head + 'Account,Atlas_Test__c,Test,Text,999,'));
  assert.throws(() => fieldPackage(head + 'Account,Atlas_Test__c,Test,Number,3,3'));
  assert.throws(() => fieldPackage(head + 'Account,Atlas_Test__c,Test,Picklist,,'));
});
