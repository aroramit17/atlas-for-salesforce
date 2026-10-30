import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMetadataRequest } from '../src/core/metadata.js';

test('metadata request has Salesforce JSON and ZIP multipart sections', async () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0, 1]);
  const boundary = 'atlas-12345678-abcd';
  const { body, contentType } = makeMetadataRequest(bytes, { checkOnly: true, singlePackage: true }, boundary);
  const payload = new Uint8Array(await body.arrayBuffer());
  const text = new TextDecoder().decode(payload);
  assert.equal(contentType, `multipart/form-data; boundary=${boundary}`);
  assert.match(text, /name="json"\r\nContent-Type: application\/json\r\n\r\n\{"deployOptions":\{"checkOnly":true,"singlePackage":true\}\}/);
  assert.match(text, /name="file"; filename="metadata.zip"\r\nContent-Type: application\/zip\r\n\r\nPK/);
  assert.match(text, /\r\n--atlas-12345678-abcd--\r\n$/);
});
