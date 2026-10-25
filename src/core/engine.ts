/**
 * Қадамдық микросимуляция ядросы (UI-дан тәуелсіз).
 * Әр қадамда: келулер → бағдаршам фазасы → қиылыс ішіндегі көліктер → жол сегменттеріндегі көліктер
 * → кіру кезегінен енгізу → метрикалар. Барлық координаттар ядродан алынады.
 */
import {
  Network,
  RoadSegment,
  Turn,
  Movement,
  BoxPath,
  buildNetwork,
  laneForTurn,
  makeBoxPath,
  boxPose,
  linkPose,
  movementOf,
} from './network';
import { ArrivalEvent, VehicleType, generateDemand } from './demand';
import { Controller, SignalEvent, PhaseSense, createController, phaseLight } from './signals';
import { ScenarioParams, ControlMode, scenarioId, validateParams } from './scenario';
import { ALGO_VERSION, MODEL_VERSION } from './version';

export const MIN_GAP = 2.0; // м, тоқтаған көліктер арасы
const HARD_GAP = 0.5; // м, ешқашан бұзылмайтын ара
const TAU = 1.0; // с, жүргізуші реакциясы
const B_SAFE = 4.5; // м/с², қауіпсіз тежелу
const B_COMF = 3.0; // м/с², сары кезде тоқтау шешімі
const STOP_V = 0.5; // м/с — «қозғалыссыз» шегі
const QUEUE_V = 1.0; // м/с — адаптивті датчик үшін кезек
const TURN_V = 7; // м/с, бұрылыс жылдамдығы
const SAMPLE_EVERY = 10; // с

export interface Vehicle {
  id: number;
  type: VehicleType;
  origin: 'main' | 'side';
  len: number;
  vmax: number;
  acc: number;
  route: string[];
  turns: Turn[];
  ri: number;
  lane: number;
  pos: number;
  speed: number;
  inBox: boolean;
  box?: { junction: string; movement: Movement; phase: number; path: BoxPath; key: string; outLink: string; outLane: number };
  arrival: number;
  entered: number;
  wait: number;
  commit: boolean;
  moved: number;
}

export interface CompletedRecord {
  id: number;
  origin: 'main' | 'side';
  type: VehicleType;
  arrival: number;
  exit: number;
  travel: number;
  wait: number;
}

export interface SamplePoint {
  t: number;
  queue: number;
  active: number;
  completed: number;
  avgWait: number;
  perJunction: number[];
}

export interface SimResult {
  scenarioId: string;
  mode: ControlMode;
  algoVersion: string;
  modelVersion: string;
  seed: number;
  duration: number;
  simulatedTime: number;
  dt: number;
  network: string;
  generated: number;
  entered: number;
  completed: number;
  unfinished: number;
  unfinishedAvgWait: number;
  avgWait: number;
  avgWaitMain: number;
  avgWaitSide: number;
  maxWait: number;
  avgTravel: number;
  avgQueue: number;
  maxQueue: number;
  throughputPerHour: number;
  perJunction: { id: string; avgQueue: number; maxQueue: number; greenShare: number[]; switches: number }[];
  overloaded: boolean;
  conflictViolations: number;
  redViolations: number;
  series: SamplePoint[];
}

export interface VehiclePose {
  id: number;
  x: number;
  y: number;
  angle: number;
  len: number;
  type: VehicleType;
  stopped: boolean;
  wait: number;
}

export interface JunctionView {
  id: string;
  phase: number;
  stage: string;
  stageTime: number;
  lights: Record<string, ['green' | 'yellow' | 'red', 'green' | 'yellow' | 'red']>; // жақ → [сол жолақ, тура/оң жолақ]
  queue: number;
  scores?: number[];
}

export interface Kpi {
  t: number;
  active: number;
  waiting: number;
  backlog: number;
  completed: number;
  avgWait: number;
  avgQueue: number;
  maxQueue: number;
  throughputPerHour: number;
}

