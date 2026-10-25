/** E01–E10 тәжірибелері: параметрлер, нұсқалар, іске қосу. */
import { DEFAULT_PARAMS, DeepPartial, ScenarioParams, ControlMode, mergeParams, scenarioId } from './scenario';
import { Simulation, SimResult, improvementPct } from './engine';
import { buildNetwork } from './network';
import { generateDemand } from './demand';
import { SEED_GRAPH, dijkstra, allSimplePaths, Metric } from './graph';
import { MODEL_VERSION, ALGO_VERSION } from './version';

export interface Variant {
  label: string;
  over: DeepPartial<ScenarioParams>;
}

export interface ExperimentDef {
  id: string;
  title: string;
  variable: string;
  goal: string;
  description: string;
  kind: 'sim' | 'routing';
  base: DeepPartial<ScenarioParams>;
  variants: Variant[];
  modes: ControlMode[];
  repeats: number;
  focus: string;
  metric?: Metric;
}

export const EXPERIMENTS: ExperimentDef[] = [
  {
    id: 'E01',
    title: 'Қарқындылық',
    variable: '100 / 300 / 600 / 900 авт./сағ бір бағытқа',
    goal: 'Кезек',
    description: 'Сұраныс артқанда кезек ұзындығы мен күту уақыты қалай өзгеретінін екі режимде тексеру.',
    kind: 'sim',
    base: { network: 'single', duration: 3600 },
    variants: [100, 300, 600, 900].map((r) => ({ label: `${r} авт./сағ`, over: { ratePerApproach: r } })),
    modes: ['fixed', 'adaptive'],
    repeats: 3,
    focus: 'avgQueue',
  },
  {
    id: 'E02',
    title: 'Екі режим',
    variable: 'тұрақты / адаптивті, бірдей seed',
    goal: 'Күту',
    description: 'Бірдей сұраныс оқиғалары мен seed кезінде тұрақты және адаптивті басқаруды салыстыру (scenario_example.json параметрлері).',
    kind: 'sim',
    base: { network: 'single', duration: 3600, ratePerApproach: 300, seed: 2026 },
    variants: [{ label: '300 авт./сағ', over: {} }],
    modes: ['fixed', 'adaptive'],
    repeats: 5,
    focus: 'avgWait',
  },
  {
    id: 'E03',
    title: 'Жасыл ұзақтығы',
    variable: 'тұрақты цикл: 15 / 30 / 45 / 60 с',
    goal: 'Оңтайландыру',
    description: 'Тұрақты циклдегі жасыл фаза ұзақтығының күту уақытына әсері. Ең жақсы мән калибрленбеген модель үшін ғана.',
    kind: 'sim',
    base: { network: 'single', duration: 3600, ratePerApproach: 300 },
    variants: [15, 30, 45, 60].map((g) => ({ label: `жасыл ${g} с`, over: { fixed: { green: g } } })),
    modes: ['fixed'],
    repeats: 3,
    focus: 'avgWait',
  },
  {
    id: 'E04',
    title: 'Таңертеңгі шың',
    variable: 'біркелкі / шың (×2)',
    goal: 'Тұрақтылық',
    description: 'Үш қиылысты дәлізде (шартты схема) таңертеңгі шың кезіндегі жүйенің тұрақтылығы.',
    kind: 'sim',
    base: { network: 'corridor', duration: 3600, ratePerApproach: 250 },
    variants: [
      { label: 'біркелкі', over: { profile: 'uniform' } },
      { label: 'шың ×2', over: { profile: 'peak', peakFactor: 2 } },
    ],
    modes: ['fixed', 'adaptive'],
    repeats: 3,
    focus: 'maxQueue',
  },
  {
    id: 'E05',
    title: 'Ағын асимметриясы',
    variable: '50/50 және 80/20 (негізгі / қосалқы)',
    goal: 'Әділдік',
    description: 'Негізгі көше ағыны басым болғанда қосалқы көшедегі күту (аштық) қалай өзгереді.',
    kind: 'sim',
    base: { network: 'single', duration: 3600, ratePerApproach: 300 },
    variants: [
      { label: '50/50', over: { mainShare: 0.5 } },
      { label: '80/20', over: { mainShare: 0.8 } },
    ],
    modes: ['fixed', 'adaptive'],
    repeats: 3,
    focus: 'avgWaitSide',
  },
  {
    id: 'E06',
    title: 'Ең қысқа жол',
    variable: 'салмақ: қашықтық (км)',
    goal: 'Дейкстра',
    description: 'A–B–C–D графындағы барлық жұптар үшін қашықтығы ең аз маршрут.',
    kind: 'routing',
    base: {},
    variants: [],
    modes: [],
    repeats: 1,
    focus: 'distance',
    metric: 'distance',
  },
  {
    id: 'E07',
    title: 'Ең жылдам жол',
    variable: 'салмақ: уақыт (мин)',
    goal: 'Дейкстра',
    description: 'Уақыты ең аз маршрут және оның ең қысқа маршруттан айырмашылығы.',
    kind: 'routing',
    base: {},
    variants: [],
    modes: [],
    repeats: 1,
    focus: 'time',
    metric: 'time',
  },
  {
    id: 'E08',
    title: 'Шамадан тыс жүктеме',
    variable: '700 / 850 / 1000 авт./сағ',
    goal: 'Өткізу қабілеті',
    description: 'Өткізу қабілетіне жақын және одан асатын сұраныс. Аяқталмаған сапарлар бөлек көрсетіледі.',
    kind: 'sim',
    base: { network: 'single', duration: 1800 },
    variants: [700, 850, 1000].map((r) => ({ label: `${r} авт./сағ`, over: { ratePerApproach: r } })),
    modes: ['fixed', 'adaptive'],
    repeats: 3,
    focus: 'unfinished',
  },
  {
    id: 'E09',
    title: 'Транзиттік жүк көліктері',
    variable: 'жүк үлесі 0 / 15 / 30 % (35 км/сағ)',
    goal: 'Жылдамдық',
    description: 'Негізгі көшедегі баяу транзиттік жүк көліктерінің сапар уақыты мен кезекке әсері (дәліз).',
    kind: 'sim',
    base: { network: 'corridor', duration: 3600, ratePerApproach: 250 },
    variants: [0, 0.15, 0.3].map((s) => ({ label: `жүк ${Math.round(s * 100)}%`, over: { truckShare: s } })),
    modes: ['fixed', 'adaptive'],
    repeats: 3,
    focus: 'avgTravel',
  },
  {
    id: 'E10',
    title: 'Қайталаулар',
    variable: '≥ 30 seed, жұптық салыстыру',
    goal: 'Статистика',
    description: 'Әр seed үшін екі режим бірдей сұраныспен іске қосылады; жұптық айырмаға t-тест, Уилкоксон, сенім аралығы.',
    kind: 'sim',
    base: { network: 'single', duration: 3600, ratePerApproach: 300 },
    variants: [{ label: '300 авт./сағ', over: {} }],
    modes: ['fixed', 'adaptive'],
    repeats: 30,
    focus: 'avgWait',
  },
];

