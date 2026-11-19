#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const COUNT = 10;
const USAGE = 'usage: node speedtest.js <url>\n';

async function fetchOnce(url, index) {
  const start = performance.now();
  const res = await fetch(url, { headers: { 'Accept-Encoding': 'identity' } }).catch((err) => {
    throw new Error(`request ${index}: ${err.cause?.message ?? err.message}`);
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`request ${index}: HTTP ${res.status}`);
  }
  let bytes = 0;
  for await (const chunk of res.body) {
    bytes += chunk.byteLength;
  }
  return { ms: performance.now() - start, bytes };
}

export async function measure(url, count) {
  const samples = [];
  for (let i = 1; i <= count; i += 1) {
    samples.push(await fetchOnce(url, i));
  }
  return samples;
}

function printReport(samples) {
  samples.forEach((s, i) => {
    console.log(`#${i + 1}  ${s.ms.toFixed(1)} ms  ${s.bytes} bytes`);
  });
  const totalMs = samples.reduce((sum, s) => sum + s.ms, 0);
  const totalBytes = samples.reduce((sum, s) => sum + s.bytes, 0);
  const avgMs = totalMs / samples.length;
  const totalMb = totalBytes / 1e6;
  const mbitPerSec = (totalBytes * 8) / (totalMs / 1000) / 1e6;
  console.log(`average: ${avgMs.toFixed(1)} ms`);
  console.log(`total: ${totalMb.toFixed(3)} MB`);
  console.log(`speed: ${mbitPerSec.toFixed(2)} Mbit/s`);
}

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export async function main(argv) {
  const url = argv[2];
  if (!url || !isHttpUrl(url)) {
    process.stderr.write(USAGE);
    return 1;
  }
  try {
    printReport(await measure(url, COUNT));
    return 0;
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  process.exitCode = await main(process.argv);
}