export class Simulation {
  readonly net: Network;
  readonly p: ScenarioParams;
  readonly mode: ControlMode;
  readonly events: ArrivalEvent[];
  readonly id: string;
  t = 0;
  stepIndex = 0;
  finished = false;
  overloaded = false;
  log: SignalEvent[] = [];
  completed: CompletedRecord[] = [];
  series: SamplePoint[] = [];
  conflictViolations = 0;
  redViolations = 0;

  private evIdx = 0;
  private lanes = new Map<string, Vehicle[][]>();
  private reserved = new Map<string, number[]>();
  private backlog = new Map<string, Vehicle[]>();
  private boxPaths = new Map<string, Vehicle[]>(); // кілт → қиылыс ішіндегі тізбек
  private boxByJ = new Map<string, Vehicle[]>();
  private lastFromLane = new Map<string, Vehicle>(); // «сегмент|жолақ» → соңғы кірген көлік
  private pathCache = new Map<string, BoxPath>();
  private controllers = new Map<string, Controller>();
  private phaseLanes = new Map<string, [string, number][][]>();
  private entered = 0;
  private sumWait = 0;
  private sumWaitMain = 0;
  private nMain = 0;
  private sumWaitSide = 0;
  private nSide = 0;
  private maxWait = 0;
  private sumTravel = 0;
  private queueIntegral = 0;
  private maxQueue = 0;
  private jQueueIntegral: number[];
  private jMaxQueue: number[];
  private lastQueue = 0;
  private lastJQueue: number[];
  private nextSample = 0;

  constructor(p: ScenarioParams, mode: ControlMode, events?: ArrivalEvent[], net?: Network) {
    const errs = validateParams(p);
    if (errs.length) throw new Error(errs.join('; '));
    this.p = p;
    this.mode = mode;
    this.net = net ?? buildNetwork({ kind: p.network });
    this.events = events ?? generateDemand(this.net, p);
    this.id = scenarioId(p);
    for (const l of this.net.links) {
      this.lanes.set(l.id, Array.from({ length: l.lanes }, () => []));
      this.reserved.set(l.id, new Array(l.lanes).fill(0));
      if (l.isEntry) this.backlog.set(l.id, []);
    }
    for (const j of this.net.junctions) {
      this.controllers.set(j.id, createController(mode, p, j.id));
      this.boxByJ.set(j.id, []);
      const pl: [string, number][][] = j.phases.map((ph) => {
        const out: [string, number][] = [];
        for (const m of ph.movements) {
          const side = m[0] as keyof typeof j.inLinks;
          const lid = j.inLinks[side];
          if (!lid) continue;
          const lane = laneForTurn(m[1] as Turn);
          if (!out.some(([a, b]) => a === lid && b === lane)) out.push([lid, lane]);
        }
        return out;
      });
      this.phaseLanes.set(j.id, pl);
    }
    this.jQueueIntegral = new Array(this.net.junctions.length).fill(0);
    this.jMaxQueue = new Array(this.net.junctions.length).fill(0);
    this.lastJQueue = new Array(this.net.junctions.length).fill(0);
  }

  get duration() {
    return this.p.duration;
  }

  controller(jid: string) {
    return this.controllers.get(jid)!;
  }

  // ---------------- көмекші функциялар ----------------
  private tailSpace(linkId: string, lane: number): number {
    const arr = this.lanes.get(linkId)![lane];
    const l = this.net.linkById[linkId];
    if (!arr.length) return l.length;
    const tail = arr[arr.length - 1];
    return tail.pos - tail.len;
  }

  private getPath(inLink: RoadSegment, inLane: number, outLink: RoadSegment, outLane: number): BoxPath {
    const key = `${inLink.id}|${inLane}|${outLink.id}|${outLane}`;
    let p = this.pathCache.get(key);
    if (!p) {
      p = makeBoxPath(inLink, inLane, outLink, outLane);
      this.pathCache.set(key, p);
    }
    return p;
  }

