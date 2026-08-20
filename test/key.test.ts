import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedKey, keyToSegments } from '../src/key.ts';

test('embedKey is deterministic', () => {
  assert.strictEqual(embedKey('ns', 'model', 'text'), embedKey('ns', 'model', 'text'));
});

test('embedKey is a 64-character hex sha256 digest', () => {
  const key = embedKey('ns', 'model', 'text');
  assert.match(key, /^[0-9a-f]{64}$/);
});

test('embedKey differs when namespace, model, or text differ', () => {
  const base = embedKey('ns', 'model', 'text');
  assert.notStrictEqual(embedKey('other', 'model', 'text'), base);
  assert.notStrictEqual(embedKey('ns', 'other', 'text'), base);
  assert.notStrictEqual(embedKey('ns', 'model', 'other'), base);
});

test('embedKey does not collide across a shifted namespace/model boundary', () => {
  // if the parts were joined with a plain delimiter, "a"+"bc" would equal "ab"+"c"
  assert.notStrictEqual(embedKey('a', 'bc', 'text'), embedKey('ab', 'c', 'text'));
});

test('keyToSegments splits into a 2/2/rest shard path', () => {
  const key = embedKey('ns', 'model', 'text');
  const [a, b, rest] = keyToSegments(key);
  assert.strictEqual(a, key.slice(0, 2));
  assert.strictEqual(b, key.slice(2, 4));
  assert.strictEqual(rest, key.slice(4));
  assert.strictEqual(a + b + rest, key);
});

test('keyToSegments rejects a key too short to shard', () => {
  assert.throws(() => keyToSegments('abcd'), RangeError);
});
