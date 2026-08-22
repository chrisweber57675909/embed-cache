import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EmbedCache } from '../src/index.ts';

const DIM = 8;

// stand-in for a real embedding API: deterministic and free, so the example
// produces the same numbers every run without a network call
function fakeEmbed(text: string): Float32Array {
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;

  const vector = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    vector[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return vector;
}

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'embed-cache-example-'));
  let apiCalls = 0;
  let apiTexts = 0;

  async function fakeProvider(missing: string[]): Promise<Float32Array[]> {
    apiCalls++;
    apiTexts += missing.length;
    return missing.map(fakeEmbed);
  }

  try {
    // four chunks, one of them a repeat, to show that a duplicate text never
    // reaches the provider
    const chunks = [
      'the quick brown fox',
      'jumps over the lazy dog',
      'the quick brown fox',
      'pack my box with five dozen liquor jugs',
    ];

    const cache = new EmbedCache({ dir, expectedDim: DIM });

    const first = await cache.getOrComputeMany('fake-embed-v1', chunks, fakeProvider);
    console.log(`first pass:  ${first.length} vectors, ${apiCalls} api call(s) for ${apiTexts} text(s)`);

    const second = await cache.getOrComputeMany('fake-embed-v1', chunks, fakeProvider);
    console.log(`second pass: ${second.length} vectors, ${apiCalls} api call(s) total`);

    const identical = first.every((vector, i) => vector.every((x, j) => x === second[i][j]));
    console.log(`identical:   ${identical}`);

    // a fresh instance over the same directory, as if the process had been
    // restarted: memory is empty, so this has to come from disk
    const restarted = new EmbedCache({ dir, expectedDim: DIM });
    const fromDisk = await restarted.get('fake-embed-v1', chunks[0]);
    console.log(`after restart: dim ${fromDisk?.length}, stats ${JSON.stringify(restarted.stats())}`);

    const stats = cache.stats();
    console.log(
      `hit rate ${(stats.hitRate * 100).toFixed(1)}%  ` +
        `(memory ${stats.memoryHits}, disk ${stats.diskHits}, miss ${stats.misses}, computed ${stats.computed})  ` +
        `${stats.entries} entries / ${stats.bytes} bytes in memory`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

await main();