  private safeSpeed(v: Vehicle, gap: number, vLeader: number, vLimit: number): number {
    const dt = this.p.dt;
    const vDes = Math.min(v.speed + v.acc * dt, v.vmax, vLimit);
    const g = gap - MIN_GAP;
    let vSafe: number;
    if (g <= 0) vSafe = 0;
    else vSafe = B_SAFE * (-TAU + Math.sqrt(TAU * TAU + (2 * g + (vLeader * vLeader) / B_SAFE) / B_SAFE));
    return Math.max(0, Math.min(vDes, vSafe));
  }

  private makeVehicle(e: ArrivalEvent): Vehicle {
    const truck = e.type === 'truck';
    return {
      id: e.id,
      type: e.type,
      origin: e.origin,
      len: truck ? 12 : 4.5,
      vmax: truck ? this.p.truckSpeedKmh / 3.6 : 16.7,
      acc: truck ? 1.0 : 2.0,
      route: e.route,
      turns: e.turns,
      ri: 0,
      lane: laneForTurn(e.turns[0]),
      pos: 0,
      speed: 0,
      inBox: false,
      arrival: e.t,
      entered: -1,
      wait: 0,
      commit: false,
      moved: -1,
    };
  }

  /** Стоп-сызықтан қиылысқа кіруге рұқсат бар ма? */
  private canEnter(v: Vehicle, link: RoadSegment): boolean {
    const j = this.net.junctionById[link.to];
    const turn = v.turns[v.ri];
    const m = movementOf(link, turn);
    const ph = j.movementPhase[m];
    const st = this.controllers.get(j.id)!.state;
    if (st.phase !== ph) return false;
    if (st.stage === 'yellow') {
      if (!v.commit) {
        const dist = link.length - v.pos;
        const stopDist = (v.speed * v.speed) / (2 * B_COMF);
        if (v.speed > 2 && dist < stopDist) v.commit = true;
        else return false;
      }
    } else if (st.stage === 'allred') {
      if (!v.commit) return false;
    }
    // қақтығысатын қозғалыс қиылыс ішінде болмауы тиіс
    for (const o of this.boxByJ.get(j.id)!) if (o.box!.phase !== ph) return false;
    const outId = v.route[v.ri + 1];
    const outLane = laneForTurn(v.turns[v.ri + 1]);
    const space = this.tailSpace(outId, outLane) - this.reserved.get(outId)![outLane];
    return space >= v.len + MIN_GAP;
  }

  private enterBox(v: Vehicle, link: RoadSegment, overshoot: number) {
    const j = this.net.junctionById[link.to];
    const turn = v.turns[v.ri];
    const m = movementOf(link, turn);
    const ph = j.movementPhase[m];
    const st = this.controllers.get(j.id)!.state;
    if (st.phase !== ph || (st.stage !== 'green' && !v.commit)) this.redViolations++;
    const outId = v.route[v.ri + 1];
    const outLink = this.net.linkById[outId];
    const outLane = laneForTurn(v.turns[v.ri + 1]);
    const path = this.getPath(link, v.lane, outLink, outLane);
    const key = `${link.id}|${v.lane}|${outId}|${outLane}`;
    v.inBox = true;
    v.commit = false;
    v.pos = Math.min(overshoot, 1);
    v.box = { junction: j.id, movement: m, phase: ph, path, key, outLink: outId, outLane };
    if (!this.boxPaths.has(key)) this.boxPaths.set(key, []);
    this.boxPaths.get(key)!.push(v);
    this.boxByJ.get(j.id)!.push(v);
    this.reserved.get(outId)![outLane] += v.len + MIN_GAP;
    this.lastFromLane.set(`${link.id}|${v.lane}`, v);
  }

