// In-memory per-key mutex (the server is a single Node process). Calls with
// the same key run one after another, so a double click's second request sees
// what the first one created (and answers 409) instead of racing it.
const tails = new Map(); // key → promise of the last queued call

export async function withKeyLock(key, fn) {
  const previous = tails.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  tails.set(key, tail);
  try {
    await previous;
    return await fn();
  } finally {
    release();
    // Last one out removes the key so the map doesn't grow.
    if (tails.get(key) === tail) tails.delete(key);
  }
}
