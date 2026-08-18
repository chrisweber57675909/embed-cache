import { crc32 } from 'node:zlib';

const MAGIC = 'EMBC';
const FORMAT_VERSION = 1;
const DTYPE_FLOAT32 = 1;
const HEADER_SIZE = 16;

export class VectorFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VectorFormatError';
  }
}

export function toFloat32(vector: Float32Array | ArrayLike<number>): Float32Array {
  return vector instanceof Float32Array ? vector : Float32Array.from(vector);
}

export function encodeVector(vector: Float32Array | ArrayLike<number>): Buffer {
  const vec = toFloat32(vector);
  const dim = vec.length;
  const buf = Buffer.allocUnsafe(HEADER_SIZE + dim * 4);

  buf.write(MAGIC, 0, 4, 'ascii');
  buf.writeUInt8(FORMAT_VERSION, 4);
  buf.writeUInt8(DTYPE_FLOAT32, 5);
  buf.writeUInt16LE(0, 6); // reserved
  buf.writeUInt32LE(dim, 8);

  for (let i = 0; i < dim; i++) {
    buf.writeFloatLE(vec[i], HEADER_SIZE + i * 4);
  }

  // crc goes in after the payload is written, since it covers the payload
  buf.writeUInt32LE(crc32(buf.subarray(HEADER_SIZE)), 12);

  return buf;
}

export function decodeVector(buf: Buffer): Float32Array {
  if (buf.length < HEADER_SIZE) {
    throw new VectorFormatError(`truncated header: ${buf.length} byte(s)`);
  }
  if (buf.toString('ascii', 0, 4) !== MAGIC) {
    throw new VectorFormatError('bad magic');
  }

  const version = buf.readUInt8(4);
  if (version !== FORMAT_VERSION) {
    throw new VectorFormatError(`unsupported format version ${version}`);
  }

  const dtype = buf.readUInt8(5);
  if (dtype !== DTYPE_FLOAT32) {
    throw new VectorFormatError(`unsupported dtype ${dtype}`);
  }

  const dim = buf.readUInt32LE(8);
  if (buf.length !== HEADER_SIZE + dim * 4) {
    throw new VectorFormatError(`length mismatch for dim ${dim}: ${buf.length} byte(s)`);
  }

  const payload = buf.subarray(HEADER_SIZE);
  const storedCrc = buf.readUInt32LE(12);
  if (crc32(payload) !== storedCrc) {
    throw new VectorFormatError('checksum mismatch');
  }

  // read element-by-element rather than viewing the buffer directly, since a
  // Buffer's byte offset into its underlying ArrayBuffer isn't guaranteed to
  // be 4-byte aligned and a misaligned Float32Array view throws
  const vector = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    vector[i] = buf.readFloatLE(HEADER_SIZE + i * 4);
  }
  return vector;
}