  private leaveBox(v: Vehicle) {
    const b = v.box!;
    const arr = this.boxPaths.get(b.key)!;
    arr.splice(arr.indexOf(v), 1);
    const jb = this.boxByJ.get(b.junction)!;
    jb.splice(jb.indexOf(v), 1);
    this.reserved.get(b.outLink)![b.outLane] -= v.len + MIN_GAP;
    const over = v.pos - b.path.length;
    const laneArr = this.lanes.get(b.outLink)![b.outLane];
    let pos = Math.max(0, over);
    if (laneArr.length) {
      const tail = laneArr[laneArr.length - 1];
      pos = Math.min(pos, tail.pos - tail.len - HARD_GAP);
      if (pos < 0) pos = 0;
    }
    v.pos = pos;
    v.ri += 1;
    v.lane = b.outLane;
    v.inBox = false;
    v.box = undefined;
    laneArr.push(v);
  }

  private complete(v: Vehicle, t: number) {
    const travel = t - v.arrival;
    this.completed.push({ id: v.id, origin: v.origin, type: v.type, arrival: v.arrival, exit: t, travel, wait: v.wait });
    this.sumWait += v.wait;
    this.sumTravel += travel;
    if (v.wait > this.maxWait) this.maxWait = v.wait;
    if (v.origin === 'main') {
      this.sumWaitMain += v.wait;
      this.nMain++;
    } else {
      this.sumWaitSide += v.wait;
      this.nSide++;
    }
  }

  private sensePhases(jid: string, detector: number): PhaseSense[] {
    const pl = this.phaseLanes.get(jid)!;
    const cur = this.controllers.get(jid)!.state.phase;
    return pl.map((lanes, i) =>
      (() => {
        let n = 0;
        let w = 0;
        let nq = 0;
        for (const [lid, lane] of lanes) {
          const l = this.net.linkById[lid];
          for (const v of this.lanes.get(lid)![lane]) {
            const queued = v.speed < QUEUE_V;
            const near = i === cur && l.length - v.pos <= detector;
            if (queued || near) n++;
            if (queued) {
              w += v.wait;
              nq++;
            }
          }
        }
        return { N: n, W: nq ? w / nq : 0 };
      })(),
    );
  }

  // ---------------- негізгі қадам ----------------
  step(): void {
    if (this.finished) return;
    const dt = this.p.dt;
    const t = this.t;
    const tEnd = t + dt;
    this.stepIndex++;
    const si = this.stepIndex;

    // 1. Келулер → кіру кезегі
    while (this.evIdx < this.events.length && this.events[this.evIdx].t < tEnd) {
      const e = this.events[this.evIdx++];
      const v = this.makeVehicle(e);
      v.wait += tEnd - e.t > dt ? dt : Math.max(0, tEnd - e.t);
      v.moved = si;
      this.backlog.get(e.entry)!.push(v);
    }

    // 2. Бағдаршамдар
    for (const j of this.net.junctions) {
      const c = this.controllers.get(j.id)!;
      c.update(t, dt, () => this.sensePhases(j.id, this.p.adaptive.detector), (ev) => this.pushLog(ev));
    }

    // 3. Қиылыс ішіндегі көліктер
    for (const [, arr] of this.boxPaths) {
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (v.moved === si) continue;
        const path = v.box!.path;
        const outLink = this.net.linkById[v.box!.outLink];
        const limit = v.box!.movement[1] === 'T' ? Math.min(outLink.speedLimit, v.vmax) : TURN_V;
        let gap: number;
        let vl: number;
        if (i > 0) {
          const L = arr[i - 1];
          gap = L.pos - L.len - v.pos;
          vl = L.speed;
        } else {
          const laneArr = this.lanes.get(outLink.id)![v.box!.outLane];
          if (laneArr.length) {
            const tail = laneArr[laneArr.length - 1];
            gap = path.length - v.pos + tail.pos - tail.len;
            vl = tail.speed;
          } else {
            gap = 1e9;
            vl = 0;
          }
        }
        const ns = this.safeSpeed(v, gap, vl, limit);
        v.speed = ns;
        v.pos += ns * dt;
        if (i > 0) {
          const L = arr[i - 1];
          const maxPos = L.pos - L.len - HARD_GAP;
          if (v.pos > maxPos) {
            v.pos = Math.max(v.pos - ns * dt, maxPos);
            v.speed = Math.min(v.speed, L.speed);
          }
        }
        if (v.speed < STOP_V) v.wait += dt;
        v.moved = si;
      }
      // жолдың соңына жеткендер — шығыс сегментке
      for (let i = 0; i < arr.length; ) {
        const v = arr[i];
        if (v.pos >= v.box!.path.length) this.leaveBox(v);
        else i++;
      }
    }

