/// <reference lib="webworker" />
import { EXPERIMENTS, runExperiment, RunOptions } from '../core/experiments';

self.onmessage = (ev: MessageEvent<{ id: string; opt: RunOptions }>) => {
  const { id, opt } = ev.data;
  const def = EXPERIMENTS.find((e) => e.id === id);
  if (!def) {
    self.postMessage({ type: 'error', message: `Тәжірибе табылмады: ${id}` });
    return;
  }
  try {
    let last = 0;
    const result = runExperiment(def, opt, (done, total) => {
      const now = Date.now();
      if (now - last > 80 || done === total) {
        last = now;
        self.postMessage({ type: 'progress', done, total });
      }
    });
    self.postMessage({ type: 'done', result });
  } catch (e) {
    self.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
