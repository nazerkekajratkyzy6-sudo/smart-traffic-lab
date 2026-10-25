/** Шартты жол желісі: қиылыстар, бағытталған жол сегменттері, жолақтар, фазалар. */

export interface Pt {
  x: number;
  y: number;
}

export type Side = 'N' | 'E' | 'S' | 'W';
export type Turn = 'L' | 'T' | 'R';
export type Movement = `${Side}${Turn}`;

export const LANE_WIDTH = 3.3; // м
export const SAT_FLOW_PER_LANE = 1800; // авт./сағ — оқу баптауы

export const HEADING: Record<Side, Pt> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};
export const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const LEFT_OF: Record<Side, Side> = { E: 'N', N: 'W', W: 'S', S: 'E' };
const RIGHT_OF: Record<Side, Side> = { E: 'S', S: 'W', W: 'N', N: 'E' };

/** Қозғалыс бағыты (heading) және бұрылыс → жаңа бағыт. */
export function turnHeading(heading: Side, turn: Turn): Side {
  return turn === 'T' ? heading : turn === 'L' ? LEFT_OF[heading] : RIGHT_OF[heading];
}

export interface RoadSegment {
  id: string;
  from: string; // түйін id
  to: string;
  heading: Side; // қозғалыс бағыты
  a: Pt; // бастауы (ось сызығы)
  b: Pt; // соңы — стоп-сызық (егер to — қиылыс)
  length: number;
  lanes: number; // 0 — солға бұрылу жолағы, 1 — тура/оңға
  speedLimit: number; // м/с
  capacity: number; // авт./сағ (қанығу ағыны × жолақ)
  kind: 'main' | 'side';
  isEntry: boolean;
  isExit: boolean;
  /** Келесі қиылыстағы келу жағы (vehicle comes FROM this side) */
  approachSide?: Side;
}

export interface Phase {
  id: number;
  name: string;
  movements: Movement[];
}

export interface Junction {
  id: string;
  label: string;
  center: Pt;
  half: number; // қиылыс квадратының жарты өлшемі, м
  inLinks: Partial<Record<Side, string>>; // жақтан келетін сегмент
  outLinks: Partial<Record<Side, string>>; // жаққа шығатын сегмент
  phases: Phase[];
  movementPhase: Record<string, number>;
}