    // 4. Сегменттердегі көліктер
    for (const link of this.net.links) {
      const laneArrs = this.lanes.get(link.id)!;
      for (let ln = 0; ln < laneArrs.length; ln++) {
        const arr = laneArrs[ln];
        const snapshot = arr.slice();
        for (let i = 0; i < snapshot.length; i++) {
          const v = snapshot[i];
          if (v.moved === si) continue;
          const leader = i > 0 ? snapshot[i - 1] : null;
          const leaderOnLane = leader && !leader.inBox && leader.route[leader.ri] === link.id && !this.isDone(leader);
          let gap: number;
          let vl: number;
          let allowed = false;
          if (leaderOnLane) {
            gap = leader!.pos - leader!.len - v.pos;
            vl = leader!.speed;
          } else if (link.isExit) {
            gap = 1e9;
            vl = 0;
          } else {
            allowed = this.canEnter(v, link);
            if (allowed) {
              const prev = this.lastFromLane.get(`${link.id}|${ln}`);
              if (prev && prev.inBox) {
                gap = link.length - v.pos + prev.pos - prev.len;
                vl = prev.speed;
              } else {
                gap = 1e9;
                vl = 0;
              }
            } else {
              gap = link.length + MIN_GAP - v.pos; // стоп-сызықта тоқтау
              vl = 0;
            }
          }
          const ns = this.safeSpeed(v, gap, vl, link.speedLimit);
          v.speed = ns;
          v.pos += ns * dt;
          if (leaderOnLane) {
            const maxPos = leader!.pos - leader!.len - HARD_GAP;
            if (v.pos > maxPos) {
              v.pos = Math.max(maxPos, 0);
              v.speed = Math.min(v.speed, leader!.speed);
            }
          }
          if (v.speed < STOP_V) v.wait += dt;
          v.moved = si;
          if (v.pos >= link.length) {
            if (link.isExit) {
              arr.splice(arr.indexOf(v), 1);
              (v as Vehicle & { done?: boolean }).done = true;
              this.complete(v, tEnd);
            } else if (!leaderOnLane && allowed) {
              arr.splice(arr.indexOf(v), 1);
              this.enterBox(v, link, v.pos - link.length);
            } else {
              v.pos = link.length; // қызылға өтуге болмайды
              v.speed = 0;
            }
          }
        }
      }
    }

    // 5. Кіру кезегінен желіге енгізу
    for (const [entryId, q] of this.backlog) {
      const link = this.net.linkById[entryId];
      const usedLane = [false, false];
      while (q.length) {
        const v = q[0];
        const lane = v.lane;
        if (usedLane[lane]) break;
        const space = this.tailSpace(entryId, lane);
        if (space < MIN_GAP + 1) break;
        const arr = this.lanes.get(entryId)![lane];
        const tail = arr[arr.length - 1];
        v.speed = tail ? this.safeSpeed({ ...v, speed: Math.min(link.speedLimit, v.vmax) }, space, tail.speed, link.speedLimit) : Math.min(link.speedLimit, v.vmax);
        v.pos = 0;
        v.entered = tEnd;
        q.shift();
        arr.push(v);
        this.entered++;
        usedLane[lane] = true;
      }
      for (const v of q) if (v.moved !== si) v.wait += dt;
      for (const v of q) v.moved = si;
    }

