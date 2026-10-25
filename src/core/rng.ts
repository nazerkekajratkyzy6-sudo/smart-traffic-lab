/** Детерминированный ГПСЧ (mulberry32). Одинаковый seed → одинаковая последовательность. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Независимый подпоток: смешивание seed и номера потока. */
export function subSeed(seed: number, stream: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (stream + 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function expSample(rng: () => number, rate: number): number {
  // rate > 0, возвращает интервал (с)
  return -Math.log(1 - rng()) / rate;
}

/** FNV-1a 32-бит для идентификатора сценария */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
