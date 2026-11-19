import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { measure } from './speedtest.js';

const BODY_SIZE = 100000;

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => {
    server.close(resolve);
    server.closeIdleConnections();
  });
}

test('measure делает 10 замеров и суммирует 1000000 байт', async () => {
  const body = Buffer.alloc(BODY_SIZE, 'a');
  const { server, url } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Length': body.length });
    res.end(body);
  });
  try {
    const samples = await measure(url, 10);
    assert.equal(samples.length, 10);
    assert.equal(samples.reduce((sum, s) => sum + s.bytes, 0), 1000000);
  } finally {
    await stopServer(server);
  }
});

test('measure отклоняется на ответе 404', async () => {
  const { server, url } = await startServer((req, res) => {
    res.writeHead(404);
    res.end();
  });
  try {
    await assert.rejects(measure(url, 10), /request 1: HTTP 404/);
  } finally {
    await stopServer(server);
  }
});