    // 6. Инварианттар және метрикалар
    let queue = 0;
    let active = 0;
    const jq = this.lastJQueue.fill(0);
    const jIndex: Record<string, number> = {};
    this.net.junctions.forEach((j, i) => (jIndex[j.id] = i));
    for (const j of this.net.junctions) {
      const occ = this.boxByJ.get(j.id)!;
      active += occ.length;
      if (occ.length > 1) {
        const ph = occ[0].box!.phase;
        if (occ.some((o) => o.box!.phase !== ph)) this.conflictViolations++;
      }
    }
    for (const link of this.net.links) {
      for (const arr of this.lanes.get(link.id)!) {
        active += arr.length;
        if (link.isExit) continue;
        for (const v of arr)
          if (v.speed < STOP_V) {
            queue++;
            jq[jIndex[link.to]]++;
          }
      }
    }
    let bl = 0;
    for (const q of this.backlog.values()) bl += q.length;
    queue += bl;
    this.lastQueue = queue;
    this.queueIntegral += queue * dt;
    if (queue > this.maxQueue) this.maxQueue = queue;
    for (let i = 0; i < jq.length; i++) {
      this.jQueueIntegral[i] += jq[i] * dt;
      if (jq[i] > this.jMaxQueue[i]) this.jMaxQueue[i] = jq[i];
    }

