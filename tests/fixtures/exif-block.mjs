// Builds EXIF the way a phone writes it, for the sample files and the unit tests.

/** A little-endian TIFF block with a camera, a time and a GPS position (Hamburg, the Rathaus). */
export function exifBlock({ make = 'Apple', model = 'iPhone 15', time = '2026:10:31 14:05:09', lat = [53, 33, 1.2], lon = [9, 59, 31.4] } = {}) {
  const ascii = (s) => Buffer.from(`${s}\0`, 'latin1');
  const parts = { make: ascii(make), model: ascii(model), time: ascii(time) };
  // Layout: header 8, IFD0 (4 entries), its data, the GPS IFD (4 entries), its rationals.
  const ifd0At = 8;
  const ifd0Size = 2 + 4 * 12 + 4;
  let at = ifd0At + ifd0Size;
  const makeAt = at; at += parts.make.length;
  const modelAt = at; at += parts.model.length;
  const timeAt = at; at += parts.time.length;
  if (at % 2) at++;
  const gpsAt = at;
  const gpsSize = 2 + 4 * 12 + 4;
  at += gpsSize;
  const latAt = at; at += 24;
  const lonAt = at; at += 24;
  const b = Buffer.alloc(at);
  b.write('II', 0, 'latin1');
  b.writeUInt16LE(42, 2);
  b.writeUInt32LE(ifd0At, 4);
  const entry = (base, i, tag, type, count, value) => {
    const o = base + 2 + i * 12;
    b.writeUInt16LE(tag, o);
    b.writeUInt16LE(type, o + 2);
    b.writeUInt32LE(count, o + 4);
    if (typeof value === 'number') b.writeUInt32LE(value, o + 8);
    else value.copy(b, o + 8);
  };
  b.writeUInt16LE(4, ifd0At);
  entry(ifd0At, 0, 0x010f, 2, parts.make.length, makeAt);
  entry(ifd0At, 1, 0x0110, 2, parts.model.length, modelAt);
  entry(ifd0At, 2, 0x0132, 2, parts.time.length, timeAt);
  entry(ifd0At, 3, 0x8825, 4, 1, gpsAt);
  b.writeUInt32LE(0, ifd0At + 2 + 4 * 12);
  parts.make.copy(b, makeAt);
  parts.model.copy(b, modelAt);
  parts.time.copy(b, timeAt);
  b.writeUInt16LE(4, gpsAt);
  entry(gpsAt, 0, 0x0001, 2, 2, Buffer.from('N\0\0\0', 'latin1'));
  entry(gpsAt, 1, 0x0002, 5, 3, latAt);
  entry(gpsAt, 2, 0x0003, 2, 2, Buffer.from('E\0\0\0', 'latin1'));
  entry(gpsAt, 3, 0x0004, 5, 3, lonAt);
  b.writeUInt32LE(0, gpsAt + 2 + 4 * 12);
  const rationals = (o, [d, m, s]) => {
    for (const [i, [num, den]] of [[d, 1], [m, 1], [Math.round(s * 100), 100]].entries()) {
      b.writeUInt32LE(num, o + i * 8);
      b.writeUInt32LE(den, o + i * 8 + 4);
    }
  };
  rationals(latAt, lat);
  rationals(lonAt, lon);
  return new Uint8Array(b);
}

/** The JPG with an APP1 Exif segment right after its start marker. */
export function withExif(jpeg, tiff) {
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(tiff)]);
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xffe1, 0);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([Buffer.from(jpeg.subarray(0, 2)), head, body, Buffer.from(jpeg.subarray(2))]);
}