export interface Network {
  kind: 'single' | 'corridor';
  junctions: Junction[];
  links: RoadSegment[];
  linkById: Record<string, RoadSegment>;
  junctionById: Record<string, Junction>;
  entries: string[]; // кіру сегменттері
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export const PHASES: Phase[] = [
  { id: 0, name: 'Негізгі көше: тура + оңға', movements: ['WT', 'WR', 'ET', 'ER'] },
  { id: 1, name: 'Негізгі көше: солға', movements: ['WL', 'EL'] },
  { id: 2, name: 'Қосалқы көше: тура + оңға', movements: ['NT', 'NR', 'ST', 'SR'] },
  { id: 3, name: 'Қосалқы көше: солға', movements: ['NL', 'SL'] },
];

/** Екі қозғалыс бір фазада болмаса — қақтығысты деп саналады (консервативті ереже). */
export function movementsConflict(j: Junction, m1: Movement, m2: Movement): boolean {
  return j.movementPhase[m1] !== j.movementPhase[m2];
}

export function laneForTurn(turn: Turn | undefined): number {
  return turn === 'L' ? 0 : 1;
}

export function laneOffset(lane: number): number {
  return (lane + 0.5) * LANE_WIDTH;
}

export function rightNormal(h: Side): Pt {
  const d = HEADING[h];
  return { x: -d.y, y: d.x };
}

const KMH = 1 / 3.6;

export interface NetworkOptions {
  kind: 'single' | 'corridor';
  spacing?: number; // қиылыстар арасы, м
  armMain?: number;
  armSide?: number;
  speedMainKmh?: number;
  speedSideKmh?: number;
}

export function buildNetwork(opts: NetworkOptions): Network {
  const n = opts.kind === 'single' ? 1 : 3;
  // Дәліз ықшам: қала орталығы үлкен экранда анық көрінуі үшін
  const spacing = opts.spacing ?? (n > 1 ? 220 : 300);
  const armMain = opts.armMain ?? (n > 1 ? 160 : 260);
  const armSide = opts.armSide ?? (n > 1 ? 120 : 200);
  const vMain = (opts.speedMainKmh ?? 50) * KMH;
  const vSide = (opts.speedSideKmh ?? 40) * KMH;
  const half = 2 * LANE_WIDTH + 4; // жолақтар + жаяу жүргінші өткелі

  const junctions: Junction[] = [];
  const movementPhase: Record<string, number> = {};
  for (const p of PHASES) for (const m of p.movements) movementPhase[m] = p.id;
  for (let i = 0; i < n; i++) {
    junctions.push({
      id: `J${i + 1}`,
      label: `${i + 1}-қиылыс`,
      center: { x: i * spacing, y: 0 },
      half,
      inLinks: {},
      outLinks: {},
      phases: PHASES,
      movementPhase,
    });
  }
  const links: RoadSegment[] = [];
  const nodePos: Record<string, Pt> = {};
  for (const j of junctions) nodePos[j.id] = j.center;
  const lastX = (n - 1) * spacing;
  nodePos['W0'] = { x: -armMain, y: 0 };
  nodePos['E0'] = { x: lastX + armMain, y: 0 };
  junctions.forEach((j, i) => {
    nodePos[`N${i + 1}`] = { x: j.center.x, y: -armSide };
    nodePos[`S${i + 1}`] = { x: j.center.x, y: armSide };
  });
  const isJ = (id: string) => id.startsWith('J');
  const jMap: Record<string, Junction> = Object.fromEntries(junctions.map((j) => [j.id, j]));

  const addLink = (from: string, to: string, heading: Side, kind: 'main' | 'side') => {
    const d = HEADING[heading];
    const pa = nodePos[from];
    const pb = nodePos[to];
    const a = isJ(from) ? { x: pa.x + d.x * jMap[from].half, y: pa.y + d.y * jMap[from].half } : { ...pa };
    const b = isJ(to) ? { x: pb.x - d.x * jMap[to].half, y: pb.y - d.y * jMap[to].half } : { ...pb };
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const id = `${from}→${to}`;
    const seg: RoadSegment = {
      id,
      from,
      to,
      heading,
      a,
      b,
      length,
      lanes: 2,
      speedLimit: kind === 'main' ? vMain : vSide,
      capacity: 2 * SAT_FLOW_PER_LANE,
      kind,
      isEntry: !isJ(from),
      isExit: !isJ(to),
      approachSide: isJ(to) ? OPPOSITE[heading] : undefined,
    };
    links.push(seg);
    if (isJ(to)) jMap[to].inLinks[OPPOSITE[heading]] = id;
    if (isJ(from)) jMap[from].outLinks[heading] = id;
  };

  // негізгі көше (шығыс–батыс)
  const chain = ['W0', ...junctions.map((j) => j.id), 'E0'];
  for (let i = 0; i < chain.length - 1; i++) {
    addLink(chain[i], chain[i + 1], 'E', 'main');
    addLink(chain[i + 1], chain[i], 'W', 'main');
  }
  // қосалқы көшелер
  junctions.forEach((j, i) => {
    addLink(`N${i + 1}`, j.id, 'S', 'side');
    addLink(j.id, `N${i + 1}`, 'N', 'side');
    addLink(`S${i + 1}`, j.id, 'N', 'side');
    addLink(j.id, `S${i + 1}`, 'S', 'side');
  });

  const linkById = Object.fromEntries(links.map((l) => [l.id, l]));
  const xs = Object.values(nodePos).map((p) => p.x);
  const ys = Object.values(nodePos).map((p) => p.y);
  return {
    kind: opts.kind,
    junctions,
    links,
    linkById,
    junctionById: jMap,
    entries: links.filter((l) => l.isEntry).map((l) => l.id),
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
  };
}

/** Сегмент соңындағы қиылыс арқылы бұрылыстан кейінгі сегмент. */
export function nextLink(net: Network, linkId: string, turn: Turn): string | undefined {
  const l = net.linkById[linkId];
  const j = net.junctionById[l.to];
  if (!j) return undefined;
  const h = turnHeading(l.heading, turn);
  return j.outLinks[h];
}

export function movementOf(link: RoadSegment, turn: Turn): Movement {
  return `${link.approachSide}${turn}` as Movement;
}

// ---------- геометрия қиылыс ішіндегі траектория ----------
export interface BoxPath {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  length: number;
  lut: number[]; // жинақталған ұзындықтар (17 нүкте)
}

function bez(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

export function makeBoxPath(inLink: RoadSegment, inLane: number, outLink: RoadSegment, outLane: number): BoxPath {
  const rnIn = rightNormal(inLink.heading);
  const rnOut = rightNormal(outLink.heading);
  const oi = laneOffset(inLane);
  const oo = laneOffset(outLane);
  const p0 = { x: inLink.b.x + rnIn.x * oi, y: inLink.b.y + rnIn.y * oi };
  const p2 = { x: outLink.a.x + rnOut.x * oo, y: outLink.a.y + rnOut.y * oo };
  let p1: Pt;
  if (inLink.heading === outLink.heading) p1 = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  else {
    const d = HEADING[inLink.heading];
    // p0 + s·d мен p2 − u·dOut қиылысы: перпендикуляр бағыттарда — бұрыш нүктесі
    p1 = d.x !== 0 ? { x: p2.x, y: p0.y } : { x: p0.x, y: p2.y };
  }
  const lut = [0];
  let prev = p0;
  let acc = 0;
  for (let i = 1; i <= 16; i++) {
    const p = bez(p0, p1, p2, i / 16);
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    lut.push(acc);
    prev = p;
  }
  return { p0, p1, p2, length: acc, lut };
}

export function boxPose(path: BoxPath, s: number): { p: Pt; angle: number } {
  const target = Math.max(0, Math.min(s, path.length));
  let i = 1;
  while (i < path.lut.length - 1 && path.lut[i] < target) i++;
  const l0 = path.lut[i - 1];
  const l1 = path.lut[i];
  const t = ((i - 1) + (l1 > l0 ? (target - l0) / (l1 - l0) : 0)) / 16;
  const p = bez(path.p0, path.p1, path.p2, t);
  const u = 1 - t;
  const dx = 2 * u * (path.p1.x - path.p0.x) + 2 * t * (path.p2.x - path.p1.x);
  const dy = 2 * u * (path.p1.y - path.p0.y) + 2 * t * (path.p2.y - path.p1.y);
  return { p, angle: Math.atan2(dy, dx) };
}

export function linkPose(link: RoadSegment, lane: number, s: number): { p: Pt; angle: number } {
  const d = HEADING[link.heading];
  const rn = rightNormal(link.heading);
  const o = laneOffset(lane);
  return {
    p: { x: link.a.x + d.x * s + rn.x * o, y: link.a.y + d.y * s + rn.y * o },
    angle: Math.atan2(d.y, d.x),
  };
}
