// Small, dependency-free ZIP writer for generated Metadata API XML packages.
// Stored entries are uncompressed; deployment ZIPs uploaded by users are not parsed here.
const encoder = new TextEncoder();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function header(size) { return new Uint8Array(size); }
function write16(view, offset, value) { view.setUint16(offset, value, true); }
function write32(view, offset, value) { view.setUint32(offset, value, true); }

export function makeZip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const path = encoder.encode(name);
    const body = encoder.encode(content);
    if (!name || name.includes('..') || name.startsWith('/') || path.length > 65535) throw new Error('Invalid ZIP entry name.');
    const checksum = crc32(body);
    const part = header(30 + path.length + body.length);
    const view = new DataView(part.buffer);
    write32(view, 0, 0x04034b50); write16(view, 4, 20); write16(view, 6, 0x800);
    write32(view, 14, checksum); write32(view, 18, body.length); write32(view, 22, body.length);
    write16(view, 26, path.length); part.set(path, 30); part.set(body, 30 + path.length);
    local.push(part);
    const entry = header(46 + path.length);
    const index = new DataView(entry.buffer);
    write32(index, 0, 0x02014b50); write16(index, 4, 20); write16(index, 6, 20); write16(index, 8, 0x800);
    write32(index, 16, checksum); write32(index, 20, body.length); write32(index, 24, body.length);
    write16(index, 28, path.length); write32(index, 42, offset); entry.set(path, 46);
    central.push(entry);
    offset += part.length;
  }
  if (!central.length || central.length > 65535) throw new Error('ZIP entry count is out of range.');
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = header(22);
  const view = new DataView(end.buffer);
  write32(view, 0, 0x06054b50); write16(view, 8, central.length); write16(view, 10, central.length);
  write32(view, 12, centralSize); write32(view, 16, offset);
  const out = header(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...local, ...central, end]) { out.set(part, at); at += part.length; }
  return out;
}
