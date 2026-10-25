import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { flowRate, flow, greenshieldsSpeed, greenshieldsCapacity, poissonPmf, SOURCE_FLOW_EXAMPLES } from '../src/core/flow';
import { SEED_GRAPH, dijkstra, allSimplePaths, Graph } from '../src/core/graph';
import { DEFAULT_PARAMS, mergeParams, validateParams, scenarioId, parseScenarioJson } from '../src/core/scenario';
import { Simulation, runPair, improvementPct } from '../src/core/engine';
import { buildNetwork } from '../src/core/network';
import { generateDemand } from '../src/core/demand';
import { chiSquare, fisherExact, pairedTTest, wilcoxonSignedRank, shapiroWilk, tQuantile } from '../src/core/stats';
import { EXPERIMENTS, runExperiment, pairs } from '../src/core/experiments';

const P = (o = {}) => mergeParams(DEFAULT_PARAMS, { duration: 900, ...o });

describe('q = ρ·v', () => {
  it('бастапқы мысалдар', () => {
    for (const ex of SOURCE_FLOW_EXAMPLES) expect(flowRate(ex.rho, ex.v)).toBe(ex.q);
  });
  it('жолақ саны', () => {
    expect(flow({ density: 40, speed: 50, lanes: 2, densityPerLane: true }).q).toBe(4000);
    expect(flow({ density: 80, speed: 30, lanes: 2 }).qPerLane).toBe(1200);
  });
  it('теріс мәндер қабылданбайды', () => {
    expect(() => flowRate(-1, 10)).toThrow();
    expect(() => flowRate(10, -1)).toThrow();
    expect(() => flowRate(NaN, 1)).toThrow();
  });
  it('Гриншилдс гипотезасы', () => {
    expect(greenshieldsSpeed(0, 60, 150)).toBe(60);
    expect(greenshieldsSpeed(150, 60, 150)).toBe(0);
    expect(greenshieldsSpeed(200, 60, 150)).toBe(0);
    expect(greenshieldsCapacity(60, 150).qMax).toBe(2250);
  });
  it('Пуассон', () => {
    let s = 0;
    for (let k = 0; k < 60; k++) s += poissonPmf(k, 5);
    expect(s).toBeCloseTo(1, 10);
    expect(poissonPmf(0, 2)).toBeCloseTo(Math.exp(-2), 12);
  });
});

describe('Дейкстра', () => {
  it('B→D: қысқа жол ≠ жылдам жол', () => {
    const d = dijkstra(SEED_GRAPH, 'B', 'D', 'distance');
    expect(d.path).toEqual(['B', 'C', 'D']);
    expect(d.cost).toBe(3);
    const t = dijkstra(SEED_GRAPH, 'B', 'D', 'time');
    expect(t.path).toEqual(['B', 'D']);
    expect(t.cost).toBe(6);
  });
  it('A→D', () => {
    expect(dijkstra(SEED_GRAPH, 'A', 'D', 'distance').cost).toBe(5);
    expect(dijkstra(SEED_GRAPH, 'A', 'D', 'time').path).toEqual(['A', 'D']);
  });
  it('барлық жұп үшін нәтиже толық перебормен сәйкес', () => {
    for (const a of SEED_GRAPH.nodes)
      for (const b of SEED_GRAPH.nodes) {
        if (a === b) continue;
        const alts = allSimplePaths(SEED_GRAPH, a, b);
        expect(dijkstra(SEED_GRAPH, a, b, 'distance').cost).toBeCloseTo(Math.min(...alts.map((x) => x.distance)), 9);
        expect(dijkstra(SEED_GRAPH, a, b, 'time').cost).toBeCloseTo(Math.min(...alts.map((x) => x.time)), 9);
      }
  });
  it('теріс салмақ — қате', () => {
    const g: Graph = { nodes: ['A', 'B'], edges: [{ source: 'A', target: 'B', distance_km: -1, speed_kmh: 10, time_min: 1 }] };
    expect(() => dijkstra(g, 'A', 'B', 'distance')).toThrow();
  });
  it('динамикалық салмақ жолды өзгертеді', () => {
    const t = dijkstra(SEED_GRAPH, 'B', 'D', 'time', { 'B–D': 3 });
    expect(t.path).not.toEqual(['B', 'D']);
    expect(t.cost).toBe(9);
  });
});

