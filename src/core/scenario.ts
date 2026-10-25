import { fnv1a } from './rng';
import { MODEL_VERSION } from './version';

export type ControlMode = 'fixed' | 'adaptive';
export type NetworkKind = 'single' | 'corridor';

export interface TurnShares {
  L: number;
  T: number;
  R: number;
}

export interface ScenarioParams {
  network: NetworkKind;
  seed: number;
  duration: number; // модельдік уақыт, с
  dt: number; // қадам, с (0.2–1)
  ratePerApproach: number; // авт./сағ бір кіру бағытына (базалық)
  mainShare: number; // негізгі көшенің үлесі (0.5 = симметриялы)
  profile: 'uniform' | 'peak';
  peakFactor: number; // шың кезіндегі көбейткіш
  arrivals: 'poisson' | 'regular';
  truckShare: number; // негізгі көшедегі транзиттік жүк көліктерінің үлесі
  truckSpeedKmh: number;
  turnMain: TurnShares;
  turnSide: TurnShares;
  signal: { yellow: number; allRed: number };
  fixed: { green: number; greenLeft: number };
  adaptive: { alpha: number; minGreen: number; maxGreen: number; maxRed: number; detector: number };
  maxVehicles: number;
}

export const DEFAULT_PARAMS: ScenarioParams = {
  network: 'single',
  seed: 2026,
  duration: 3600,
  dt: 0.5,
  ratePerApproach: 300,
  mainShare: 0.5,
  profile: 'uniform',
  peakFactor: 2,
  arrivals: 'poisson',
  truckShare: 0,
  truckSpeedKmh: 35,
  turnMain: { L: 0.15, T: 0.7, R: 0.15 },
  turnSide: { L: 0.25, T: 0.5, R: 0.25 },
  signal: { yellow: 3, allRed: 1 },
  fixed: { green: 30, greenLeft: 15 },
  adaptive: { alpha: 0.1, minGreen: 10, maxGreen: 60, maxRed: 120, detector: 40 },
  maxVehicles: 2500,
};

export const LIMITS = {
  duration: [60, 10800],
  dt: [0.2, 1],
  ratePerApproach: [0, 2000],
  mainShare: [0.1, 0.9],
  peakFactor: [1, 4],
  truckShare: [0, 0.6],
  truckSpeedKmh: [10, 60],
  yellow: [2, 6],
  allRed: [0, 5],
  green: [5, 120],
  greenLeft: [5, 90],
  alpha: [0, 5],
  minGreen: [5, 60],
  maxGreen: [10, 180],
  maxRed: [30, 300],
  detector: [0, 120],
  maxVehicles: [100, 5000],
  seed: [0, 2 ** 31 - 1],
} as const;

export function cloneParams(p: ScenarioParams): ScenarioParams {
  return JSON.parse(JSON.stringify(p));
}

export function mergeParams(base: ScenarioParams, over: DeepPartial<ScenarioParams>): ScenarioParams {
  const out = cloneParams(base) as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...(out[k] as object), ...(v as object) };
    else if (v !== undefined) out[k] = v;
  }
  return out as unknown as ScenarioParams;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/** Енгізуді тексеру: қателер тізімі (бос болса — дұрыс). */
