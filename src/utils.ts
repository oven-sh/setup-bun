export function retry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  return fn().catch((err) => {
    console.log(`Remaining retries ${retries}`);
    console.log("Current error:");
    console.log(err);
    if (retries <= 0) {
      throw err;
    }
    return retry(fn, retries - 1);
  });
}
