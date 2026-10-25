import type { ExperimentResult, RunOptions } from '../core/experiments';

export interface RunHandle {
  promise: Promise<ExperimentResult>;
  cancel: () => void;
}

/** Тәжірибені Web Worker ішінде іске қосу (UI бұғатталмайды). */
export function runInWorker(id: string, opt: RunOptions, onProgress: (done: number, total: number) => void): RunHandle {
  const worker = new Worker(new URL('./experiment.worker.ts', import.meta.url), { type: 'module' });
  let rejectFn: (e: Error) => void = () => {};
  const promise = new Promise<ExperimentResult>((resolve, reject) => {
    rejectFn = reject;
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === 'progress') onProgress(m.done, m.total);
      else if (m.type === 'done') {
        resolve(m.result);
        worker.terminate();
      } else if (m.type === 'error') {
        reject(new Error(m.message));
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      reject(new Error(e.message || 'Worker қатесі'));
      worker.terminate();
    };
    worker.postMessage({ id, opt });
  });
  return {
    promise,
    cancel: () => {
      worker.terminate();
      rejectFn(new Error('Тоқтатылды'));
    },
  };
}
