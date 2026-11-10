import assert from 'node:assert/strict';

export function createDeferred() {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  assert.ok(resolve);
  return { promise, resolve };
}
