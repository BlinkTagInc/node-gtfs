import assert from 'node:assert/strict';
import { createServer, type RequestListener } from 'node:http';
import type { Socket } from 'node:net';
import type { TestContext } from 'node:test';

export async function startTestHttpServer(
  t: TestContext,
  listener: RequestListener,
): Promise<string> {
  const server = createServer(listener);
  const sockets = new Set<Socket>();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        // Aborted downloads and unfinished response bodies must not stall teardown.
        server.closeAllConnections();
        for (const socket of sockets) {
          socket.destroy();
        }
      }),
  );
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
