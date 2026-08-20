import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeVector, encodeVector, toFloat32, VectorFormatError } from '../src/float32.ts';

test('toFloat32 passes a Float32Array through unchanged', () => {
  const vec = new Float32Array([1, 2, 3]);
  assert.strictEqual(toFloat32(vec), vec);
});

test('toFloat32 converts a plain number array', () => {
  const vec = toFloat32([1, 2, 3]);
  assert.ok(vec instanceof Float32Array);
  assert.deepStrictEqual(Array.from(vec), [1, 2, 3]);
});

test('encode/decode roundtrips exact float32 bits', () => {
  const original = Float32Array.from({ length: 1536 }, (_, i) => Math.sin(i) * i);
  const decoded = decodeVector(encodeVector(original));
  assert.deepStrictEqual(decoded, original);
});

test('encode/decode roundtrips an empty vector', () => {
  const decoded = decodeVector(encodeVector(new Float32Array(0)));
  assert.strictEqual(decoded.length, 0);
});

test('encode/decode accepts a plain array and preserves float32 precision loss', () => {
  // 0.1 is not exactly representable in float32; the decoded value should
  // match what Float32Array itself produces, not the original double
  const decoded = decodeVector(encodeVector([0.1, 0.2, 0.3]));
  assert.deepStrictEqual(decoded, Float32Array.from([0.1, 0.2, 0.3]));
});

test('decodeVector rejects a truncated header', () => {
  assert.throws(() => decodeVector(Buffer.alloc(8)), VectorFormatError);
});

test('decodeVector rejects bad magic', () => {
  const buf = encodeVector([1, 2, 3]);
  buf.write('XXXX', 0, 4, 'ascii');
  assert.throws(() => decodeVector(buf), VectorFormatError);
});

test('decodeVector rejects an unsupported format version', () => {
  const buf = encodeVector([1, 2, 3]);
  buf.writeUInt8(99, 4);
  assert.throws(() => decodeVector(buf), VectorFormatError);
});

test('decodeVector rejects an unsupported dtype', () => {
  const buf = encodeVector([1, 2, 3]);
  buf.writeUInt8(2, 5);
  assert.throws(() => decodeVector(buf), VectorFormatError);
});

test('decodeVector rejects a length mismatch against the stored dim', () => {
  const buf = encodeVector([1, 2, 3]);
  buf.writeUInt32LE(4, 8); // claim 4 dims but the buffer only has 3
  assert.throws(() => decodeVector(buf), VectorFormatError);
});

test('decodeVector rejects a corrupted payload', () => {
  const buf = encodeVector([1, 2, 3]);
  buf.writeFloatLE(999, 16); // flip a payload byte without touching the crc
  assert.throws(() => decodeVector(buf), VectorFormatError);
});
