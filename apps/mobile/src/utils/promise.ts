/**
 * Rejects if `promise` takes longer than `ms`. Late settlements after the
 * timeout are swallowed (no unhandled rejections).
 */
export const withTimeout = <T,>(
  promise: Promise<T>,
  ms: number,
  message = "Operation timed out"
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};
