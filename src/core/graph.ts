/** Граф және Дейкстра алгоритмі (қадамдық журналмен). */
import seed from '../../materials/seed_graph.json';

export interface GraphEdge {
  source: string;
  target: string;
  distance_km: number;
  speed_kmh: number;
  time_min: number;
}

export interface Graph {
  nodes: string[];
  edges: GraphEdge[];
  directed?: boolean;
}

export type Metric = 'distance' | 'time';

/** Оқу мысалы / модельдік дерек — бастапқы PDF-тегі граф. */
export const SEED_GRAPH: Graph = { nodes: seed.nodes, edges: seed.edges as GraphEdge[], directed: false };

export interface DijkstraStep {
  index: number;
  current: string;
  currentDist: number;
  visited: string[];
  dist: Record<string, number>;
  prev: Record<string, string | null>;
  relaxed: { edge: string; from: string; to: string; candidate: number; improved: boolean }[];
}

export interface DijkstraResult {
  path: string[];
  cost: number;
  steps: DijkstraStep[];
  dist: Record<string, number>;
  reachable: boolean;
}

export function edgeKey(a: string, b: string): string {
  return [a, b].sort().join('–');
}

export function edgeWeight(e: GraphEdge, metric: Metric, factor = 1): number {
  return metric === 'distance' ? e.distance_km : e.time_min * factor;
}

export function validateGraph(g: Graph, metric: Metric, factors: Record<string, number> = {}): string[] {
  const errs: string[] = [];
  const nodes = new Set(g.nodes);
  for (const e of g.edges) {
    if (!nodes.has(e.source) || !nodes.has(e.target)) errs.push(`Қабырға ${e.source}–${e.target}: белгісіз түйін`);
    const w = edgeWeight(e, metric, factors[edgeKey(e.source, e.target)] ?? 1);
    if (!Number.isFinite(w)) errs.push(`Қабырға ${e.source}–${e.target}: салмақ сан емес`);
    else if (w < 0) errs.push(`Қабырға ${e.source}–${e.target}: теріс салмақ (${w}) — Дейкстра қолданылмайды`);
  }
  return errs;
}

function adjacency(g: Graph) {
  const adj: Record<string, { to: string; e: GraphEdge }[]> = {};
  for (const n of g.nodes) adj[n] = [];
  for (const e of g.edges) {
    adj[e.source].push({ to: e.target, e });
    if (!g.directed) adj[e.target].push({ to: e.source, e });
  }
  // тұрақты рет: алфавит бойынша
  for (const n of g.nodes) adj[n].sort((a, b) => a.to.localeCompare(b.to));
  return adj;
}

export function dijkstra(
  g: Graph,
  from: string,
  to: string,
  metric: Metric,
  factors: Record<string, number> = {},
): DijkstraResult {
  const errs = validateGraph(g, metric, factors);
  if (errs.length) throw new Error(errs.join('; '));
  if (!g.nodes.includes(from) || !g.nodes.includes(to)) throw new Error('Түйін табылмады');
  const adj = adjacency(g);
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const n of g.nodes) {
    dist[n] = Infinity;
    prev[n] = null;
  }
  dist[from] = 0;
  const visited = new Set<string>();
  const steps: DijkstraStep[] = [];
  while (visited.size < g.nodes.length) {
    let u: string | null = null;
    for (const n of g.nodes) if (!visited.has(n) && (u === null || dist[n] < dist[u])) u = n;
    if (u === null || dist[u] === Infinity) break;
    visited.add(u);
    const relaxed: DijkstraStep['relaxed'] = [];
    for (const { to: v, e } of adj[u]) {
      if (visited.has(v)) continue;
      const w = edgeWeight(e, metric, factors[edgeKey(e.source, e.target)] ?? 1);
      const cand = dist[u] + w;
      const improved = cand < dist[v] - 1e-12;
      if (improved) {
        dist[v] = cand;
        prev[v] = u;
      }
      relaxed.push({ edge: edgeKey(u, v), from: u, to: v, candidate: round(cand), improved });
    }
    steps.push({
      index: steps.length + 1,
      current: u,
      currentDist: round(dist[u]),
      visited: [...visited],
      dist: Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, round(v)])),
      prev: { ...prev },
      relaxed,
    });
    if (u === to) break;
  }
  const reachable = dist[to] !== Infinity;
  const path: string[] = [];
  if (reachable) {
    let c: string | null = to;
    while (c) {
      path.unshift(c);
      c = prev[c];
    }
  }
  return { path, cost: round(dist[to]), steps, dist, reachable };
}

export interface PathInfo {
  path: string[];
  distance: number;
  time: number;
  baseTime: number;
}

/** Барлық қарапайым жолдар (балама маршруттар) — шағын граф үшін. */
export function allSimplePaths(g: Graph, from: string, to: string, factors: Record<string, number> = {}): PathInfo[] {
  const adj = adjacency(g);
  const out: PathInfo[] = [];
  const walk = (node: string, path: string[], d: number, t: number, bt: number) => {
    if (node === to) {
      out.push({ path: [...path], distance: round(d), time: round(t), baseTime: round(bt) });
      return;
    }
    for (const { to: v, e } of adj[node]) {
      if (path.includes(v)) continue;
      const f = factors[edgeKey(e.source, e.target)] ?? 1;
      path.push(v);
      walk(v, path, d + e.distance_km, t + e.time_min * f, bt + e.time_min);
      path.pop();
    }
  };
  walk(from, [from], 0, 0, 0);
  return out.sort((a, b) => a.distance - b.distance || a.time - b.time);
}

export function pathEdges(path: string[]): string[] {
  const r: string[] = [];
  for (let i = 0; i < path.length - 1; i++) r.push(edgeKey(path[i], path[i + 1]));
  return r;
}

/** Қабырға уақыты v арқылы: t = s / v · 60 (мин). Бастапқы кестемен салыстыру үшін. */
export function impliedTimeMin(e: GraphEdge): number {
  return round((e.distance_km / e.speed_kmh) * 60);
}

function round(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : x;
}