export interface RunRecord {
  experiment: string;
  variant: string;
  variantIndex: number;
  mode: ControlMode;
  repeat: number;
  seed: number;
  scenarioId: string;
  params: ScenarioParams;
  result: Omit<SimResult, 'series'>;
}

export interface ExperimentResult {
  experiment: string;
  title: string;
  createdAt: string;
  modelVersion: string;
  algoVersions: typeof ALGO_VERSION;
  baseSeed: number;
  repeats: number;
  runs: RunRecord[];
  series?: { variant: string; mode: ControlMode; points: { t: number; queue: number }[] }[];
  routing?: RoutingRow[];
  durationMs: number;
}

export interface RoutingRow {
  from: string;
  to: string;
  path: string[];
  cost: number;
  distance: number;
  time: number;
  shortestByDistance: string[];
  fastestByTime: string[];
  differs: boolean;
  alternatives: number;
}

export interface RunOptions {
  baseSeed: number;
  repeats: number;
  overrides?: DeepPartial<ScenarioParams>;
}

export function planRuns(def: ExperimentDef, opt: RunOptions) {
  const plan: { variant: Variant; variantIndex: number; repeat: number; seed: number; params: ScenarioParams }[] = [];
  def.variants.forEach((variant, vi) => {
    for (let r = 0; r < opt.repeats; r++) {
      const base = mergeParams(DEFAULT_PARAMS, def.base);
      const withOver = opt.overrides ? mergeParams(base, opt.overrides) : base;
      const params = mergeParams(withOver, variant.over);
      params.seed = opt.baseSeed + r;
      plan.push({ variant, variantIndex: vi, repeat: r + 1, seed: params.seed, params });
    }
  });
  return plan;
}

export function runRouting(def: ExperimentDef): RoutingRow[] {
  const nodes = SEED_GRAPH.nodes;
  const rows: RoutingRow[] = [];
  for (const a of nodes)
    for (const b of nodes) {
      if (a >= b) continue;
      const res = dijkstra(SEED_GRAPH, a, b, def.metric ?? 'distance');
      const dRes = dijkstra(SEED_GRAPH, a, b, 'distance');
      const tRes = dijkstra(SEED_GRAPH, a, b, 'time');
      const alts = allSimplePaths(SEED_GRAPH, a, b);
      const info = alts.find((x) => x.path.join() === res.path.join())!;
      rows.push({
        from: a,
        to: b,
        path: res.path,
        cost: res.cost,
        distance: info.distance,
        time: info.time,
        shortestByDistance: dRes.path,
        fastestByTime: tRes.path,
        differs: dRes.path.join() !== tRes.path.join(),
        alternatives: alts.length,
      });
    }
  return rows;
}

