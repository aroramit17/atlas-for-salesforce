export function makeMetadataRequest(bytes, deployOptions, boundary) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || !/^atlas-[a-f0-9-]+$/i.test(boundary)) throw new Error('Invalid metadata request.');
  const body = new Blob([
    `--${boundary}\r\nContent-Disposition: form-data; name="json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ deployOptions })}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="metadata.zip"\r\nContent-Type: application/zip\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--\r\n`
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}
