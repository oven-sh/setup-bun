export function retry<T>(
  fn: () => Promise<T>,
  retries: number,
  timeout = 10000
): Promise<T> {
  return fn().catch((err) => {
    if (retries <= 0) {
      throw err;
    }
    return new Promise((resolve) => setTimeout(resolve, timeout)).then(() =>
      retry(fn, retries - 1, timeout)
    );
  });
}