    this.t = tEnd;
    if (this.t >= this.nextSample - 1e-9) {
      this.series.push({
        t: Math.round(this.t),
        queue,
        active: active + bl,
        completed: this.completed.length,
        avgWait: this.completed.length ? round2(this.sumWait / this.completed.length) : 0,
        perJunction: [...jq],
      });
      this.nextSample += SAMPLE_EVERY;
    }
    if (active + bl > this.p.maxVehicles) {
      this.overloaded = true;
      this.finished = true;
      this.pushLog({ t: this.t, junction: '—', kind: 'force', text: `Шамадан тыс жүктеме: ${active + bl} көлік > шек ${this.p.maxVehicles}. Симуляция қауіпсіз тоқтатылды.` });
      return;
    }
    if (this.t >= this.p.duration - 1e-9) this.finished = true;
  }

  private isDone(v: Vehicle) {
    return (v as Vehicle & { done?: boolean }).done === true;
  }

  private pushLog(e: SignalEvent) {
    this.log.push(e);
    if (this.log.length > 600) this.log.splice(0, this.log.length - 600);
  }

  run(): SimResult {
    while (!this.finished) this.step();
    return this.result();
  }

  runFor(seconds: number) {
    const target = Math.min(this.p.duration, this.t + seconds);
    while (!this.finished && this.t < target - 1e-9) this.step();
  }

  // ---------------- нәтижелер және көрініс ----------------
  activeVehicles(): Vehicle[] {
    const out: Vehicle[] = [];
    for (const arrs of this.lanes.values()) for (const arr of arrs) out.push(...arr);
    for (const arr of this.boxByJ.values()) out.push(...arr);
    return out;
  }

  kpi(): Kpi {
    const n = this.completed.length;
    let bl = 0;
    for (const q of this.backlog.values()) bl += q.length;
    const act = this.activeVehicles();
    return {
      t: this.t,
      active: act.length,
      waiting: this.lastQueue,
      backlog: bl,
      completed: n,
      avgWait: n ? this.sumWait / n : 0,
      avgQueue: this.t > 0 ? this.queueIntegral / this.t : 0,
      maxQueue: this.maxQueue,
      throughputPerHour: this.t > 0 ? (n * 3600) / this.t : 0,
    };
  }

  poses(): VehiclePose[] {
    const out: VehiclePose[] = [];
    for (const [lid, arrs] of this.lanes) {
      const l = this.net.linkById[lid];
      arrs.forEach((arr, lane) => {
        for (const v of arr) {
          const { p, angle } = linkPose(l, lane, v.pos);
          out.push({ id: v.id, x: p.x, y: p.y, angle, len: v.len, type: v.type, stopped: v.speed < STOP_V, wait: v.wait });
        }
      });
    }
    for (const arr of this.boxByJ.values())
      for (const v of arr) {
        const { p, angle } = boxPose(v.box!.path, v.pos);
        out.push({ id: v.id, x: p.x, y: p.y, angle, len: v.len, type: v.type, stopped: v.speed < STOP_V, wait: v.wait });
      }
    return out;
  }

  backlogCounts(): Record<string, number> {
    const r: Record<string, number> = {};
    for (const [k, q] of this.backlog) r[k] = q.length;
    return r;
  }

  junctionViews(): JunctionView[] {
    return this.net.junctions.map((j, idx) => {
      const st = this.controllers.get(j.id)!.state;
      const lights: JunctionView['lights'] = {};
      for (const side of ['N', 'E', 'S', 'W'] as const) {
        if (!j.inLinks[side]) continue;
        const pl = j.movementPhase[`${side}L`];
        const pt = j.movementPhase[`${side}T`];
        lights[side] = [phaseLight(st, pl), phaseLight(st, pt)];
      }
      return {
        id: j.id,
        phase: st.phase,
        stage: st.stage,
        stageTime: st.stageTime,
        lights,
        queue: this.lastJQueue[idx] ?? 0,
        scores: st.lastScores,
      };
    });
  }

  result(): SimResult {
    const n = this.completed.length;
    const unfinished = this.activeVehicles();
    const bl: Vehicle[] = [];
    for (const q of this.backlog.values()) bl.push(...q);
    const unf = [...unfinished, ...bl];
    const T = Math.max(this.t, 1e-9);
    return {
      scenarioId: this.id,
      mode: this.mode,
      algoVersion: ALGO_VERSION[this.mode],
      modelVersion: MODEL_VERSION,
      seed: this.p.seed,
      duration: this.p.duration,
      simulatedTime: round2(this.t),
      dt: this.p.dt,
      network: this.p.network,
      generated: this.evIdx,
      entered: this.entered,
      completed: n,
      unfinished: unf.length,
      unfinishedAvgWait: unf.length ? round2(unf.reduce((a, v) => a + v.wait, 0) / unf.length) : 0,
      avgWait: n ? round2(this.sumWait / n) : 0,
      avgWaitMain: this.nMain ? round2(this.sumWaitMain / this.nMain) : 0,
      avgWaitSide: this.nSide ? round2(this.sumWaitSide / this.nSide) : 0,
      maxWait: round2(this.maxWait),
      avgTravel: n ? round2(this.sumTravel / n) : 0,
      avgQueue: round2(this.queueIntegral / T),
      maxQueue: this.maxQueue,
      throughputPerHour: round2((n * 3600) / T),
      perJunction: this.net.junctions.map((j, i) => {
        const st = this.controllers.get(j.id)!.state;
        const tot = st.greenTime.reduce((a, b) => a + b, 0) || 1;
        return {
          id: j.id,
          avgQueue: round2(this.jQueueIntegral[i] / T),
          maxQueue: this.jMaxQueue[i],
          greenShare: st.greenTime.map((g) => round2(g / tot)),
          switches: st.switches,
        };
      }),
      overloaded: this.overloaded,
      conflictViolations: this.conflictViolations,
      redViolations: this.redViolations,
      series: this.series,
    };
  }
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}

/** Бір сценарийді екі режимде бірдей сұраныспен іске қосу. */
export function runPair(p: ScenarioParams) {
  const net = buildNetwork({ kind: p.network });
  const events = generateDemand(net, p);
  const fixed = new Simulation(p, 'fixed', events, net).run();
  const adaptive = new Simulation(p, 'adaptive', events, net).run();
  return { fixed, adaptive, events: events.length };
}

export function runSingle(p: ScenarioParams, mode: ControlMode): SimResult {
  return new Simulation(p, mode).run();
}

/** Күтуді жақсарту пайызы: (W_fixed − W_adaptive)/W_fixed·100%, W_fixed > 0 болғанда ғана. */
export function improvementPct(wFixed: number, wAdaptive: number): number | null {
  if (!(wFixed > 0)) return null;
  return ((wFixed - wAdaptive) / wFixed) * 100;
}