/** Бір тәжірибені толық орындау (Web Worker ішінде немесе тестте). */
export function runExperiment(
  def: ExperimentDef,
  opt: RunOptions,
  onProgress?: (done: number, total: number) => void,
): ExperimentResult {
  const t0 = Date.now();
  const createdAt = new Date().toISOString();
  if (def.kind === 'routing') {
    return {
      experiment: def.id,
      title: def.title,
      createdAt,
      modelVersion: MODEL_VERSION,
      algoVersions: ALGO_VERSION,
      baseSeed: opt.baseSeed,
      repeats: 1,
      runs: [],
      routing: runRouting(def),
      durationMs: Date.now() - t0,
    };
  }
  const plan = planRuns(def, opt);
  const total = plan.length * def.modes.length;
  let done = 0;
  const runs: RunRecord[] = [];
  const series: ExperimentResult['series'] = [];
  const nets = { single: buildNetwork({ kind: 'single' }), corridor: buildNetwork({ kind: 'corridor' }) };
  for (const item of plan) {
    const net = nets[item.params.network];
    const events = generateDemand(net, item.params); // бірдей сұраныс екі режимге
    for (const mode of def.modes) {
      const sim = new Simulation(item.params, mode, events, net);
      const res = sim.run();
      const { series: s, ...rest } = res;
      runs.push({
        experiment: def.id,
        variant: item.variant.label,
        variantIndex: item.variantIndex,
        mode,
        repeat: item.repeat,
        seed: item.seed,
        scenarioId: scenarioId(item.params),
        params: item.params,
        result: rest,
      });
      if (item.repeat === 1) series.push({ variant: item.variant.label, mode, points: s.map((p) => ({ t: p.t, queue: p.queue })) });
      done++;
      onProgress?.(done, total);
    }
  }
  return {
    experiment: def.id,
    title: def.title,
    createdAt,
    modelVersion: MODEL_VERSION,
    algoVersions: ALGO_VERSION,
    baseSeed: opt.baseSeed,
    repeats: opt.repeats,
    runs,
    series,
    durationMs: Date.now() - t0,
  };
}

export const METRIC_LABELS: Record<string, string> = {
  avgWait: 'Орташа күту, с',
  avgWaitMain: 'Негізгі көше күтуі, с',
  avgWaitSide: 'Қосалқы көше күтуі, с',
  maxWait: 'Ең ұзақ күту, с',
  avgQueue: 'Орташа кезек, авт.',
  maxQueue: 'Ең үлкен кезек, авт.',
  throughputPerHour: 'Өткізу, авт./сағ',
  avgTravel: 'Орташа сапар, с',
  completed: 'Аяқталған сапар',
  unfinished: 'Аяқталмаған',
  generated: 'Келген көлік',
};

export const METRIC_KEYS = ['avgWait', 'avgWaitMain', 'avgWaitSide', 'maxWait', 'avgQueue', 'maxQueue', 'throughputPerHour', 'avgTravel', 'completed', 'unfinished', 'generated'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export interface AggregateRow {
  variant: string;
  variantIndex: number;
  mode: ControlMode;
  n: number;
  means: Record<MetricKey, number>;
  sds: Record<MetricKey, number>;
}

export function aggregate(res: ExperimentResult): AggregateRow[] {
  const groups = new Map<string, RunRecord[]>();
  for (const r of res.runs) {
    const k = `${r.variantIndex}|${r.mode}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const rows: AggregateRow[] = [];
  for (const [, list] of groups) {
    const means = {} as Record<MetricKey, number>;
    const sds = {} as Record<MetricKey, number>;
    for (const k of METRIC_KEYS) {
      const vals = list.map((r) => r.result[k] as number);
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      means[k] = m;
      sds[k] = vals.length > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1)) : NaN;
    }
    rows.push({ variant: list[0].variant, variantIndex: list[0].variantIndex, mode: list[0].mode, n: list.length, means, sds });
  }
  return rows.sort((a, b) => a.variantIndex - b.variantIndex || (a.mode === b.mode ? 0 : a.mode === 'fixed' ? -1 : 1));
}

/** Бір seed-тегі жұптар: тұрақты vs адаптивті. */
export function pairs(res: ExperimentResult, variantIndex: number, key: MetricKey = 'avgWait') {
  const fx = res.runs.filter((r) => r.variantIndex === variantIndex && r.mode === 'fixed');
  const ad = res.runs.filter((r) => r.variantIndex === variantIndex && r.mode === 'adaptive');
  const out: { seed: number; fixed: number; adaptive: number; diff: number; improvement: number | null }[] = [];
  for (const f of fx) {
    const a = ad.find((x) => x.seed === f.seed);
    if (!a) continue;
    const fv = f.result[key] as number;
    const av = a.result[key] as number;
    out.push({ seed: f.seed, fixed: fv, adaptive: av, diff: fv - av, improvement: improvementPct(fv, av) });
  }
  return out;
}
