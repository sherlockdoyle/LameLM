const OPTION: IdleRequestOptions = { timeout: 0 };

export default function runTask(fn: (start: number, end: number) => void, start: number, limit: number): Promise<void> {
  const chunkSize = Math.max(Math.round((limit - start) / 100), 1000);

  function run(start: number, onDone: () => void) {
    const end = Math.min(start + chunkSize, limit);
    fn(start, end);

    if (end < limit) requestIdleCallback(() => run(end, onDone), OPTION);
    else onDone();
  }

  return new Promise(resolve => requestIdleCallback(() => run(start, resolve), OPTION));
}
