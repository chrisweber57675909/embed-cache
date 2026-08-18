import { createHash } from 'node:crypto';

export function embedKey(namespace: string, model: string, text: string): string {
  // JSON-encode as an array rather than joining with a delimiter, so that
  // e.g. namespace "a" + model "bc" can never collide with namespace "ab" + model "c"
  const material = JSON.stringify([namespace, model, text]);
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

export function keyToSegments(key: string): [string, string, string] {
  if (key.length < 5) {
    throw new RangeError(`key too short to shard into directories: "${key}"`);
  }
  return [key.slice(0, 2), key.slice(2, 4), key.slice(4)];
}