export function validateParams(p: ScenarioParams): string[] {
  const e: string[] = [];
  const chk = (name: string, v: number, [lo, hi]: readonly [number, number]) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) e.push(`${name}: сан болуы тиіс`);
    else if (v < lo || v > hi) e.push(`${name}: ${lo}…${hi} аралығында болуы тиіс (қазір ${v})`);
  };
  if (p.network !== 'single' && p.network !== 'corridor') e.push('Желі түрі қате');
  chk('Seed', p.seed, LIMITS.seed);
  if (!Number.isInteger(p.seed)) e.push('Seed бүтін сан болуы тиіс');
  chk('Ұзақтығы (с)', p.duration, LIMITS.duration);
  chk('Қадам Δt (с)', p.dt, LIMITS.dt);
  chk('Қарқындылық (авт./сағ)', p.ratePerApproach, LIMITS.ratePerApproach);
  chk('Негізгі көше үлесі', p.mainShare, LIMITS.mainShare);
  chk('Шың коэффициенті', p.peakFactor, LIMITS.peakFactor);
  chk('Жүк көліктері үлесі', p.truckShare, LIMITS.truckShare);
  chk('Жүк көлігі жылдамдығы', p.truckSpeedKmh, LIMITS.truckSpeedKmh);
  chk('Сары (с)', p.signal.yellow, LIMITS.yellow);
  chk('Бәрі қызыл (с)', p.signal.allRed, LIMITS.allRed);
  chk('Тұрақты жасыл (с)', p.fixed.green, LIMITS.green);
  chk('Солға бұрылу жасылы (с)', p.fixed.greenLeft, LIMITS.greenLeft);
  chk('α', p.adaptive.alpha, LIMITS.alpha);
  chk('minGreen', p.adaptive.minGreen, LIMITS.minGreen);
  chk('maxGreen', p.adaptive.maxGreen, LIMITS.maxGreen);
  chk('maxRed', p.adaptive.maxRed, LIMITS.maxRed);
  chk('Детектор аймағы (м)', p.adaptive.detector, LIMITS.detector);
  chk('Көлік шегі', p.maxVehicles, LIMITS.maxVehicles);
  if (p.adaptive.minGreen > p.adaptive.maxGreen) e.push('minGreen ≤ maxGreen болуы тиіс');
  for (const [nm, t] of [
    ['Негізгі көше бұрылыстары', p.turnMain],
    ['Қосалқы көше бұрылыстары', p.turnSide],
  ] as const) {
    const vals = [t.L, t.T, t.R];
    if (vals.some((v) => typeof v !== 'number' || v < 0 || !Number.isFinite(v))) e.push(`${nm}: теріс емес сандар`);
    else if (vals.reduce((a, b) => a + b, 0) <= 0) e.push(`${nm}: қосындысы 0-ден үлкен болуы тиіс`);
  }
  if (p.profile !== 'uniform' && p.profile !== 'peak') e.push('Сұраныс профилі қате');
  if (p.arrivals !== 'poisson' && p.arrivals !== 'regular') e.push('Келу моделі қате');
  return e;
}

/** JSON сценарийін импорттау кезіндегі схема тексерісі. */
export function parseScenarioJson(raw: unknown): { params?: ScenarioParams; errors: string[] } {
  if (!raw || typeof raw !== 'object') return { errors: ['JSON объект емес'] };
  const obj = raw as Record<string, unknown>;
  const src = (obj.params ?? obj) as Record<string, unknown>;
  const known = Object.keys(DEFAULT_PARAMS);
  const unknown = Object.keys(src).filter((k) => !known.includes(k) && !['id', 'name', 'modelVersion', 'data_type', 'createdAt', 'mode'].includes(k));
  const merged = mergeParams(DEFAULT_PARAMS, src as DeepPartial<ScenarioParams>);
  const errors = validateParams(merged);
  if (unknown.length) errors.push(`Белгісіз өрістер: ${unknown.join(', ')}`);
  return errors.length ? { errors } : { params: merged, errors };
}

/** Бастапқы scenario_example.json форматын түрлендіру. */
export function fromExampleJson(ex: Record<string, unknown>): ScenarioParams {
  const a = (ex.adaptive ?? {}) as Record<string, number>;
  return mergeParams(DEFAULT_PARAMS, {
    seed: Number(ex.seed ?? DEFAULT_PARAMS.seed),
    duration: Number(ex.duration_seconds ?? DEFAULT_PARAMS.duration),
    ratePerApproach: Number(ex.arrival_rate_vehicles_per_hour ?? DEFAULT_PARAMS.ratePerApproach),
    fixed: { green: Number(ex.fixed_green_seconds ?? 30) },
    adaptive: {
      minGreen: a.min_green_seconds ?? 10,
      maxGreen: a.max_green_seconds ?? 60,
      alpha: a.alpha ?? 0.1,
    },
  });
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}

/** Сценарий идентификаторы: параметрлер + модель нұсқасы бойынша хэш. */
export function scenarioId(p: ScenarioParams, extra = ''): string {
  return `STL-${fnv1a(canonical(p) + '|' + MODEL_VERSION + '|' + extra).toUpperCase()}`;
}
