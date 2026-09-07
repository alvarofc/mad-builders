export function requestTiming() {
  const entries: string[] = [];
  return {
    async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
      const start = performance.now();
      try {
        return await operation();
      } finally {
        entries.push(`${name};dur=${(performance.now() - start).toFixed(1)}`);
      }
    },
    header: () => entries.join(', '),
  };
}
