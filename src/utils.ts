export function retry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  return fn().catch((err) => {
    if (retries <= 0) {
      throw err;
    }
    return retry(fn, retries - 1);
  });
}
