// "Everything offline": the worker loads only when a pattern runs, so it's started once here and
// stopped again, which leaves its file with the service worker.

export default () =>
  new Promise<void>((resolve) => {
    const worker = new Worker(new URL('./regex.worker.ts', import.meta.url), { type: 'module' });
    const done = () => {
      worker.terminate();
      resolve();
    };
    worker.onmessage = (e: MessageEvent<{ result?: unknown }>) => {
      if (e.data.result) done();
    };
    worker.onerror = done;
    worker.postMessage({ id: 0, pattern: 'a', flags: '', text: 'a', replacement: null });
    setTimeout(done, 5000);
  });