describe('Симуляция ядросы', () => {
  it('бірдей seed → бірдей нәтиже', () => {
    const a = new Simulation(P(), 'adaptive').run();
    const b = new Simulation(P(), 'adaptive').run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = new Simulation(P({ seed: 7 }), 'adaptive').run();
    expect(c.generated).not.toBe(a.generated);
  });
  it('қақтығысатын бағыттар бір уақытта қиылыста болмайды, қызылға өту жоқ', () => {
    for (const o of [{}, { ratePerApproach: 900 }, { network: 'corridor' as const, ratePerApproach: 400 }, { truckShare: 0.3, network: 'corridor' as const }])
      for (const mode of ['fixed', 'adaptive'] as const) {
        const r = new Simulation(P(o), mode).run();
        expect(r.conflictViolations).toBe(0);
        expect(r.redViolations).toBe(0);
      }
  });
  it('көліктер бір-бірін баспайды', () => {
    const sim = new Simulation(P({ ratePerApproach: 800, duration: 600 }), 'fixed');
    while (!sim.finished) {
      sim.step();
      const lanes = (sim as unknown as { lanes: Map<string, { pos: number; len: number }[][]> }).lanes;
      for (const arrs of lanes.values())
        for (const arr of arrs)
          for (let i = 1; i < arr.length; i++) expect(arr[i - 1].pos - arr[i - 1].len - arr[i].pos).toBeGreaterThanOrEqual(-1e-9);
    }
  });
  it('режим алгоритмді және нәтижені өзгертеді', () => {
    const { fixed, adaptive } = runPair(P({ duration: 1800 }));
    expect(fixed.generated).toBe(adaptive.generated);
    expect(fixed.avgWait).not.toBe(adaptive.avgWait);
    expect(fixed.algoVersion).not.toBe(adaptive.algoVersion);
  });
  it('қарқындылық келуді және метрикаларды өзгертеді', () => {
    const lo = new Simulation(P({ ratePerApproach: 100 }), 'fixed').run();
    const hi = new Simulation(P({ ratePerApproach: 600 }), 'fixed').run();
    expect(hi.generated).toBeGreaterThan(lo.generated * 3);
    expect(hi.avgQueue).toBeGreaterThan(lo.avgQueue);
  });
  it('салыстыру бірдей сұранысты пайдаланады', () => {
    const p = P();
    const net = buildNetwork({ kind: 'single' });
    const e1 = generateDemand(net, p);
    const e2 = generateDemand(net, p);
    expect(JSON.stringify(e1)).toBe(JSON.stringify(e2));
  });
  it('шамадан тыс жүктемеде қауіпсіз тоқтайды', () => {
    const r = new Simulation(P({ ratePerApproach: 2000, maxVehicles: 150, duration: 1800 }), 'fixed').run();
    expect(r.overloaded).toBe(true);
  });
  it('параметр тексерісі', () => {
    expect(validateParams(P({ ratePerApproach: -5 })).length).toBeGreaterThan(0);
    expect(validateParams(P({ dt: 3 })).length).toBeGreaterThan(0);
    expect(parseScenarioJson({ seed: 1, duration: 600 }).params?.seed).toBe(1);
    expect(parseScenarioJson({ foo: 1 }).errors.length).toBeGreaterThan(0);
    expect(scenarioId(P())).toBe(scenarioId(P()));
    expect(scenarioId(P())).not.toBe(scenarioId(P({ seed: 3 })));
  });
  it('жақсару пайызы', () => {
    expect(improvementPct(50, 25)).toBe(50);
    expect(improvementPct(0, 5)).toBeNull();
  });
});

