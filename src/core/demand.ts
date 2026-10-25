/** Сұраныс генераторы: келу оқиғаларының тізімі. Екі ядро бірдей тізімді алады. */
import { mulberry32, subSeed, expSample } from './rng';
import { Network, Turn, nextLink } from './network';
import { ScenarioParams, TurnShares } from './scenario';

export type VehicleType = 'car' | 'truck';

export interface ArrivalEvent {
  id: number;
  t: number; // келу уақыты, с
  entry: string; // кіру сегменті
  route: string[]; // сегменттер тізбегі
  turns: Turn[]; // әр қиылыстағы бұрылыс
  type: VehicleType;
  origin: 'main' | 'side';
}

export function demandMultiplier(p: ScenarioParams, t: number): number {
  if (p.profile !== 'peak') return 1;
  const tc = 0.4 * p.duration;
  const sigma = 0.15 * p.duration;
  return 1 + (p.peakFactor - 1) * Math.exp(-0.5 * ((t - tc) / sigma) ** 2);
}

/** Кіру бағытының базалық қарқындылығы (авт./сағ). */
export function entryRate(p: ScenarioParams, kind: 'main' | 'side'): number {
  const s = p.mainShare;
  return p.ratePerApproach * 2 * (kind === 'main' ? s : 1 - s);
}

function pickTurn(rng: () => number, sh: TurnShares, allowed: Turn[]): Turn {
  const w = allowed.map((t) => Math.max(0, sh[t]));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return allowed.includes('T') ? 'T' : allowed[0];
  let r = rng() * sum;
  for (let i = 0; i < allowed.length; i++) {
    r -= w[i];
    if (r < 0) return allowed[i];
  }
  return allowed[allowed.length - 1];
}

function buildRoute(net: Network, entry: string, p: ScenarioParams, rng: () => number, transit: boolean) {
  const route = [entry];
  const turns: Turn[] = [];
  let cur = entry;
  for (let guard = 0; guard < 20; guard++) {
    const l = net.linkById[cur];
    if (l.isExit) break;
    const options: Turn[] = (['L', 'T', 'R'] as Turn[]).filter((t) => nextLink(net, cur, t));
    const turn: Turn = transit && options.includes('T') ? 'T' : pickTurn(rng, l.kind === 'main' ? p.turnMain : p.turnSide, options);
    const nx = nextLink(net, cur, turn)!;
    turns.push(turn);
    route.push(nx);
    cur = nx;
  }
  return { route, turns };
}

export function generateDemand(net: Network, p: ScenarioParams): ArrivalEvent[] {
  const events: Omit<ArrivalEvent, 'id'>[] = [];
  const maxMult = p.profile === 'peak' ? Math.max(1, p.peakFactor) : 1;
  net.entries.forEach((entry, idx) => {
    const link = net.linkById[entry];
    const rate = entryRate(p, link.kind) / 3600; // авт./с
    if (rate <= 0) return;
    const rng = mulberry32(subSeed(p.seed, idx + 1));
    const routeRng = mulberry32(subSeed(p.seed, 1000 + idx));
    const push = (t: number) => {
      const truck = link.kind === 'main' && p.truckShare > 0 && routeRng() < p.truckShare;
      const { route, turns } = buildRoute(net, entry, p, routeRng, truck);
      events.push({ t, entry, route, turns, type: truck ? 'truck' : 'car', origin: link.kind });
    };
    if (p.arrivals === 'poisson') {
      // Біртекті емес Пуассон ағыны (thinning әдісі)
      const lmax = rate * maxMult;
      let t = 0;
      for (;;) {
        t += expSample(rng, lmax);
        if (t >= p.duration) break;
        if (rng() * maxMult <= demandMultiplier(p, t)) push(t);
      }
    } else {
      // Тұрақты аралықпен келу (кумулятивті қарқындылық бойынша)
      let acc = rng(); // бастапқы фаза
      const step = 1;
      for (let t = 0; t < p.duration; t += step) {
        acc += rate * demandMultiplier(p, t) * step;
        while (acc >= 1) {
          acc -= 1;
          push(t + step * 0.5);
        }
      }
    }
  });
  events.sort((a, b) => a.t - b.t || a.entry.localeCompare(b.entry));
  return events.map((e, i) => ({ ...e, id: i + 1 }));
}