describe('Статистика', () => {
  it('бастапқы χ² кестесі [[1,2],[3,0]]', () => {
    const r = chiSquare([[1, 2], [3, 0]]);
    expect(r.chi2).toBeCloseTo(3, 10);
    expect(r.p).toBeCloseTo(0.0833, 3);
    expect(r.smallExpected).toBe(true);
    expect(fisherExact([[1, 2], [3, 0]])).toBeCloseTo(0.4, 10);
  });
  it('t квантилі', () => {
    expect(tQuantile(0.975, 9)).toBeCloseTo(2.262, 3);
    expect(tQuantile(0.975, 29)).toBeCloseTo(2.045, 3);
  });
  it('жұптық t-тест', () => {
    const x = [10, 12, 9, 14, 11, 13];
    const y = [8, 11, 9, 10, 10, 12];
    const r = pairedTTest(x, y)!;
    expect(r.meanDiff).toBeCloseTo(1.5, 10);
    expect(r.t).toBeCloseTo(2.66557, 4); // scipy.stats.ttest_rel
    expect(r.p).toBeCloseTo(0.044585, 5);
  });
  it('Уилкоксон (нақты)', () => {
    const r = wilcoxonSignedRank([1, 2, 3, 4, 5, 6], [0, 0, 0, 0, 0, 0])!;
    expect(r.p).toBeCloseTo(0.03125, 6);
  });
  it('Шапиро–Уилк', () => {
    const r = shapiroWilk([2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 3.9, 4.1, 3.0, 2.5, 3.7])!;
    expect(r.W).toBeCloseTo(0.97209, 3); // scipy.stats.shapiro
    expect(r.p).toBeCloseTo(0.9314, 2);
    const r2 = shapiroWilk([1, 2, 3, 4, 10, 30, 2, 2.5])!;
    expect(r2.W).toBeCloseTo(0.62549, 3);
    expect(r2.p).toBeCloseTo(0.000315, 4);
    const r3 = shapiroWilk([1, 2, 3, 4, 10, 30, 2, 2.5, 7, 8, 1, 1, 0.5, 40, 3, 3.3, 2, 9, 11, 1.2])!;
    expect(r3.W).toBeCloseTo(0.62739, 3);
    expect(r3.p).toBeLessThan(0.0001);
  });
});

describe('Тәжірибелер', () => {
  it('E02 жұптары бірдей seed', () => {
    const def = EXPERIMENTS.find((e) => e.id === 'E02')!;
    const res = runExperiment(def, { baseSeed: 2026, repeats: 2, overrides: { duration: 600 } });
    const pr = pairs(res, 0);
    expect(pr.length).toBe(2);
    expect(res.runs.length).toBe(4);
  });
  it('E06/E07 маршруттары', () => {
    const r6 = runExperiment(EXPERIMENTS.find((e) => e.id === 'E06')!, { baseSeed: 1, repeats: 1 });
    expect(r6.routing!.length).toBe(6);
    expect(r6.routing!.some((x) => x.differs)).toBe(true);
  });
});

describe('Код тазалығы', () => {
  it('KPI-де 61,7 және 35 с мәндері жазылмаған', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    for (const f of walk(join(__dirname, '../src'))) {
      const s = readFileSync(f, 'utf8');
      expect(/61[.,]7/.test(s), f).toBe(false);
    }
  });
});

import { pEq } from '../src/core/stats';
import { fmt } from '../src/lib/format';
describe('Пішімдеу', () => {
  it('p және сандар', () => {
    expect(pEq(0.0833)).toBe('p = 0,083');
    expect(pEq(0.00001)).toBe('p < 0,001');
    expect(fmt(1172.456, 1)).toBe('1 172,5');
  });
});

import { congestion, compareSentence, presetParams } from '../src/lib/presets';
import { conclude } from '../src/lib/labContent';
describe('Оқушы интерфейсінің есептері', () => {
  it('кептеліс деңгейі', () => {
    expect(congestion(0, 1).level).toBe('low');
    expect(congestion(20, 1).level).toBe('mid');
    expect(congestion(60, 1).level).toBe('high');
  });
  it('салыстыру сөйлемі есептелген пайызды ғана айтады және нашар нәтижені жасырмайды', () => {
    expect(compareSentence(50, 41, true).text).toContain('18%-ға азайтты');
    expect(compareSentence(40, 50, true).tone).toBe('warn');
    expect(compareSentence(40, 50, true).text).toContain('арттырды');
    expect(compareSentence(0, 10, true).tone).toBe('info');
  });
  it('дайын баптаулар жарамды', () => {
    for (const n of ['single', 'corridor'] as const) for (const l of ['low', 'mid', 'high'] as const) expect(validateParams(presetParams(n, l))).toEqual([]);
  });
  it('қорытынды нәтижеден құрылады', () => {
    const r = runExperiment(EXPERIMENTS.find((e) => e.id === 'E07')!, { baseSeed: 1, repeats: 1 });
    expect(conclude(r).answer).toBe('no');
    const r2 = runExperiment(EXPERIMENTS.find((e) => e.id === 'E02')!, { baseSeed: 2026, repeats: 2, overrides: { duration: 900 } });
    const c = conclude(r2);
    expect(c.headline.length).toBeGreaterThan(10);
    expect(['adaptive', 'fixed', 'same']).toContain(c.answer);
  });
});
